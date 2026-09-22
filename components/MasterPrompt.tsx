import { CopyButton } from "@/components/CopyButton";

export function MasterPrompt({
  prompt,
  omissions,
}: {
  prompt: string;
  omissions: readonly string[];
}) {
  return (
    <div className="panel-body">
      <div className="master-toolbar">
        <div>
          <p className="eyebrow">ChatGPT-astra</p>
          <p className="lead">Paste this master prompt to rebuild the repository.</p>
        </div>
        <CopyButton text={prompt} label="Copy master prompt" copiedLabel="Copied" prominent />
      </div>
      <pre className="master-prompt">{prompt}</pre>
      <h3>Omissions</h3>
      {omissions.length > 0 ? (
        <ul className="points">
          {omissions.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">No structural omissions were recorded for this digest.</p>
      )}
    </div>
  );
}
