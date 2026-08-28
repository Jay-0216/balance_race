import { useState } from "react";
import { getIdentity } from "../net/identity";
import { submitCard } from "../net/submissions";
import { isOnlineAvailable } from "../net/supabase";
import "../ui/Form.css";
import "./CardSubmitScreen.css";

/**
 * Write your own balance card.
 *
 * A submitted card is not in the game yet - it waits for approval, and until
 * then only its author can see it. That gate is not bureaucracy: the deck is
 * the whole game, and one card written to be unpickable ("숨쉬기 vs 죽기")
 * wastes a round for eight people.
 */
const CATEGORIES = ["학교", "친구", "가족", "음식", "미래", "돈", "자유"];

export default function CardSubmitScreen({ onBack }: { onBack: () => void }) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [aEmoji, setAEmoji] = useState("🅰️");
  const [aText, setAText] = useState("");
  const [bEmoji, setBEmoji] = useState("🅱️");
  const [bText, setBText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const online = isOnlineAvailable();
  const a = aText.trim();
  const b = bText.trim();
  const ready = a.length >= 2 && b.length >= 2 && a !== b && !busy;

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setMsg(null);
    try {
      await submitCard({
        category, aEmoji, aText, bEmoji, bText,
        author: getIdentity().nickname,
      });
      setAText("");
      setBText("");
      setMsg({ ok: true, text: "냈다. 확인되면 다음 판부터 카드에 섞여서 나온다." });
    } catch (e) {
      setMsg({ ok: false, text: "내지 못했다. 잠시 뒤에 다시 눌러줘. (" + String(e) + ")" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-screen">
      <header className="form-head">
        <button className="form-back" onClick={onBack} aria-label="뒤로">←</button>
        <div className="form-title">
          <span className="form-eyebrow">카드 만들기</span>
          <h2>밸런스 게임을 하나 써봐</h2>
          <p><b>둘 다 고를 만해야</b> 좋은 카드다. 한쪽이 명백히 정답이면 눈치싸움이 안 된다.</p>
        </div>
      </header>

      {!online ? (
        <p className="form-offline">
          아직 서버가 연결되지 않아서 카드를 낼 수 없다.
          <br />
          <code>.env.local</code>에 Supabase 키를 넣으면 켜진다 — <code>docs/SETUP.md</code>
        </p>
      ) : (
        <>
          <div className="form-body">
            <div className="field">
              <label htmlFor="cs-cat">분류</label>
              <select id="cs-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="card-side a">
              <span className="card-tag">A</span>
              <div className="card-row">
                <input
                  className="emoji" value={aEmoji} maxLength={4}
                  onChange={(e) => setAEmoji(e.target.value)} aria-label="A 이모지"
                />
                <input
                  value={aText} maxLength={40} onChange={(e) => setAText(e.target.value)}
                  placeholder="숙제 안 하고 놀기" aria-label="A 내용"
                />
              </div>
            </div>

            <span className="card-vs">VS</span>

            <div className="card-side b">
              <span className="card-tag">B</span>
              <div className="card-row">
                <input
                  className="emoji" value={bEmoji} maxLength={4}
                  onChange={(e) => setBEmoji(e.target.value)} aria-label="B 이모지"
                />
                <input
                  value={bText} maxLength={40} onChange={(e) => setBText(e.target.value)}
                  placeholder="숙제하고 나중에 자유시간" aria-label="B 내용"
                />
              </div>
            </div>

            <p className="form-offline">
              낸 카드는 바로 안 들어간다. <b>확인 후에 승인된 것만</b> 모두의 덱에 섞인다.
              그전까지는 너만 볼 수 있다.
            </p>
          </div>

          {msg && <p className={"form-msg " + (msg.ok ? "ok" : "bad")}>{msg.text}</p>}

          <div className="form-actions">
            <button className="btn-go" disabled={!ready} onClick={submit}>
              {busy ? "내는 중…" : "카드 내기"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
