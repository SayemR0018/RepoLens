const STAGES = ["Fetching tree", "Reading files", "Writing prompt"] as const;

export function Progress({ stage }: { stage: number }) {
  const current = STAGES[Math.min(Math.max(stage, 0), STAGES.length - 1)];

  return (
    <section className="progress" aria-live="polite" aria-busy="true">
      <p className="progress-label">Working on the repository</p>
      <ol className="progress-chips">
        {STAGES.map((name, index) => {
          const state = index < stage ? "done" : index === stage ? "active" : "wait";
          const prefix = state === "done" ? "Done: " : state === "active" ? "Current: " : "Upcoming: ";
          return (
            <li key={name} data-state={state}>
              <span className="sr-only">{prefix}</span>
              {name}
            </li>
          );
        })}
      </ol>
      <p className="progress-current">{current}</p>
      <div className="skeleton" aria-hidden="true">
        <div className="skeleton-tabs">
          <span className="skeleton-block skeleton-pill" />
          <span className="skeleton-block skeleton-pill" />
        </div>
        <div className="skeleton-card">
          <span className="skeleton-block skeleton-line wide" />
          <span className="skeleton-block skeleton-line" />
          <span className="skeleton-block skeleton-line short" />
        </div>
      </div>
    </section>
  );
}
