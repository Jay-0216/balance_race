import { useState } from "react";
import Avatar from "./Avatar";
import type { Look } from "../net/identity";
import "./AvatarPicker.css";

/**
 * Sixteen faces and eight colours.
 *
 * Not an upload: a photo from a middle-schooler is a moderation problem, a
 * storage bill and a privacy question at once, for something that renders at
 * 38px on a name plate. A fixed grid is also the only version that works
 * offline, before login, and on the first launch - which is when people
 * actually want to set it.
 */
const FACES = [
  "🦊", "🐸", "🐼", "🐯", "🐧", "🦁", "🐙", "🦖",
  "👾", "🤖", "👽", "🍕", "⚡", "🔥", "🌙", "⭐",
];

/** Evenly around the wheel, skipping the muddy stretch nothing reads well in. */
const HUES = [8, 32, 52, 96, 152, 196, 232, 288];

export default function AvatarPicker({
  id,
  nickname,
  look,
  onChange,
}: {
  id: string;
  nickname: string;
  look: Look | null;
  /** null means "go back to the face derived from my id" */
  onChange: (look: Look | null) => void;
}) {
  // Remembered so that picking a face, then a colour, does not reset the hue
  // to a default the player already moved away from.
  const [hue, setHue] = useState(look?.hue ?? HUES[0]);

  const pickFace = (emoji: string) => {
    if (look?.emoji === emoji) onChange(null);        // tap again to go back
    else onChange({ emoji, hue });
  };

  const pickHue = (h: number) => {
    setHue(h);
    onChange({ emoji: look?.emoji ?? FACES[0], hue: h });
  };

  return (
    <div className="pick">
      <div className="pick-row" role="group" aria-label="얼굴">
        {/* the derived face is one of the options, not a hidden default */}
        <button
          type="button"
          className={"pick-face" + (look ? "" : " on")}
          onClick={() => onChange(null)}
          aria-pressed={!look}
          title="이름 첫 글자로"
        >
          <Avatar id={id} nickname={nickname} size={38} />
        </button>
        {FACES.map((f) => (
          <button
            type="button"
            key={f}
            className={"pick-face" + (look?.emoji === f ? " on" : "")}
            onClick={() => pickFace(f)}
            aria-pressed={look?.emoji === f}
            aria-label={f}
          >
            <Avatar id={id} nickname={nickname} look={{ emoji: f, hue }} size={38} />
          </button>
        ))}
      </div>

      <div className="pick-row hues" role="group" aria-label="색">
        {HUES.map((h) => (
          <button
            type="button"
            key={h}
            className={"pick-hue" + (look && look.hue === h ? " on" : "")}
            onClick={() => pickHue(h)}
            aria-pressed={!!look && look.hue === h}
            aria-label={`색 ${h}`}
            style={{ background: `linear-gradient(135deg, hsl(${h} 52% 46%), hsl(${(h + 120) % 360} 48% 34%))` }}
          />
        ))}
      </div>
      <span className="hint">
        {look ? "같은 얼굴을 다시 누르면 이름 첫 글자로 돌아간다." : "얼굴을 고르면 색도 고를 수 있다."}
      </span>
    </div>
  );
}
