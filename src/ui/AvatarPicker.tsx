import { useRef, useState } from "react";
import Avatar from "./Avatar";
import type { Look } from "../net/identity";
import { PHOTO_MESSAGE, PhotoProblem, toAvatarDataUrl } from "./photo";
import "./AvatarPicker.css";

/**
 * Sixteen faces and eight colours.
 *
 * Plus your own photo, if you would rather. The picture is cropped, shrunk to
 * 128px and re-encoded here, in the browser, before it is stored anywhere -
 * so it needs no storage bucket, carries no EXIF location, and (because a
 * profile row is readable only by its owner) is seen by nobody but you.
 *
 * The grid stays the default because it is the only version that works
 * offline, before login, and on the very first launch - which is exactly when
 * people want to set a face.
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
  photo,
  onChange,
  onPhoto,
}: {
  id: string;
  nickname: string;
  look: Look | null;
  photo: string | null;
  /** null means "go back to the face derived from my id" */
  onChange: (look: Look | null) => void;
  onPhoto: (photo: string | null) => void;
}) {
  // Remembered so that picking a face, then a colour, does not reset the hue
  // to a default the player already moved away from.
  const [hue, setHue] = useState(look?.hue ?? HUES[0]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Choosing a drawn face puts the photo away rather than hiding behind it -
  // otherwise the grid would look broken, every tap doing nothing visible.
  const pickFace = (emoji: string) => {
    onPhoto(null);
    if (look?.emoji === emoji && !photo) onChange(null);   // tap again to go back
    else onChange({ emoji, hue });
  };

  const pickHue = (h: number) => {
    setHue(h);
    onPhoto(null);
    onChange({ emoji: look?.emoji ?? FACES[0], hue: h });
  };

  const takeFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      onPhoto(await toAvatarDataUrl(file));
    } catch (e) {
      setError(e instanceof PhotoProblem ? PHOTO_MESSAGE[e.kind] : PHOTO_MESSAGE.decode);
    } finally {
      // cleared so picking the same file twice still fires a change event
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="pick">
      <div className="pick-row" role="group" aria-label="얼굴">
        {/* your own picture, first, because it is the one people look for */}
        <label className={"pick-face pick-file" + (photo ? " on" : "")} title="사진 넣기">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => void takeFile(e.target.files?.[0])}
          />
          {photo
            ? <Avatar id={id} nickname={nickname} photo={photo} size={38} />
            : <span className="pick-plus" aria-hidden="true">＋</span>}
          <span className="sr-only">사진 넣기</span>
        </label>

        {/* the derived face is one of the options, not a hidden default */}
        <button
          type="button"
          className={"pick-face" + (!look && !photo ? " on" : "")}
          onClick={() => { onPhoto(null); onChange(null); }}
          aria-pressed={!look && !photo}
          title="이름 첫 글자로"
        >
          <Avatar id={id} nickname={nickname} size={38} />
        </button>
        {FACES.map((f) => (
          <button
            type="button"
            key={f}
            className={"pick-face" + (!photo && look?.emoji === f ? " on" : "")}
            onClick={() => pickFace(f)}
            aria-pressed={!photo && look?.emoji === f}
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
            className={"pick-hue" + (!photo && look?.hue === h ? " on" : "")}
            onClick={() => pickHue(h)}
            aria-pressed={!photo && look?.hue === h}
            aria-label={`색 ${h}`}
            style={{ background: `linear-gradient(135deg, hsl(${h} 52% 46%), hsl(${(h + 120) % 360} 48% 34%))` }}
          />
        ))}
      </div>
      {error && <span className="pick-bad">{error}</span>}
      <span className="hint">
        {photo
          ? "사진은 이 기기 안에서 128px로 줄여서 저장한다. 로그인하면 내 계정에만 붙고, 다른 사람은 못 본다."
          : look
            ? "같은 얼굴을 다시 누르면 이름 첫 글자로 돌아간다. ＋로 사진도 넣을 수 있다."
            : "얼굴을 고르면 색도 고를 수 있다. ＋를 누르면 내 사진을 넣는다."}
      </span>
    </div>
  );
}
