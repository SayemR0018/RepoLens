"use client";

import { useEffect, useRef, useState } from "react";

export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
}) {
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    };
  }, []);

  function show(message: string) {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
    }
    setNote(message);
    timer.current = window.setTimeout(() => setNote(null), 1600);
  }

  return (
    <button
      type="button"
      className="copy-button"
      aria-live="polite"
      disabled={!text}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(
          () => show(copiedLabel),
          () => show("Copy failed"),
        );
      }}
    >
      {note ?? label}
    </button>
  );
}
