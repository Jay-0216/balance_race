import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  currentSession, loadAccount, onAuthChange, saveLook, saveNickname, savePhoto,
  sendMagicLink, signOut, type Account,
} from "../net/auth";
import FeedbackSection from "../ui/FeedbackSection";
import GarageSection from "../ui/GarageSection";
import { getIdentity, setLook, setNickname, setPhoto, type Look } from "../net/identity";
import { isOnlineAvailable } from "../net/supabase";
import Avatar from "../ui/Avatar";
import AvatarPicker from "../ui/AvatarPicker";
import Offline from "../ui/Offline";
import "../ui/Form.css";

/**
 * Signing in is optional, and the screen says so in as many words. The
 * nickname field works either way - saved to this browser when you are a
 * guest, saved to your profile once you are not - so a player who never signs
 * in loses nothing except carrying that name to another device.
 */
export default function LoginScreen({ onBack, onShop }: { onBack: () => void; onShop: () => void }) {
  const [nick, setNick] = useState(() => getIdentity().nickname);
  const [look, setLookState] = useState<Look | null>(() => getIdentity().look);
  const [photo, setPhotoState] = useState<string | null>(() => getIdentity().photo);
  const myId = getIdentity().id;
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
      // The profile row wins over this browser's copy: that is the whole
      // point of signing in. Only when the account has no face yet does the
      // guest's choice get pushed up, so picking one before logging in is
      // not thrown away by logging in.
      if (acc.look || acc.photo) {
        setLookState(acc.look);
        setPhotoState(acc.photo);
        setLook(acc.look);
        setPhoto(acc.photo);
      } else {
        const me = getIdentity();
        setLookState(me.look);
        setPhotoState(me.photo);
        if (me.look) void saveLook(acc.userId, me.look);
        if (me.photo) void savePhoto(acc.userId, me.photo);
      }
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

  // Saved on the spot: a face has no "save" button to forget to press.
  const applyLook = (next: Look | null) => {
    setLookState(next);
    setLook(next);
    if (account) void saveLook(account.userId, next);
  };

  const applyPhoto = (next: string | null) => {
    const saved = setPhoto(next);
    setPhotoState(saved.photo);
    if (account) void savePhoto(account.userId, saved.photo);
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
        {/* The face reacts to the name as you type it, so it is obvious that
            the two are the same thing. */}
        <div className="lg-me">
          <Avatar id={myId} nickname={nick || "나"} look={look} photo={photo} size={56} />
          <div>
            <b>{nick.trim() || "나"}</b>
            <span>{account ? (account.email ?? "로그인됨") : "게스트"}</span>
          </div>
        </div>

        <div className="field">
          <label>프로필 사진</label>
          <AvatarPicker
            id={myId} nickname={nick || "나"}
            look={look} photo={photo}
            onChange={applyLook} onPhoto={applyPhoto}
          />
        </div>

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
          <Offline what="로그인은 할 수" />
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

        <GarageSection onShop={onShop} />

        <FeedbackSection />
      </div>

      {msg && <p className={"form-msg " + (msg.ok ? "ok" : "bad")}>{msg.text}</p>}
    </div>
  );
}
