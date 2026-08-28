import type { Look } from "../net/identity";
import "./Avatar.css";

/**
 * A profile picture without a photo.
 *
 * With no `look` the avatar is *derived*: the identity id picks a hue pair and
 * the nickname's first character sits on top. Same person, same face, on every
 * device and with no network - the only kind of avatar that can exist before
 * you have signed in.
 *
 * With a `look` it is chosen: an emoji and a hue the player picked. Still two
 * small values rather than an upload, so it costs no bucket and travels with
 * the profile row.
 */

/** FNV-1a, small and stable. Same string must always give the same face. */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export default function Avatar({
  id,
  nickname,
  look,
  size = 36,
}: {
  id: string;
  nickname: string;
  /** a chosen face; omit for the one derived from the id */
  look?: Look | null;
  size?: number;
}) {
  const h = hash(id);
  const hue = look ? look.hue : h % 360;
  // A second hue a third of the wheel away, so the gradient reads as two
  // colours rather than one colour going slightly darker.
  const hue2 = (hue + 120 + (h % 60)) % 360;
  const initial = look ? look.emoji : [...nickname.trim()][0] ?? "나";

  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        // an emoji has its own margins built in, so it needs the smaller box
        fontSize: size * (look ? 0.54 : 0.44),
        background: `linear-gradient(135deg,
          hsl(${hue} 52% 46%),
          hsl(${hue2} 48% 34%))`,
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
