import "./Avatar.css";

/**
 * A profile picture without a profile picture.
 *
 * There is no upload and no storage bucket, so the avatar is *derived*: the
 * identity id picks a hue and a pattern, the nickname's first character sits
 * on top. Same person, same face, on every device and with no network - which
 * is the only kind of avatar that can appear before you have signed in.
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
  size = 36,
}: {
  id: string;
  nickname: string;
  size?: number;
}) {
  const h = hash(id);
  const hue = h % 360;
  // A second hue a third of the wheel away, so the gradient reads as two
  // colours rather than one colour going slightly darker.
  const hue2 = (hue + 120 + (h % 60)) % 360;
  const initial = [...nickname.trim()][0] ?? "나";

  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.44,
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
