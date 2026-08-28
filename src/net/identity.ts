/**
 * Who "나" is.
 *
 * Today this is a nickname and a random id kept in this browser - no account,
 * no server, no password. It exists as its own module so that adding real
 * login later is a change to this file and nothing else: `getIdentity` starts
 * returning a Supabase session's user, `provider` stops being "local", and
 * every caller keeps working. The rest of the game only ever asks for an id
 * and a display name.
 */
export type Identity = {
  id: string;
  nickname: string;
  provider: "local" | "supabase";
  /** a chosen face, or null to keep the one derived from the id */
  look: Look | null;
};

/**
 * A picked profile picture.
 *
 * There is no upload and no storage bucket, and there deliberately still is
 * not one: a photo uploaded by a middle-schooler is a moderation problem, a
 * storage bill and a privacy question all at once, for a face that shows at
 * 38px. An emoji and a hue are two small values that need no bucket, cannot
 * carry anything a stranger should not see, and travel to another device as
 * eight bytes of profile row.
 */
export type Look = { emoji: string; hue: number };

const KEY = "ddr.identity";
const DEFAULT_NICKNAME = "나";

function randomId() {
  return "local-" + Math.random().toString(36).slice(2, 10);
}

/** localStorage throws outright in some embedded contexts, so never trust it. */
function read(): Identity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Identity>;
    if (!parsed.id || !parsed.nickname) return null;
    return {
      id: parsed.id,
      nickname: parsed.nickname,
      provider: "local",
      look: cleanLook(parsed.look),
    };
  } catch {
    return null;
  }
}

function write(identity: Identity) {
  try {
    localStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    // a private window just means the nickname does not survive a reload
  }
}

export function getIdentity(): Identity {
  const existing = read();
  if (existing) return existing;
  const fresh: Identity = {
    id: randomId(),
    nickname: DEFAULT_NICKNAME,
    provider: "local",
    look: null,
  };
  write(fresh);
  return fresh;
}

export function setNickname(nickname: string): Identity {
  const trimmed = nickname.trim().slice(0, 8) || DEFAULT_NICKNAME;
  const next: Identity = { ...getIdentity(), nickname: trimmed };
  write(next);
  return next;
}

/**
 * Anything at all can be in localStorage - an old shape, a hand-edited value,
 * a half-written write. A face is cosmetic, so a bad one falls back to the
 * derived face rather than throwing on the title screen.
 */
function cleanLook(v: unknown): Look | null {
  if (!v || typeof v !== "object") return null;
  const l = v as Partial<Look>;
  if (typeof l.emoji !== "string" || !l.emoji) return null;
  if (typeof l.hue !== "number" || !Number.isFinite(l.hue)) return null;
  return { emoji: [...l.emoji][0], hue: ((l.hue % 360) + 360) % 360 };
}

/** Picking a face, or null to go back to the one derived from the id. */
export function setLook(look: Look | null): Identity {
  const next: Identity = { ...getIdentity(), look: cleanLook(look) };
  write(next);
  return next;
}

/** True once a real account backs this identity. Nothing branches on it yet. */
export function isSignedIn(identity: Identity = getIdentity()) {
  return identity.provider !== "local";
}
