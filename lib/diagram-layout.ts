export type ViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const MIN_DRAWABLE = 24;

export function readViewBox(value: string | null | undefined): ViewBox | null {
  if (!value) {
    return null;
  }
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
}

/** A 16×16 box is the padding-only SVG Mermaid emits when measurement happens in a hidden node. */
export function isDrawableViewBox(box: ViewBox | null): box is ViewBox {
  return box !== null && box.width >= MIN_DRAWABLE && box.height >= MIN_DRAWABLE;
}

export function viewBoxFromSvg(svg: string): ViewBox | null {
  const match = /viewBox\s*=\s*"([^"]+)"/i.exec(svg) ?? /viewBox\s*=\s*'([^']+)'/i.exec(svg);
  return readViewBox(match?.[1] ?? null);
}
