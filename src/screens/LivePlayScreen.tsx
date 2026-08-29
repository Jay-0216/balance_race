import { useCallback, useEffect, useState } from "react";
import {
  answerLive, currentQuestion, joinLive, scores, tally, watchSession,
  type LiveCurrent, type LiveScore, type LiveSession, type LiveTally,
} from "../net/live";
import { getIdentity, setNickname } from "../net/identity";
import { play } from "../ui/sound";
import { CodeCard, Ranking, SplitBar } from "./LiveHostScreen";
import "../ui/Form.css";
import "./LiveScreen.css";

/**
 * A player in someone else's live session.
 *
 * The screen is driven entirely by the session row, which is the only thing
 * pushed to every device. When it changes we ask for the question - and the
 * question comes back without its answer until the host reveals, because that
 * is enforced in the database rather than here.
 */
export default function LivePlayScreen({
  code: given,
  onBack,
}: {
  /** null when the player arrived without a code and has to type one */
  code: string | null;
  onBack: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [nick, setNick] = useState(() => getIdentity().nickname);
  const [joined, setJoined] = useState(false);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [q, setQ] = useState<LiveCurrent | null>(null);
  const [picked, setPicked] = useState<"a" | "b" | null>(null);
  const [split, setSplit] = useState<LiveTally | null>(null);
  const [rank, setRank] = useState<LiveScore[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The code is either handed in (someone tapped a link, or the title's one
  // code box resolved it) or typed here. One screen either way: making people
  // type a code on one page and a name on the next is two taps and a page
  // turn for two fields that fit together.
  const code = (given ?? typed).trim().toUpperCase();

  const join = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = setNickname(nick);
      await joinLive(code, saved.nickname);
      setJoined(true);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }, [code, nick]);

  useEffect(() => {
    if (!joined) return;
    return watchSession(code, setSession);
  }, [code, joined]);

  const phase = session?.phase ?? "lobby";
  const idx = session?.current_idx ?? 0;

  // A new question clears the last one's answer. Keyed on the index rather
  // than the phase, so re-reading on reveal does not wipe what I picked.
  useEffect(() => {
    setPicked(null);
    setSplit(null);
  }, [idx]);

  useEffect(() => {
    if (!joined || phase === "lobby") return;
    void currentQuestion(code).then(setQ).catch(() => {});
    if (phase === "revealed") void tally(code).then(setSplit);
    // also on 'ended', which is when the final board is the whole screen
    if (phase === "revealed" || phase === "ended") {
      void scores(code, phase === "ended" ? 10 : 5).then(setRank).catch(() => {});
    }
  }, [code, joined, phase, idx]);

  // the sound of finding out
  useEffect(() => {
    if (phase !== "revealed" || !picked || !session?.reveal_choice) return;
    play(picked === session.reveal_choice ? "stamp" : "slump");
  }, [phase, picked, session?.reveal_choice]);

  const answer = async (side: "a" | "b") => {
    if (picked || !q) return;
    setPicked(side);                    // optimistic: the tap has to feel instant
    play("click");
    try {
      await answerLive(code, q.idx, side);
    } catch (e) {
      setPicked(null);
      setError(msg(e));
    }
  };

  if (!joined) {
    return (
      <div className="form-screen">
        <header className="form-head">
          <button className="form-back" onClick={onBack} aria-label="뒤로">←</button>
          <div className="form-title">
            <span className="form-eyebrow">라이브 참가</span>
            <h2>{given ? `${given} 방에 들어간다` : "코드를 받았어?"}</h2>
            <p>
              {given
                ? "이름만 정하면 끝. 인원 제한은 없다."
                : "방장이 불러준 6자리를 넣으면 된다. 인원 제한은 없다."}
            </p>
          </div>
        </header>
        <div className="form-body">
          {!given && (
            <div className="field">
              <label htmlFor="lp-code">참가 코드</label>
              <input
                id="lp-code"
                className="lp-code"
                value={typed}
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => setTyped(e.target.value.toUpperCase())}
                placeholder="ABC123"
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="lp-nick">이름</label>
            <input
              id="lp-nick" value={nick} maxLength={16}
              onChange={(e) => setNick(e.target.value)}
              placeholder="16글자까지"
            />
          </div>
          <div className="form-actions">
            <button
              className="btn-go"
              onClick={() => void join()}
              disabled={busy || !nick.trim() || code.length < 4}
            >
              {busy ? "들어가는 중…" : "들어가기"}
            </button>
          </div>
          {error && <p className="form-msg bad">{error}</p>}
        </div>
      </div>
    );
  }

  const mine = rank.find((r) => r.is_me);
  const right = phase === "revealed" && picked && picked === session?.reveal_choice;

  return (
    <div className="form-screen">
      <header className="form-head">
        <button className="form-back" onClick={onBack} aria-label="나가기">←</button>
        <div className="form-title">
          <span className="form-eyebrow">{q?.title ?? "라이브"}</span>
          <h2>
            {phase === "lobby"
              ? "곧 시작한다"
              : phase === "ended"
                ? "끝!"
                : `문제 ${idx + 1} / ${session?.question_count ?? 0}`}
          </h2>
        </div>
      </header>

      <div className="form-body">
        {phase === "lobby" && (
          <>
            <CodeCard code={code} here={0} compact />
            <p className="lv-wait">방장이 시작하기를 기다리는 중…</p>
          </>
        )}

        {(phase === "asking" || phase === "revealed") && q && (
          <>
            <span className={"lv-kind lv-" + q.kind}>
              {q.kind === "quiz" ? "퀴즈 · 정답이 있다" : "밸런스 · 많은 쪽이 정답"}
            </span>
            <h3 className="lv-prompt">{q.prompt}</h3>

            <div className="lv-opts">
              {(["a", "b"] as const).map((side) => {
                const text = side === "a" ? q.a_text : q.b_text;
                const emoji = side === "a" ? q.a_emoji : q.b_emoji;
                const isKey = phase === "revealed" && session?.reveal_choice === side;
                const mineWrong = phase === "revealed" && picked === side && !isKey;
                return (
                  <button
                    key={side}
                    className={
                      "lv-opt" +
                      (picked === side ? " picked" : "") +
                      (isKey ? " key" : "") +
                      (mineWrong ? " miss" : "")
                    }
                    disabled={phase !== "asking" || !!picked}
                    onClick={() => void answer(side)}
                  >
                    <span className="lv-opt-emoji">{emoji}</span>
                    <span className="lv-opt-text">{text}</span>
                    {picked === side && <span className="lv-tag">내 답</span>}
                  </button>
                );
              })}
            </div>

            {phase === "asking" && (
              <p className="lv-wait">
                {picked ? "냈다. 다른 사람 기다리는 중…" : "둘 중 하나를 골라줘."}
              </p>
            )}

            {phase === "revealed" && (
              <>
                <div className="lv-reveal">
                  <b className={!session?.reveal_choice ? "tie" : right ? "ok" : "bad"}>
                    {!session?.reveal_choice
                      ? "완전 반반 — 아무도 점수 없음"
                      : !picked
                        ? "안 냈다"
                        : right ? "맞혔다!" : "아쉽다"}
                  </b>
                  {q.note && <span>{q.note}</span>}
                </div>
                {split && (
                  <SplitBar a={split.count_a} b={split.count_b} labels={[q.a_text, q.b_text]} />
                )}
                {mine && (
                  <p className="lv-me">
                    지금 <b>{mine.rank}위</b> · {mine.score}점 · {mine.hits}개 맞힘
                  </p>
                )}
                <Ranking rows={rank} />
              </>
            )}
          </>
        )}

        {phase === "ended" && (
          <>
            <Ranking rows={rank} />
            <div className="form-actions">
              <button className="btn-quiet" onClick={onBack}>나가기</button>
            </div>
          </>
        )}

        {error && <p className="form-msg bad">{error}</p>}
      </div>
    </div>
  );
}

function msg(e: unknown) {
  const t = e instanceof Error ? e.message : String(e);
  if (t.includes("no such session")) return "그런 방이 없다. 코드를 확인해줘.";
  if (t.includes("session ended")) return "이미 끝난 방이다.";
  if (t.includes("not taking answers")) return "지금은 답을 받는 중이 아니다.";
  if (t.includes("wrong question")) return "방장이 다음 문제로 넘어갔다.";
  return t;
}
