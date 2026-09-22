const OPENING_FENCE = /^```(?:mermaid)?[^\n]*\n?/i;
const CLOSING_FENCE = /\n?```$/;
const UNSAFE_SOURCE = /<\s*script\b|javascript:|on\w+\s*=/i;

export function cleanMermaidSource(source: string): string {
  let text = source.trim();
  if (text.startsWith("```")) {
    text = text.replace(OPENING_FENCE, "").replace(CLOSING_FENCE, "").trim();
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
