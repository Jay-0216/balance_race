import { useCallback, useEffect, useState } from "react";
import {
  activeCode, advance, board, createLive, hostQuestions, hostToken, playerCount,
  readSession, rememberActive, scores, setQuestions, watchSession,
  type LiveBoard, type LiveQuestion, type LiveScore, type LiveSession,
} from "../net/live";
import { DILEMMAS } from "../game/setup";
import { QUIZZES } from "../game/quiz";
import { isOnlineAvailable } from "../net/supabase";
import Offline from "../ui/Offline";
import { play } from "../ui/sound";
import "../ui/Form.css";
import "./LiveScreen.css";

/** how often the host asks for the count while a question is open */
const POLL_MS = 800;

/**
 * The host's side of a live session.
 *
 * Write questions, read out a code, watch the answers land. The count is
 * polled rather than pushed: every player answering at once would otherwise be
 * one realtime message per player, and "no limit on people" has to mean the
 * host's phone does not get louder as more of them show up.
 */
export default function LiveHostScreen({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<LiveQuestion[]>([]);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [here, setHere] = useState(0);
  const [live, setLive] = useState<LiveBoard | null>(null);
  const [rank, setRank] = useState<LiveScore[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const online = isOnlineAvailable();

  // Pick a running session back up. A host whose phone locked mid-question
  // should come back to the question, not to a blank "make a room" form with
  // twenty people still waiting on them.
  useEffect(() => {
    if (!online) return;
    const back = activeCode();
    if (!back) return;
    let alive = true;
    void (async () => {
      try {
        const s = await readSession(back);
        if (!alive || !s || s.phase === "ended") { rememberActive(null); return; }
        setCode(back);
        setSession(s);
        setItems(await hostQuestions(back));
      } catch {
        rememberActive(null);
      }
    })();
    return () => { alive = false; };
  }, [online]);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const made = await createLive(title);
      setCode(made.code);
      setSession(await readSession(made.code));
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }, [title]);

  // the session row drives the screen, for the host as much as for a player
  useEffect(() => {
    if (!code) return;
    return watchSession(code, setSession);
  }, [code]);

  // how many are in the room, while we are still waiting to start
  useEffect(() => {
    if (!code) return;
    const pull = () => void playerCount(code).then(setHere).catch(() => {});
    pull();
    const id = window.setInterval(pull, 2500);
    return () => window.clearInterval(id);
  }, [code]);

  const phase = session?.phase ?? "lobby";
  const idx = session?.current_idx ?? 0;

  // The live count, only while a question is actually open.
  useEffect(() => {
    if (!code || phase !== "asking") return;
    let alive = true;
    const pull = async () => {
      try {
        const b = await board(code);
        if (alive && b) setLive(b);
      } catch { /* one dropped tick is not worth a message */ }
    };
    void pull();
    const id = window.setInterval(pull, POLL_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, [code, phase, idx]);

  useEffect(() => {
    if (!code || (phase !== "revealed" && phase !== "ended")) return;
    void scores(code, 10).then(setRank).catch(() => {});
  }, [code, phase, idx]);

  const go = async (to: "asking" | "revealed" | "ended", n: number) => {
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
      await advance(code, to, n);
      if (to === "revealed") play("stamp");
      if (to === "ended") { play("finish"); rememberActive(null); }
      setSession(await readSession(code));
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const begin = async () => {
    if (!code || !items.length) return;
    setBusy(true);
    setError(null);
    try {
      await setQuestions(code, items);
      await advance(code, "asking", 0);
      play("alert");
      setSession(await readSession(code));
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  if (!online) {
    return (
      <Shell onBack={onBack} title="라이브 만들기">
        <Offline what="라이브를 열 수" />
      </Shell>
    );
  }

  if (!code) {
    return (
      <Shell onBack={onBack} title="라이브 만들기" lead="문제를 내고, 코드를 불러주고, 맞히는 걸 실시간으로 본다. 인원 제한은 없다.">
        <div className="field">
          <label htmlFor="lv-title">방 이름 (선택)</label>
          <input
            id="lv-title" value={title} maxLength={24}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예) 1반 쉬는시간"
          />
        </div>
        <div className="form-actions">
          <button className="btn-go" onClick={() => void start()} disabled={busy}>
            {busy ? "만드는 중…" : "방 만들기"}
          </button>
        </div>
        {error && <p className="form-msg bad">{error}</p>}
      </Shell>
    );
  }

  if (phase === "lobby") {
    return (
      <Shell onBack={onBack} title="문제 만들기">
        <CodeCard code={code} here={here} />
        <QuestionBuilder items={items} onChange={setItems} />
        <div className="form-actions">
          <button className="btn-go" onClick={() => void begin()} disabled={busy || !items.length}>
            {items.length ? `${items.length}문제로 시작하기` : "문제를 하나는 넣어야 한다"}
          </button>
        </div>
        {error && <p className="form-msg bad">{error}</p>}
      </Shell>
    );
  }

  const last = idx + 1 >= (session?.question_count ?? 0);

  return (
    <Shell onBack={onBack} title={`문제 ${idx + 1} / ${session?.question_count ?? 0}`}>
      <CodeCard code={code} here={live?.players ?? here} compact />

      {phase === "asking" && (
        <>
          {/* The host's screen is very often the one on the projector, and it
              was showing two bars and no question. */}
          {items[idx] && (
            <div className="lv-ask">
              <span className={"lv-kind lv-" + items[idx].kind}>
                {items[idx].kind === "quiz" ? "퀴즈" : "밸런스"}
              </span>
              <h3 className="lv-prompt">{items[idx].prompt}</h3>
              <div className="lv-ask-opts">
                <span className="a">{items[idx].a_emoji} {items[idx].a_text}</span>
                <span className="b">{items[idx].b_emoji} {items[idx].b_text}</span>
              </div>
            </div>
          )}
          <p className="lv-watch">
            <b>{live?.answered ?? 0}</b> / {live?.players ?? here}명 답했다
          </p>
          {/* Which way, live. During 'asking' this is the host's screen only -
              the players' own screens deliberately cannot see it. */}
          <SplitBar
            a={live?.count_a ?? 0}
            b={live?.count_b ?? 0}
            labels={[items[idx]?.a_text ?? "A", items[idx]?.b_text ?? "B"]}
          />
          <div className="form-actions">
            <button className="btn-go" onClick={() => void go("revealed", idx)} disabled={busy}>
              공개하기
            </button>
          </div>
        </>
      )}

      {phase === "revealed" && (
        <>
          {items[idx] && <h3 className="lv-prompt">{items[idx].prompt}</h3>}
          <RevealCard
            question={items[idx]}
            side={session?.reveal_choice ?? null}
            a={live?.count_a ?? 0}
            b={live?.count_b ?? 0}
          />
          <Ranking rows={rank} />
          <div className="form-actions">
            {last ? (
              <button className="btn-go" onClick={() => void go("ended", idx)} disabled={busy}>
                끝내기
              </button>
            ) : (
              <button className="btn-go" onClick={() => void go("asking", idx + 1)} disabled={busy}>
                다음 문제
              </button>
            )}
          </div>
        </>
      )}

      {phase === "ended" && (
        <>
          <h3 className="lv-done">끝! 최종 순위</h3>
          <Ranking rows={rank} />
          <div className="form-actions">
            <button className="btn-quiet" onClick={onBack}>나가기</button>
          </div>
        </>
      )}

      {error && <p className="form-msg bad">{error}</p>}
    </Shell>
  );
}

/* ---- pieces -------------------------------------------------------------- */

function Shell({
  children, onBack, title, lead,
}: {
  children: React.ReactNode; onBack: () => void; title: string; lead?: string;
}) {
  return (
    <div className="form-screen">
      <header className="form-head">
        <button className="form-back" onClick={onBack} aria-label="뒤로">←</button>
        <div className="form-title">
          <span className="form-eyebrow">라이브</span>
          <h2>{title}</h2>
          {lead && <p>{lead}</p>}
        </div>
      </header>
      <div className="form-body">{children}</div>
    </div>
  );
}

export function CodeCard({ code, here, compact }: { code: string; here: number; compact?: boolean }) {
  return (
    <div className={"lv-code" + (compact ? " compact" : "")}>
      <div>
        <span>참가 코드</span>
        <b>{code}</b>
      </div>
      <span className="lv-here">{here}명</span>
    </div>
  );
}

export function SplitBar({ a, b, labels }: { a: number; b: number; labels: [string, string] }) {
  const total = Math.max(1, a + b);
  return (
    <div className="lv-split">
      <div className="lv-bar">
        <span className="a" style={{ width: `${(a / total) * 100}%` }} />
        <span className="b" style={{ width: `${(b / total) * 100}%` }} />
      </div>
      <div className="lv-legend">
        <span className="a">{labels[0]} · {a}</span>
        <span className="b">{labels[1]} · {b}</span>
      </div>
    </div>
  );
}

function RevealCard({
  question, side, a, b,
}: {
  question?: LiveQuestion; side: "a" | "b" | null; a: number; b: number;
}) {
  if (!question) return null;
  const quiz = question.kind === "quiz";
  return (
    <div className="lv-reveal">
      <b className={side ? "ok" : "tie"}>
        {!side
          ? "완전 반반 — 아무도 점수 없음"
          : quiz
            ? `정답은 ${side.toUpperCase()} · ${side === "a" ? question.a_text : question.b_text}`
            : `많은 쪽은 ${side.toUpperCase()} · ${side === "a" ? question.a_text : question.b_text}`}
      </b>
      {question.note && <span>{question.note}</span>}
      <SplitBar a={a} b={b} labels={[question.a_text, question.b_text]} />
    </div>
  );
}

export function Ranking({ rows }: { rows: LiveScore[] }) {
  if (!rows.length) return null;
  return (
    <ol className="lv-rank">
      {rows.map((r) => (
        <li key={r.player_id} className={r.is_me ? "me" : ""}>
          <span className="lv-rank-n">{r.rank}</span>
          <span className="lv-rank-name">{r.nickname}</span>
          <span className="lv-rank-hits">{r.hits}맞힘</span>
          <span className="lv-rank-score">{r.score}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---- writing the questions ---------------------------------------------- */

const BLANK: LiveQuestion = {
  kind: "quiz", prompt: "", a_emoji: "🅰️", a_text: "", b_emoji: "🅱️", b_text: "",
  answer: "a", note: null,
};

function QuestionBuilder({
  items, onChange,
}: {
  items: LiveQuestion[]; onChange: (next: LiveQuestion[]) => void;
}) {
  const [draft, setDraft] = useState<LiveQuestion>(BLANK);
  const ready = draft.prompt.trim() && draft.a_text.trim() && draft.b_text.trim();

  const add = () => {
    if (!ready) return;
    onChange([...items, { ...draft, answer: draft.kind === "quiz" ? draft.answer : null }]);
    setDraft({ ...BLANK, kind: draft.kind });
  };

  /** Straight out of the decks the game already ships, so a host who just
   *  wants to run something is not typing for ten minutes first. */
  const borrow = () => {
    if (draft.kind === "quiz") {
      const q = QUIZZES[Math.floor(Math.random() * QUIZZES.length)];
      setDraft({
        kind: "quiz", prompt: q.question,
        a_emoji: q.a.emoji, a_text: q.a.text,
        b_emoji: q.b.emoji, b_text: q.b.text,
        answer: q.answer, note: q.note,
      });
    } else {
      const d = DILEMMAS[Math.floor(Math.random() * DILEMMAS.length)];
      setDraft({
        kind: "balance", prompt: d.category,
        a_emoji: d.a.emoji, a_text: d.a.text,
        b_emoji: d.b.emoji, b_text: d.b.text,
        answer: null, note: null,
      });
    }
  };

  return (
    <>
      {items.length > 0 && (
        <ol className="lv-list">
          {items.map((q, i) => (
            <li key={i}>
              <span className={"lv-kind lv-" + q.kind}>{q.kind === "quiz" ? "퀴즈" : "밸런스"}</span>
              <span className="lv-list-q">{q.prompt}</span>
              <button
                className="lv-del"
                onClick={() => onChange(items.filter((_, n) => n !== i))}
                aria-label="빼기"
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="lv-new">
        <div className="lv-kinds" role="group" aria-label="문제 종류">
          {(["quiz", "balance"] as const).map((k) => (
            <button
              key={k}
              className={"lv-kind-btn" + (draft.kind === k ? " on" : "")}
              onClick={() => setDraft({ ...draft, kind: k, answer: k === "quiz" ? "a" : null })}
              aria-pressed={draft.kind === k}
            >
              {k === "quiz" ? "퀴즈 (정답 있음)" : "밸런스 (많은 쪽이 정답)"}
            </button>
          ))}
        </div>

        <div className="field">
          <label htmlFor="lv-q">문제</label>
          <input
            id="lv-q" value={draft.prompt} maxLength={200}
            onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
            placeholder={draft.kind === "quiz" ? "가장 넓은 바다는?" : "평생 하나만 고른다면?"}
          />
        </div>

        {(["a", "b"] as const).map((side) => (
          <div className="lv-side" key={side}>
            <input
              className="lv-emoji" maxLength={4}
              value={side === "a" ? draft.a_emoji : draft.b_emoji}
              onChange={(e) =>
                setDraft({ ...draft, [side === "a" ? "a_emoji" : "b_emoji"]: e.target.value })}
              aria-label={`${side.toUpperCase()} 이모지`}
            />
            <input
              value={side === "a" ? draft.a_text : draft.b_text} maxLength={60}
              onChange={(e) =>
                setDraft({ ...draft, [side === "a" ? "a_text" : "b_text"]: e.target.value })}
              placeholder={`${side.toUpperCase()} 선택지`}
            />
            {draft.kind === "quiz" && (
              <button
                className={"lv-ans" + (draft.answer === side ? " on" : "")}
                onClick={() => setDraft({ ...draft, answer: side })}
                aria-pressed={draft.answer === side}
              >
                정답
              </button>
            )}
          </div>
        ))}

        {draft.kind === "quiz" && (
          <div className="field">
            <label htmlFor="lv-note">해설 (선택)</label>
            <input
              id="lv-note" value={draft.note ?? ""} maxLength={300}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="공개할 때 같이 보여준다"
            />
          </div>
        )}

        <div className="lv-add">
          <button className="btn-quiet" onClick={borrow}>덱에서 가져오기</button>
          <button className="btn-go" onClick={add} disabled={!ready}>문제 넣기</button>
        </div>
      </div>
    </>
  );
}

function msg(e: unknown) {
  const t = e instanceof Error ? e.message : String(e);
  if (t.includes("not the host")) return "이 기기는 이 방의 방장이 아니다.";
  if (t.includes("already started")) return "이미 시작한 방이라 문제를 바꿀 수 없다.";
  if (t.includes("no such session")) return "그런 방이 없다. 코드를 확인해줘.";
  return t;
}

/** Kept for the join screen, which needs the same "am I the host" answer. */
export { hostToken };
