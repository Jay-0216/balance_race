import { useCallback, useEffect, useRef, useState } from "react";
import {
  createRoom, hostToken, joinRoom, leaveRoom, listPlayers, MAX_SEATS, mySeat,
  readRoom, startRoom, watchRoom, type PlayerRow, type RoomRow,
} from "../net/rooms";
import { getIdentity, setNickname } from "../net/identity";
import { PLAYER_COLORS } from "../game/setup";
import { isOnlineAvailable, supabase } from "../net/supabase";
import Offline from "../ui/Offline";
import "../ui/Form.css";
import "./LobbyScreen.css";

/**
 * Make a room or walk into one, then wait for people.
 *
 * The lobby used to be the end of the road - it gathered a table and had
 * nowhere to send it, because the online round loop did not exist. It does
 * now, so this screen's only remaining job is the bit it was always good at:
 * showing that the code you read out loud actually worked.
 *
 * Empty seats become bots at the start, not before: filling them earlier would
 * mean throwing a bot out every time a friend arrived.
 */
export default function LobbyScreen({
  onPlay,
  onBack,
}: {
  onPlay: (code: string) => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [entry, setEntry] = useState("");
  const [nick, setNick] = useState(() => getIdentity().nickname);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chanRef = useRef<ReturnType<ReturnType<typeof supabase>["channel"]> | null>(null);

  const online = isOnlineAvailable();
  const iAmHost = !!code && !!hostToken(code);
  const seat = code ? mySeat(code)?.seat ?? null : null;

  const refresh = useCallback(async (room: string) => {
    try {
      setPlayers(await listPlayers(room));
    } catch (e) {
      setError(message(e));
    }
  }, []);

  // people arriving is the only feedback that the code worked
  useEffect(() => {
    if (!code || !online) return;
    const ch = supabase()
      .channel(`lobby:${code}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_code=eq.${code}` },
        () => void refresh(code))
      .subscribe();
    chanRef.current = ch;
    void refresh(code);
    const poll = window.setInterval(() => void refresh(code), 2500);
    return () => {
      window.clearInterval(poll);
      void supabase().removeChannel(ch);
      chanRef.current = null;
    };
  }, [code, online, refresh]);

  // the room row is what says "we have started" - to everyone at once
  useEffect(() => {
    if (!code) return;
    return watchRoom(code, setRoom);
  }, [code]);

  useEffect(() => {
    if (room?.status === "playing" && code) onPlay(code);
  }, [room?.status, code, onPlay]);

  // a closed tab should free the seat rather than park a ghost in it
  useEffect(() => {
    if (!code) return;
    const bye = () => void leaveRoom(code);
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, [code]);

  const host = async () => {
    setBusy(true); setError(null);
    try {
      const saved = setNickname(nick);
      const made = await createRoom(saved.nickname);
      setCode(made.code);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };

  const join = async () => {
    setBusy(true); setError(null);
    try {
      const saved = setNickname(nick);
      const typed = entry.trim().toUpperCase();
      const found = await readRoom(typed);
      if (!found) throw new Error("그런 방이 없다. 코드를 확인해줘.");
      await joinRoom(typed, saved.nickname);
      setCode(typed);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };

  const start = async () => {
    if (!code) return;
    setBusy(true); setError(null);
    try {
      await startRoom(code, players);
      onPlay(code);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };

  const quit = async () => {
    if (code) await leaveRoom(code);
    onBack();
  };

  if (!online) {
    return (
      <Frame title="같이 하기" onBack={onBack}>
        <Offline what="친구랑 같이 할 수" />
      </Frame>
    );
  }

  if (!code) {
    return (
      <Frame title="같이 하기" onBack={onBack} lead="방을 만들어 코드를 불러주거나, 받은 코드로 들어가면 된다.">
        <div className="field">
          <label htmlFor="lb-nick">이름</label>
          <input id="lb-nick" value={nick} maxLength={8}
            onChange={(e) => setNick(e.target.value)} placeholder="8글자까지" />
        </div>
        <div className="form-actions">
          <button className="btn-go" onClick={() => void host()} disabled={busy || !nick.trim()}>
            {busy ? "만드는 중…" : "방 만들기"}
          </button>
        </div>

        <p className="lb-or">또는</p>

        <div className="field">
          <label htmlFor="lb-code">받은 코드</label>
          <input id="lb-code" className="lb-code" value={entry} maxLength={6}
            autoCapitalize="characters" autoCorrect="off" spellCheck={false}
            onChange={(e) => setEntry(e.target.value.toUpperCase())} placeholder="ABC123" />
        </div>
        <div className="form-actions">
          <button className="btn-quiet" onClick={() => void join()}
            disabled={busy || entry.trim().length < 4 || !nick.trim()}>
            들어가기
          </button>
        </div>
        {error && <p className="form-msg bad">{error}</p>}
      </Frame>
    );
  }

  const bots = MAX_SEATS - players.length;

  return (
    <Frame title="기다리는 중" onBack={() => void quit()}>
      <div className="lb-codecard">
        <div>
          <span>방 코드</span>
          <b>{code}</b>
        </div>
        <span className="lb-count">{players.length}명</span>
      </div>

      <ul className="lb-seats">
        {players.map((p) => (
          <li key={p.player_id} className={p.seat === seat ? "me" : ""}>
            <span className="lb-dot" style={{ background: PLAYER_COLORS[p.seat % PLAYER_COLORS.length] }} />
            {p.nickname}
            {p.seat === seat && <span className="lb-you">나</span>}
          </li>
        ))}
      </ul>

      <p className="lb-note">
        {bots > 0
          ? `빈 자리 ${bots}개는 시작할 때 봇이 채운다.`
          : "자리가 다 찼다."}
      </p>

      {iAmHost ? (
        <div className="form-actions">
          <button className="btn-go" onClick={() => void start()} disabled={busy}>
            {busy ? "시작하는 중…" : "시작하기"}
          </button>
        </div>
      ) : (
        <p className="lb-note">방장이 시작하기를 기다리는 중…</p>
      )}

      {error && <p className="form-msg bad">{error}</p>}
    </Frame>
  );
}

function Frame({
  children, title, lead, onBack,
}: {
  children: React.ReactNode; title: string; lead?: string; onBack: () => void;
}) {
  return (
    <div className="form-screen">
      <header className="form-head">
        <button className="form-back" onClick={onBack} aria-label="뒤로">←</button>
        <div className="form-title">
          <span className="form-eyebrow">레이스 방</span>
          <h2>{title}</h2>
          {lead && <p>{lead}</p>}
        </div>
      </header>
      <div className="form-body">{children}</div>
    </div>
  );
}

function message(e: unknown) {
  const t = e instanceof Error ? e.message : String(e);
  if (t.includes("no such room")) return "그런 방이 없다. 코드를 확인해줘.";
  if (t.includes("already started")) return "이미 시작한 방이다.";
  if (t.includes("room is full")) return "방이 가득 찼다.";
  if (t.includes("not the host")) return "이 기기는 이 방의 방장이 아니다.";
  return t;
}
