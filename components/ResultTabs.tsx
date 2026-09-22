"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { Explain } from "@/components/Explain";
import { RunGuide } from "@/components/RunGuide";
import type { AnalyzeResult } from "@/lib/schemas";

const Diagram = dynamic(
  () => import("@/components/Diagram").then((module) => module.Diagram),
  {
    ssr: false,
    loading: () => <DiagramFallback />,
  },
);

const TABS = [
  { id: "explain", label: "Explain" },
  { id: "diagram", label: "Diagram" },
  { id: "run", label: "Run" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ResultTabs({
  result,
}: {
  result: AnalyzeResult;
}) {
  const baseId = useId();
  const wide = useWideLayout();
  const [active, setActive] = useState<TabId>("explain");
  const [open, setOpen] = useState<Record<TabId, boolean>>({
    explain: true,
    diagram: true,
    run: true,
  });

  function selectTab(id: TabId) {
    setActive(id);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = TABS.findIndex((tab) => tab.id === active);
    let next = index;
    if (event.key === "ArrowRight") {
      next = (index + 1) % TABS.length;
    } else if (event.key === "ArrowLeft") {
      next = (index - 1 + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = TABS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const id = TABS[next].id;
    setActive(id);
    document.getElementById(tabDomId(baseId, id))?.focus();
  }

  function toggle(id: TabId) {
    setOpen((current) => ({ ...current, [id]: !current[id] }));
    if (!open[id]) {
      setActive(id);
    }
  }

  function panel(id: TabId) {
    if (id === "explain") {
      return <Explain explain={result.explain} />;
    }
    if (id === "diagram") {
      return (
        <Diagram
          key={`mermaid-${result.mermaid.slice(0, 32)}-${active}`}
          chart={result.mermaid}
        />
      );
    }
    return (
      <RunGuide
        run={result.run}
        owner={result.owner}
        repo={result.repo}
        branch={result.defaultBranch}
        source={result.source}
      />
    );
  }

  if (!wide) {
    return (
      <div className="accordion">
        {TABS.map((tab) => {
          const expanded = open[tab.id];
          const buttonId = `${baseId}-acc-${tab.id}`;
          const regionId = `${baseId}-region-${tab.id}`;
          return (
            <section key={tab.id} className="accordion-item">
              <h3>
                <button
                  type="button"
                  className="accordion-trigger"
                  id={buttonId}
                  aria-expanded={expanded}
                  aria-controls={regionId}
                  onClick={() => toggle(tab.id)}
                >
                  {tab.label}
                </button>
              </h3>
              {expanded ? (
                <div
                  className="panel"
                  id={regionId}
                  role="region"
                  aria-labelledby={buttonId}
                >
                  {panel(tab.id)}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="result-switcher">
      <div
        className="result-tabs"
        role="tablist"
        aria-label="Analysis"
        aria-orientation="horizontal"
        onKeyDown={onTabKeyDown}
      >
        {TABS.map((tab) => {
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={selected ? "tab is-active" : "tab"}
              role="tab"
              id={tabDomId(baseId, tab.id)}
              aria-selected={selected}
              aria-controls={panelDomId(baseId, tab.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        className="panel"
        role="tabpanel"
        id={panelDomId(baseId, active)}
        aria-labelledby={tabDomId(baseId, active)}
        tabIndex={0}
      >
        {panel(active)}
      </div>
    </div>
  );
}

function tabDomId(baseId: string, id: TabId): string {
  return `${baseId}-tab-${id}`;
}

function panelDomId(baseId: string, id: TabId): string {
  return `${baseId}-panel-${id}`;
}

function useWideLayout(): boolean {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 800px)");
    const apply = () => setWide(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return wide;
}

function DiagramFallback() {
  return (
    <div className="panel-body panel-diagram" aria-busy="true">
      <p className="muted">Loading diagram renderer…</p>
      <div className="diagram-frame" />
    </div>
  );
}
