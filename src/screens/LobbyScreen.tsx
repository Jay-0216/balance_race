import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_SEATS, createRoom, joinRoom, leaveRoom, listPlayers, type PlayerRow } from "../net/rooms";
import { getIdentity, setNickname } from "../net/identity";
import { isOnlineAvailable, supabase } from "../net/supabase";
import Offline from "../ui/Offline";
import "./LobbyScreen.css";

export type LobbyMode = "host" | "join";

/**
 * Create or join a room and wait for people. Everything here is realtime on
 * the players table - a seat filling in is the only feedback that the code you
 * read out loud actually worked.
 */
export default function LobbyScreen({
  mode,
  onBack,
}: {
  mode: LobbyMode;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [entry, setEntry] = useState("");
  const [nick, setNick] = useState(() => getIdentity().nickname);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof supabase>["channel"]> | null>(null);

  const me = getIdentity();
  const configured = isOnlineAvailable();

  const refresh = useCallback(async (room: string) => {
    try {
      setPlayers(await listPlayers(room));
    } catch (e) {
      setError(message(e));
    }
  }, []);

  // subscribe once we are actually in a room
  useEffect(() => {
    if (!code || !configured) return;
    const ch = supabase()
      .channel(`room:${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_code=eq.${code}` },
        () => void refresh(code)
      )
      .subscribe();
    channelRef.current = ch;
    void refresh(code);

    return () => {
      void supabase().removeChannel(ch);
      channelRef.current = null;
    };
  }, [code, configured, refresh]);

  // leaving the tab should free the seat rather than park a ghost in it
  useEffect(() => {
    if (!code) return;
    const bye = () => void leaveRoom(code);
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, [code]);

  const host = async () => {
    setBusy(true);
    setError(null);
    try {
      setNickname(nick);
      const room = await createRoom();
      setCode(room.code);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      setNickname(nick);
      const room = await joinRoom(entry.trim().toUpperCase());
      setCode(room.code);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const quit = async () => {
    if (code) await leaveRoom(code);
    onBack();
  };

  if (!configured) {
    return (
      <Frame title={mode === "host" ? "방 만들기" : "참가하기"} onBack={onBack}>
        <Offline what="친구랑 같이 할 수" />
      </Frame>
    );
  }

  if (!code) {
    return (
      <Frame title={mode === "host" ? "방 만들기" : "참가하기"} onBack={onBack}>
        <label className="lobby-field">
          <span>닉네임</span>
          <input
            value={nick}
            maxLength={8}
            onChange={(e) => setNick(e.target.value)}
            placeholder="나"
          />
        </label>

        {mode === "join" && (
          <label className="lobby-field">
            <span>방 코드</span>
            <input
              className="lobby-code-input"
              value={entry}
              maxLength={6}
              autoCapitalize="characters"
              onChange={(e) => setEntry(e.target.value.toUpperCase())}
              placeholder="ABC123"
            />
          </label>
        )}

        {error && <p className="lobby-error">{error}</p>}

        <button
          className="lobby-go"
          disabled={busy || (mode === "join" && entry.trim().length < 6)}
          onClick={mode === "host" ? host : join}
        >
          {busy ? "잠시만…" : mode === "host" ? "방 만들기" : "들어가기"}
        </button>
      </Frame>
    );
  }

  return (
    <Frame title="대기실" onBack={quit}>
      <div className="lobby-code">
        <span className="lobby-code-label">방 코드</span>
        <strong>{code}</strong>
        <button
          className="lobby-copy"
          onClick={() => void navigator.clipboard?.writeText(code)}
        >
          복사
        </button>
      </div>

      <ol className="lobby-seats">
        {Array.from({ length: MAX_SEATS }, (_, seat) => {
          const p = players.find((x) => x.seat === seat);
          return (
            <li key={seat} className={p ? "taken" : "empty"}>
              <span className="lobby-dot" style={{ background: p?.color ?? "transparent" }} />
              <span className="lobby-name">
                {p ? p.nickname : "봇으로 채움"}
                {p?.player_id === me.id && <em> (나)</em>}
              </span>
            </li>
          );
        })}
      </ol>

      {error && <p className="lobby-error">{error}</p>}

      <p className="lobby-note dim">
        {players.length}명 참가 · 빈 자리는 시작할 때 봇으로 채워집니다.
      </p>
      <p className="lobby-note dim">
        온라인 대국 진행은 다음 단계입니다 — 지금은 방과 참가까지 동작합니다.
      </p>
    </Frame>
  );
}

function Frame({
  title, onBack, children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="lobby">
      <header className="lobby-bar">
        <button className="lobby-back" onClick={onBack} aria-label="뒤로">←</button>
        <span>{title}</span>
      </header>
      <div className="lobby-body">{children}</div>
    </div>
  );
}

function message(e: unknown) {
  return e instanceof Error ? e.message : "알 수 없는 오류가 났습니다.";
}
