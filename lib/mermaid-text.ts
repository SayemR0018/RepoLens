const OPENING_FENCE = /^```(?:mermaid)?[^\n]*\n?/i;
const CLOSING_FENCE = /\n?```$/;
const FENCED_BLOCK = /```(?:mermaid)?[^\n]*\r?\n([\s\S]*?)```/i;
const UNSAFE_SOURCE = /<\s*script\b|javascript:|on\w+\s*=/i;
const MINIMAL_FLOWCHART = 'flowchart TD\n  repo["Repository"] --> readme["See README"]';

export function cleanMermaidSource(source: string): string {
  const text = source.trim();
  const fenced = FENCED_BLOCK.exec(text);
  if (fenced) {
    return fenced[1].trim();
  }
  if (text.startsWith("```")) {
    return text.replace(OPENING_FENCE, "").replace(CLOSING_FENCE, "").trim();
  }
  return text;
}

export function readMermaidSource(source: string): string | null {
  const text = cleanMermaidSource(source);
  if (!text || UNSAFE_SOURCE.test(text)) {
    return null;
  }
  return text;
}

/**
 * Minimal flowchart when the model omits a diagram or returns an empty or
 * unsafe one. Folder names that contain script, javascript:, or event
 * handlers are dropped rather than rewritten into the diagram.
 */
export function flowchartFromRootFolders(
  rootLabel: string,
  folderNames: readonly string[],
): string {
  const root = safeLabel(rootLabel) ?? "Repository";
  const folders: string[] = [];
  for (const name of folderNames) {
    if (UNSAFE_SOURCE.test(name)) {
      continue;
    }
    const label = safeLabel(name);
    if (!label) {
      continue;
    }
    folders.push(label);
    if (folders.length >= 8) {
      break;
    }
  }

  const lines = ["flowchart TD", `  repo["${root}"]`];
  if (folders.length === 0) {
    lines.push('  repo --> readme["See README"]');
  } else {
    folders.forEach((label, index) => {
      lines.push(`  repo --> n${index}["${label}/"]`);
    });
  }

  return readMermaidSource(lines.join("\n")) ?? MINIMAL_FLOWCHART;
}

function safeLabel(value: string): string | null {
  const cleaned = value
    .replace(/<\s*\/?\s*script\b[^>]*>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>"'`\\]/g, "")
    .replace(/[\[\]{}#;]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  if (!cleaned || UNSAFE_SOURCE.test(cleaned)) {
    return null;
  }
  return cleaned;
}
