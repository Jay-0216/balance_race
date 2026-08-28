import { useState } from "react";
import { sendFeedback, type FeedbackKind } from "../net/submissions";
import { isOnlineAvailable } from "../net/supabase";
import Offline from "./Offline";
import "./Form.css";
import "./FeedbackSection.css";

/**
 * Bug reports and ideas, filed straight into the database. There is no select
 * policy on that table, so a report can be written by anyone and read by
 * nobody but the owner in the dashboard - which is the right shape for a form
 * that strangers can reach.
 *
 * A section, not a screen. It sits inside the account page because that is
 * where you already are when something has gone wrong and you want to tell
 * somebody - and because a top-level "버그 제보" row read like a mode you
 * could play.
 */
export default function FeedbackSection() {
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [body, setBody] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const online = isOnlineAvailable();
  const ready = body.trim().length >= 5 && !busy;

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setMsg(null);
    try {
      await sendFeedback({ kind, body, contact });
      setBody("");
      setContact("");
      setMsg({ ok: true, text: "보냈다. 고맙다 — 확인하고 고칠게." });
    } catch (e) {
      setMsg({ ok: false, text: "보내지 못했다. 잠시 뒤에 다시 눌러줘. (" + String(e) + ")" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="fb">
      <h3 className="fb-head">이상한 게 있었어?</h3>
      <p className="fb-sub">어떤 화면에서, 뭘 눌렀을 때, 뭐가 일어났는지 적어주면 제일 빨리 고쳐진다.</p>

      {!online ? (
        <Offline what="제보를 보낼 수" />
      ) : (
        <>
          <div className="fb-body">
            <div className="field">
              <label>무엇에 대한 이야기야?</label>
              <div className="seg">
                <button aria-pressed={kind === "bug"} onClick={() => setKind("bug")}>🐛 버그</button>
                <button aria-pressed={kind === "idea"} onClick={() => setKind("idea")}>💡 아이디어</button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="fb-body">내용</label>
              <textarea
                id="fb-body"
                value={body}
                maxLength={1000}
                onChange={(e) => setBody(e.target.value)}
                placeholder={
                  kind === "bug"
                    ? "예) 7라운드에서 부스터를 켜고 A를 골랐는데, 다수였는데도 2칸만 갔어."
                    : "예) 친구랑 같은 팀으로 하는 모드가 있으면 좋겠어."
                }
              />
              <span className="hint">{body.trim().length} / 1000 · 5글자 이상</span>
            </div>

            <div className="field">
              <label htmlFor="fb-contact">연락처 (선택)</label>
              <input
                id="fb-contact"
                value={contact}
                maxLength={120}
                onChange={(e) => setContact(e.target.value)}
                placeholder="답이 필요하면 남겨줘"
              />
            </div>

            <p className="form-offline">
              화면 크기와 브라우저 정보가 같이 저장된다. 재현할 때 필요해서다.
              이름이나 위치 같은 건 안 보낸다.
            </p>
          </div>

          {msg && <p className={"form-msg " + (msg.ok ? "ok" : "bad")}>{msg.text}</p>}

          <div className="form-actions">
            <button className="btn-go" disabled={!ready} onClick={submit}>
              {busy ? "보내는 중…" : "보내기"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
