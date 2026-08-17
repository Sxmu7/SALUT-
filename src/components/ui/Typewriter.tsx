"use client";

import { useEffect, useState } from "react";

/**
 * Tippt einen Text Buchstabe für Buchstabe, mit blinkendem Cursor.
 * Startet erst nach `startDelay` ms und läuft rein über state/effects,
 * damit die Server- und Client-Erstausgabe identisch bleiben (kein
 * Zugriff auf Browser-APIs im Render).
 */
export function Typewriter({
  text,
  speed = 90,
  startDelay = 200,
  cursor = true,
  className,
  onDone,
}: {
  text: string;
  speed?: number;
  startDelay?: number;
  cursor?: boolean;
  className?: string;
  onDone?: () => void;
}) {
  const [count, setCount] = useState(0);
  const [cursorOn, setCursorOn] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let charIndex = 0;
    let typeInterval: ReturnType<typeof setInterval> | undefined;

    const startTimeout = setTimeout(() => {
      typeInterval = setInterval(() => {
        charIndex += 1;
        setCount(charIndex);
        if (charIndex >= text.length) {
          clearInterval(typeInterval);
          setDone(true);
          onDone?.();
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(startTimeout);
      if (typeInterval) clearInterval(typeInterval);
    };
    // onDone intentionally excluded: it's a fire-once callback, not a value
    // this effect should re-run for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed, startDelay]);

  useEffect(() => {
    if (!cursor) return;
    const blink = setInterval(() => setCursorOn((v) => !v), 480);
    return () => clearInterval(blink);
  }, [cursor]);

  return (
    <span className={className}>
      {text.slice(0, count)}
      {cursor && (
        <span
          aria-hidden
          style={{ opacity: done ? 0 : cursorOn ? 1 : 0 }}
          className="inline-block ml-0.5"
        >
          |
        </span>
      )}
    </span>
  );
}
