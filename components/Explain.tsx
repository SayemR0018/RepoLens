import type { AnalyzeResult } from "@/lib/schemas";

export function Explain({ explain }: { explain: AnalyzeResult["explain"] }) {
  return (
    <div className="panel-body">
      <article className="tldr">
        <p className="eyebrow">TLDR</p>
        <p className="lead">{explain.summary}</p>
      </article>
      <h3>Purpose</h3>
      <p>{explain.purpose}</p>
      <h3>Audience</h3>
      <p>{explain.audience}</p>
      <h3>Stack</h3>
      <ul className="chips">
        {explain.stack.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
      <h3>Highlights</h3>
      <ul className="points">
        {explain.highlights.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
