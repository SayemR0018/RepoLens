"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { isDrawableViewBox, readViewBox, viewBoxFromSvg } from "@/lib/diagram-layout";
import { cleanMermaidSource, readMermaidSource } from "@/lib/mermaid-text";

let renderCount = 0;

const LIGHT_THEME = {
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  primaryColor: "#d5efec",
  primaryTextColor: "#10211f",
  primaryBorderColor: "#0a4f4a",
  secondaryColor: "#f6e6d6",
  tertiaryColor: "#fffdf8",
  background: "#fffdf8",
  mainBkg: "#d5efec",
  nodeBorder: "#0a4f4a",
  clusterBkg: "#f3ebe1",
  clusterBorder: "#0a4f4a",
  lineColor: "#3f3830",
  textColor: "#1c1915",
  nodeTextColor: "#10211f",
  titleColor: "#1c1915",
  edgeLabelBackground: "#fffdf8",
};

const DARK_THEME = {
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  primaryColor: "#1b4f4a",
  primaryTextColor: "#f3fffc",
  primaryBorderColor: "#b7ebe6",
  secondaryColor: "#2a3331",
  tertiaryColor: "#161513",
  background: "#161513",
  mainBkg: "#1b4f4a",
  nodeBorder: "#b7ebe6",
  clusterBkg: "#24211d",
  clusterBorder: "#b7ebe6",
  lineColor: "#efe8dc",
  textColor: "#f7f2ea",
  nodeTextColor: "#f3fffc",
  titleColor: "#f7f2ea",
  edgeLabelBackground: "#24211d",
};

export function Diagram({ chart }: { chart: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const scheme = useColorScheme();
  const [zoom, setZoom] = useState(1);
  const [sourceChoice, setSourceChoice] = useState<"auto" | "open" | "closed">("auto");
  const [renderState, setRenderState] = useState<{
    source: string;
    ready: boolean;
    error: string | null;
  } | null>(null);
  const source = cleanMermaidSource(chart);
  const safeSource = readMermaidSource(chart);
  const current = renderState?.source === safeSource ? renderState : null;
  const ready = current?.ready ?? false;
  const renderError = current?.error ?? null;
  const blocked = !safeSource;
  const error = blocked
    ? "The diagram source was empty or unsafe, so it was not rendered."
    : renderError;
  const sourceVisible = sourceChoice === "open" || (sourceChoice === "auto" && Boolean(error));

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !safeSource) {
      return;
    }
    const diagramHost: HTMLDivElement = host;
    diagramHost.replaceChildren();

    let cancelled = false;
    const renderId = `repolens-${reactId}-${(renderCount += 1)}`;

    async function draw(diagram: string) {
      const mermaid = (await import("mermaid")).default;
      const dark = scheme === "dark";
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        suppressErrorRendering: true,
        htmlLabels: false,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        theme: dark ? "dark" : "base",
        themeVariables: dark ? DARK_THEME : LIGHT_THEME,
        flowchart: {
          useMaxWidth: false,
          diagramPadding: 12,
        },
      });
      await mermaid.parse(diagram);
      const { svg } = await mermaid.render(renderId, diagram);
      if (!isDrawableViewBox(viewBoxFromSvg(svg))) {
        throw new Error("The diagram rendered with no visible size. The source is below.");
      }
      if (cancelled) {
        return;
      }
      mountSvg(diagramHost, svg);
      setRenderState({ source: diagram, ready: true, error: null });
    }

    void draw(safeSource).catch((caught: unknown) => {
      if (cancelled) {
        return;
      }
      diagramHost.replaceChildren();
      setRenderState({
        source: safeSource,
        ready: false,
        error: readRenderError(caught),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [reactId, safeSource, scheme]);

  return (
    <div className="panel-body panel-diagram">
      <div className="diagram-toolbar">
        <div className="diagram-zoom" role="group" aria-label="Diagram zoom">
          <button type="button" onClick={() => setZoom((value) => stepZoom(value, -1))} aria-label="Zoom out">
            −
          </button>
          <button type="button" onClick={() => setZoom(1)} aria-label="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={() => setZoom((value) => stepZoom(value, 1))} aria-label="Zoom in">
            +
          </button>
        </div>
        <CopyButton text={source} label="Copy source" />
      </div>
      {safeSource && !ready && !renderError ? <p className="muted">Rendering diagram…</p> : null}
      {error ? (
        <p className="diagram-error" role="alert">
          {error}
        </p>
      ) : null}
      {safeSource ? (
        <div className="diagram-frame">
          <div
            className="diagram-scale"
            style={{ width: `${zoom * 100}%` }}
            ref={hostRef}
            role="img"
            aria-label="Architecture diagram"
            aria-busy={!ready && !renderError}
          />
        </div>
      ) : null}
      <button
        type="button"
        className="source-toggle"
        aria-expanded={sourceVisible}
        onClick={() => setSourceChoice(sourceVisible ? "closed" : "open")}
      >
        {sourceVisible ? "Hide source" : "Show source"}
      </button>
      {sourceVisible ? (
        <pre className="source-block">
          <code>{source || "(empty)"}</code>
        </pre>
      ) : null}
    </div>
  );
}

function useColorScheme(): "dark" | "light" {
  const [scheme, setScheme] = useState<"dark" | "light">(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setScheme(media.matches ? "dark" : "light");
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return scheme;
}

function stepZoom(value: number, direction: -1 | 1): number {
  const next = Math.round((value + direction * 0.25) * 100) / 100;
  return Math.min(2, Math.max(0.75, next));
}

function readRenderError(caught: unknown): string {
  const raw =
    caught instanceof Error
      ? caught.message
      : typeof caught === "string"
        ? caught
        : "The diagram could not be rendered.";
  const line = raw.split("\n")[0]?.trim() || "The diagram could not be rendered.";
  return line.length > 280 ? `${line.slice(0, 277)}…` : line;
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
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || attribute.value.trim().toLowerCase().startsWith("javascript:")) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  const box = readViewBox(root.getAttribute("viewBox"));
  if (!isDrawableViewBox(box)) {
    throw new Error("The diagram rendered with no visible size. The source is below.");
  }
  root.setAttribute("preserveAspectRatio", "xMidYMid meet");
  root.setAttribute("width", "100%");
  root.setAttribute("height", String(Math.round(box.height)));
  if (root instanceof SVGElement) {
    root.style.width = "100%";
    root.style.height = "auto";
    root.style.maxWidth = "100%";
    root.style.aspectRatio = `${box.width} / ${box.height}`;
  }
  host.replaceChildren(document.importNode(root, true));
}
