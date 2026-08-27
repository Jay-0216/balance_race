import { useEffect, useState } from "react";
import "./Stamp.css";

export type StampKind = "majority" | "minority" | "tie" | null;

const LABEL: Record<Exclude<StampKind, null>, string> = {
  majority: "다수!",
  minority: "소수…",
  tie: "동점!",
};

/**
 * The moment the round turns. It lands hard and leaves quickly - the point is
 * the hit, not the reading, so the word is short enough to take in at a glance.
 */
export default function Stamp({ kind, at }: { kind: StampKind; at: number }) {
  const [shown, setShown] = useState<{ kind: StampKind; at: number }>({ kind: null, at: 0 });

  useEffect(() => {
    if (!kind) return;
    setShown({ kind, at });
    const id = window.setTimeout(() => setShown({ kind: null, at: 0 }), 950);
    return () => clearTimeout(id);
  }, [kind, at]);

  if (!shown.kind) return null;
  return (
    <div key={shown.at} className={"stamp " + shown.kind} aria-hidden="true">
      {LABEL[shown.kind]}
    </div>
  );
}
