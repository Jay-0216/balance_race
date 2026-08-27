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
};

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
    return { id: parsed.id, nickname: parsed.nickname, provider: "local" };
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

/** True once a real account backs this identity. Nothing branches on it yet. */
export function isSignedIn(identity: Identity = getIdentity()) {
  return identity.provider !== "local";
}
