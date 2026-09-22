"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cleanMermaidSource, readMermaidSource } from "@/lib/mermaid-text";

let renderCount = 0;

export function Diagram({ chart }: { chart: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [renderState, setRenderState] = useState<{
    source: string;
    ready: boolean;
    error: string | null;
  } | null>(null);
  const source = cleanMermaidSource(chart);
  const safeSource = readMermaidSource(chart);
  const current = renderState?.source === safeSource ? renderState : null;
  const ready = current?.ready ?? false;
  const error = current?.error ?? null;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    host.replaceChildren();
    if (!safeSource) {
      return;
    }

    let cancelled = false;
    const renderId = `repolens-${reactId}-${(renderCount += 1)}`;

    async function render(diagramHost: HTMLDivElement, diagram: string) {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        fontFamily: "inherit",
        themeVariables: {
          fontFamily: "inherit",
          primaryColor: "#e7f3f2",
          primaryTextColor: "#1c1915",
          primaryBorderColor: "#0c5c57",
          lineColor: "#5e584e",
          secondaryColor: "#f6efe6",
          tertiaryColor: "#fbf8f3",
          background: "#fbf8f3",
          clusterBkg: "#f6efe6",
          clusterBorder: "#0c5c57",
        },
      });
      const { svg } = await mermaid.render(renderId, diagram);
      if (cancelled) {
        return;
      }
      mountSvg(diagramHost, svg);
      setRenderState({ source: diagram, ready: true, error: null });
    }

    void render(host, safeSource).catch((caught: unknown) => {
      if (cancelled) {
        return;
      }
      host.replaceChildren();
      setRenderState({
        source: safeSource,
        ready: false,
        error: caught instanceof Error ? caught.message : "The diagram could not be rendered.",
      });
    });

    return () => {
      cancelled = true;
      document.getElementById(renderId)?.remove();
    };
  }, [reactId, safeSource]);

  return (
    <section className="panel panel-diagram" aria-labelledby="diagram-heading">
      <div className="panel-kicker">
        <span>02</span>
        <h2 id="diagram-heading">Mermaid</h2>
      </div>
      {safeSource ? (
        <div className="diagram-frame" ref={hostRef} role="img" aria-label="Architecture diagram" />
      ) : (
        <p className="error-text" role="alert">
          The diagram source was empty or unsafe, so it was not rendered.
        </p>
      )}
      {safeSource && !ready && !error ? <p className="muted">Rendering diagram…</p> : null}
      {safeSource && error ? (
        <p className="error-text" role="alert">
          The diagram could not be rendered. The source is below.
        </p>
      ) : null}
      <details className="source">
        <summary>Diagram source</summary>
        <pre>
          <code>{source}</code>
        </pre>
      </details>
    </section>
  );
}

function mountSvg(host: HTMLElement, svg: string) {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = parsed.documentElement;
  if (root.nodeName.toLowerCase() !== "svg" || root.querySelector("parsererror")) {
    throw new Error("Diagram renderer did not return an SVG.");
  }
  root.querySelectorAll("script, foreignObject, iframe, object, embed").forEach((node) => {
    node.remove();
  });
  for (const element of root.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      if (attribute.name.toLowerCase().startsWith("on") || attribute.value.trim().toLowerCase().startsWith("javascript:")) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  host.replaceChildren(document.importNode(root, true));
}
