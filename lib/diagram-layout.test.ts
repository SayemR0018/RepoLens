import assert from "node:assert/strict";
import test from "node:test";
import { isDrawableViewBox, readViewBox, viewBoxFromSvg } from "./diagram-layout";

test("reads a viewBox with spaces or commas", () => {
  assert.deepEqual(readViewBox("4 4 552 440"), { x: 4, y: 4, width: 552, height: 440 });
  assert.deepEqual(readViewBox("0,0,100,80"), { x: 0, y: 0, width: 100, height: 80 });
  assert.equal(readViewBox(""), null);
  assert.equal(readViewBox("1 2 3"), null);
});

test("rejects the padding-only box from a hidden render", () => {
  assert.equal(isDrawableViewBox(readViewBox("-8 -8 16 16")), false);
  assert.equal(isDrawableViewBox(readViewBox("4 4 168 220")), true);
  assert.equal(isDrawableViewBox(null), false);
});

test("reads the viewBox from an SVG string", () => {
  const svg = '<svg viewBox="4 4 168 240" width="100%"></svg>';
  assert.equal(isDrawableViewBox(viewBoxFromSvg(svg)), true);
  assert.equal(viewBoxFromSvg("<svg></svg>"), null);
});
