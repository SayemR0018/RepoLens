import type { AnalyzeResult } from "@/lib/schemas";

export function Explain({ explain }: { explain: AnalyzeResult["explain"] }) {
  return (
    <section className="panel" aria-labelledby="explain-heading">
      <div className="panel-kicker">
        <span>01</span>
        <h2 id="explain-heading">Explain</h2>
      </div>
      <p className="lead">{explain.summary}</p>
      <h3>Purpose</h3>
      <p>{explain.purpose}</p>
      <h3>Who it is for</h3>
      <p>{explain.audience}</p>
      <h3>Stack</h3>
      <ul className="chips">
        {explain.stack.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h3>Highlights</h3>
      <ul className="points">
        {explain.highlights.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
