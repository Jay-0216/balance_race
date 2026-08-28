import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  currentSession, loadAccount, onAuthChange, saveNickname, sendMagicLink, signOut,
  type Account,
} from "../net/auth";
import { getIdentity, setNickname } from "../net/identity";
import { isOnlineAvailable } from "../net/supabase";
import "../ui/Form.css";

/**
 * Signing in is optional, and the screen says so in as many words. The
 * nickname field works either way - saved to this browser when you are a
 * guest, saved to your profile once you are not - so a player who never signs
 * in loses nothing except carrying that name to another device.
 */
export default function LoginScreen({ onBack }: { onBack: () => void }) {
  const [nick, setNick] = useState(() => getIdentity().nickname);
  const [email, setEmail] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const online = isOnlineAvailable();

  useEffect(() => {
    if (!online) return;
    let alive = true;
    const adopt = async (session: Session | null) => {
      if (!session) {
        if (alive) setAccount(null);
        return;
      }
      const acc = await loadAccount(session);
      if (!alive) return;
      setAccount(acc);
      setNick(acc.nickname);
      setNickname(acc.nickname);      // keep the local copy in step
    };
    currentSession().then(adopt);
    const off = onAuthChange(adopt);
    return () => { alive = false; off(); };
  }, [online]);

  const applyNick = () => {
    const saved = setNickname(nick);
    setNick(saved.nickname);
    if (account) void saveNickname(account.userId, saved.nickname);
    setMsg({ ok: true, text: `이제 "${saved.nickname}"으로 달린다.` });
  };

  const link = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await sendMagicLink(email.trim());
      setMsg({ ok: true, text: "메일함을 확인해봐. 링크를 누르면 이 화면으로 돌아온다." });
    } catch (e) {
      setMsg({
        ok: false,
        text: "메일을 못 보냈다. 주소를 확인하거나 몇 분 뒤에 다시 해봐. (" + String(e) + ")",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-screen">
      <header className="form-head">
        <button className="form-back" onClick={onBack} aria-label="뒤로">←</button>
        <div className="form-title">
          <span className="form-eyebrow">계정</span>
          <h2>{account ? "로그인됨" : "이름부터 정하자"}</h2>
          <p>
            {account
              ? "이 계정으로 어느 기기에서 들어와도 같은 이름으로 달린다."
              : "로그인은 선택이다. 안 해도 전부 할 수 있고, 하면 이름이 기기를 따라온다."}
          </p>
        </div>
      </header>

      <div className="form-body">
        <div className="field">
          <label htmlFor="lg-nick">이름</label>
          <input
            id="lg-nick" value={nick} maxLength={8}
            onChange={(e) => setNick(e.target.value)}
            placeholder="8글자까지"
          />
          <span className="hint">트랙 위와 순위표에 이 이름이 나온다.</span>
        </div>
        <div className="form-actions">
          <button className="btn-go" onClick={applyNick} disabled={!nick.trim()}>이름 저장</button>
        </div>

        {!online ? (
          <p className="form-offline">
            서버가 연결되지 않아서 로그인은 아직 못 한다. 이름은 이 브라우저에 저장된다.
          </p>
        ) : account ? (
          <>
            <p className="form-offline">
              <b>{account.email ?? "계정"}</b>으로 로그인되어 있다.
            </p>
            <div className="form-actions">
              <button className="btn-quiet" onClick={() => void signOut()}>로그아웃</button>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="lg-mail">이메일로 로그인 (선택)</label>
              <input
                id="lg-mail" type="email" value={email} inputMode="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <span className="hint">
                비밀번호는 없다. 메일로 온 링크를 누르면 그대로 로그인된다.
              </span>
            </div>
            <div className="form-actions">
              <button className="btn-go" disabled={!email.includes("@") || busy} onClick={link}>
                {busy ? "보내는 중…" : "로그인 링크 받기"}
              </button>
            </div>
          </>
        )}
      </div>

      {msg && <p className={"form-msg " + (msg.ok ? "ok" : "bad")}>{msg.text}</p>}
    </div>
  );
}
