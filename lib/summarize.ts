import { DIGEST_CHAR_LIMIT, formatDigest, type RepoDigest } from "./github";

const SUMMARY_LIMIT = 900;

export type FittedDigest = {
  digest: RepoDigest;
  text: string;
};

/**
 * Keeps the model prompt inside the digest budget.
 * Overflowing file bodies become deterministic extracts. No model call.
 */
export function fitDigest(digest: RepoDigest): FittedDigest {
  const full = formatDigest(digest, { limit: null });
  if (full.length <= DIGEST_CHAR_LIMIT) {
    return { digest, text: full };
  }

  const summarized = digest.keyFiles.map((file) => ({
    path: file.path,
    content: summarizeSource(file.path, file.content),
  }));
  const changed = digest.keyFiles
    .filter((file, index) => file.content !== summarized[index]?.content)
    .map((file) => file.path);

  let next: RepoDigest = {
    ...digest,
    keyFiles: summarized,
    omissions: [
      ...digest.omissions,
      changed.length > 0
        ? `Digest exceeded ${DIGEST_CHAR_LIMIT} characters. Replaced file bodies with deterministic summaries: ${changed.join(", ")}.`
        : `Digest exceeded ${DIGEST_CHAR_LIMIT} characters before the model call.`,
    ].slice(0, 40),
  };

  const second = formatDigest(next, { limit: null });
  if (second.length <= DIGEST_CHAR_LIMIT) {
    return { digest: next, text: second };
  }

  next = {
    ...next,
    omissions: [
      ...next.omissions,
      `Digest was clipped to ${DIGEST_CHAR_LIMIT} characters after summaries.`,
    ].slice(0, 40),
  };
  return { digest: next, text: formatDigest(next) };
}

export function summarizeSource(path: string, content: string): string {
  if (content.length <= SUMMARY_LIMIT) {
    return content;
  }
  const lines = content.split(/\r?\n/);
  const kept: string[] = [`# Deterministic summary of ${path}`, ""];
  kept.push(...lines.slice(0, 8).map((line) => line.trimEnd()));
  kept.push("");
  const signal =
    /^(export |pub |public |class |function |def |fn |func |type |interface |module |import |from |FROM |COPY |RUN |CMD |ENTRYPOINT |\[|\s*-\s|require\b|gem\b|"[^"]+"\s*:)/i;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 180) {
      continue;
    }
    if (signal.test(line) || signal.test(trimmed)) {
      kept.push(trimmed);
    }
    if (kept.join("\n").length >= SUMMARY_LIMIT) {
      break;
    }
  }
  const text = kept.join("\n");
  if (text.length <= SUMMARY_LIMIT) {
    return text;
  }
  return `${text.slice(0, SUMMARY_LIMIT)}\n…[summary]`;
}
