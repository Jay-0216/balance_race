import { useEffect, useState } from "react";
import type { SideStory } from "../game/rules";
import "./Stamp.css";

/**
 * Which side you were on, and whether that moved you.
 *
 * These are two different questions, and treating them as one was a real bug:
 * the stamp asked only "did I advance", so on a reverse round - the round
 * where the minority is the one that moves - picking the small side printed
 * 다수!, and picking the big side printed 소수…. Both exactly backwards, on
 * the one round in the game where a player most needs to be told what just
 * happened to them.
 *
 * So the stamp now carries both facts. On a reverse round being in the
 * minority is a win, and it says so.
 */
export type StampKind = SideStory | null;

/** [quiet lead-in, the part that lands] - the lead-in is optional. */
const LABEL: Record<SideStory, [string, string]> = {
  "majority-ahead": ["", "다수!"],
  "minority-ahead": ["소수…", "지만 앞으로!"],
  "majority-stuck": ["다수…", "인데 제자리"],
  "minority-stuck": ["", "소수…"],
  tie: ["", "동점!"],
};

/**
 * The moment the round turns. It lands hard and leaves quickly - the point is
 * the hit, not the reading, so the words are short enough to take in at a
 * glance even when there are two of them.
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
  const [lead, hit] = LABEL[shown.kind];

  return (
    <div key={shown.at} className={"stamp " + shown.kind} aria-hidden="true">
      {lead && <i className="stamp-lead">{lead}</i>}
      <b className="stamp-hit">{hit}</b>
    </div>
  );
}
