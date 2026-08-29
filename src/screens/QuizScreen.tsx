import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dealQuiz, loadRecord, QUIZ_TIME, saveRun, secs, type QuizRecord,
} from "../game/quiz";
import type { Choice, Quiz } from "../game/types";
import { equippedPiece, PIECES, recordQuiz } from "../game/garage";
import { COIN, COIN_ICON } from "../game/shop";
import type { PieceId } from "../race/pieces";
import RaceView from "../race/RaceView";
import type { RaceEffect } from "../race/effects";
import { CELLS, type RacerView } from "../race/world";
import { getIdentity } from "../net/identity";
import { myPaint } from "../game/garage";
import Timer from "../ui/Timer";
import { buzz } from "../ui/haptics";
import { play } from "../ui/sound";
import "./ResultScreen.css";   // .result-eyebrow / .result-actions / .unlock-note
import "./QuizScreen.css";

/** how long the answer and its explanation stay up before the next question */
const SHOW_MS = 2100;

type Answered = { picked: Choice | null; right: boolean };

export default function QuizScreen({ onBack }: { onBack: () => void }) {
  const [deck, setDeck] = useState<Quiz[]>(() => dealQuiz());
  const [at, setAt] = useState(0);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [correct, setCorrect] = useState(0);
  const [deadline, setDeadline] = useState(() => performance.now() + QUIZ_TIME * 1000);
  const [done, setDone] = useState<{
    correct: number; ms: number; record: QuizRecord; improved: boolean;
    unlocked: PieceId[]; prize: number;
  } | null>(null);
  const [record, setRecord] = useState<QuizRecord>(loadRecord);

  /**
   * The quiz is a race too.
   *
   * It was a question on an otherwise empty screen, and the game already owns
   * a track - so a right answer moves you down it. The scale is the deck's,
   * not the race's: ten right is the finish line, whatever the deck's length,
   * so the flag means the same thing here as it does over there.
   */
  const [me] = useState(() => ({
    piece: equippedPiece(), color: myPaint(), name: getIdentity().nickname,
  }));
  const perCell = deck.length > 0 ? CELLS / deck.length : 0;
  const racers: RacerView[] = useMemo(
    () => [{ id: 0, name: me.name, color: me.color, me: true,
             pos: correct * perCell, piece: me.piece }],
    [me, correct, perCell]
  );
  // one gust per correct answer, keyed so it fires exactly once
  const effects: RaceEffect[] = useMemo(
    () => (correct > 0 ? [{ key: correct, playerId: 0, kind: "advance" as const }] : []),
    [correct]
  );

  // Wall-clock spent answering, summed per question. The gap while the answer
  // is on screen is not the player's time and is not counted.
  const spent = useRef(0);
  const asked = useRef(performance.now());
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const q = deck[at];

  const finish = useCallback((finalCorrect: number) => {
    const ms = Math.round(spent.current);
    const saved = saveRun(finalCorrect, ms);
    const reward = recordQuiz(finalCorrect, deck.length);
    setRecord(saved.record);
    setDone({
      correct: finalCorrect, ms, record: saved.record, improved: saved.improved,
      unlocked: reward.unlocked, prize: reward.bolts,
    });
    play(saved.improved ? "alert" : "finish");
    buzz(saved.improved ? "alert" : "finish");
  }, [deck.length]);

  const answer = useCallback((picked: Choice | null) => {
    if (answered || done) return;
    spent.current += performance.now() - asked.current;
    const right = picked === q.answer;
    setAnswered({ picked, right });
    const next = correct + (right ? 1 : 0);
    if (right) setCorrect(next);
    play(right ? "stamp" : "slump");
    buzz(right ? "reveal" : "miss");

    timers.current.push(window.setTimeout(() => {
      if (at + 1 >= deck.length) {
        finish(next);
        return;
      }
      setAt((n) => n + 1);
      setAnswered(null);
      asked.current = performance.now();
      setDeadline(performance.now() + QUIZ_TIME * 1000);
    }, SHOW_MS));
  }, [answered, done, q, correct, at, deck.length, finish]);

  // The clock answers for you, and a timeout is simply wrong - there is a
  // right answer here, so there is nothing to award for not choosing.
  useEffect(() => {
    if (answered || done) return;
    let raf = 0;
    const tick = () => {
      if (performance.now() >= deadline) { answer(null); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [answered, done, deadline, answer]);

  const again = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setDeck(dealQuiz());
    setAt(0);
    setAnswered(null);
    setCorrect(0);
    setDone(null);
    spent.current = 0;
    asked.current = performance.now();
    setDeadline(performance.now() + QUIZ_TIME * 1000);
  };

  if (done) return <QuizResult {...done} total={deck.length} onAgain={again} onBack={onBack} />;

  return (
    <div className="quiz-screen">
      <header className="quiz-bar">
        <button className="game-back" onClick={onBack} aria-label="나가기">←</button>
        <span className="quiz-count">문제 {at + 1} / {deck.length}</span>
        <span className="quiz-score">{correct}개</span>
        <Timer endAt={deadline} limit={QUIZ_TIME} running={!answered} locked={!!answered} />
      </header>

      {/* paused once the last answer is in: the result screen sits on a
          backdrop-filter, and blurring a canvas still painting at 60fps costs
          more than the race itself */}
      <div className="quiz-track">
        <RaceView racers={racers} effects={effects} paused={!!done} />
      </div>

      <div className="quiz-pips" aria-hidden="true">
        {deck.map((_, i) => (
          <span key={i} className={"quiz-pip" + (i < at ? " past" : i === at ? " now" : "")} />
        ))}
      </div>

      <div className="quiz-body">
       <div className="quiz-inner">
        <span className="quiz-cat">{q.category}</span>
        <h2 className="quiz-q">{q.question}</h2>

        <div className="quiz-opts">
          {(["a", "b"] as Choice[]).map((side) => {
            const mark = !answered
              ? ""
              : side === q.answer
                ? " right"
                : answered.picked === side ? " wrong" : " dim";
            return (
              <button
                key={side}
                className={"quiz-opt" + mark}
                disabled={!!answered}
                onClick={() => answer(side)}
              >
                <span className="quiz-emoji">{q[side].emoji}</span>
                <span className="quiz-text">{q[side].text}</span>
                {answered && side === q.answer && <span className="quiz-mark">정답</span>}
                {answered && answered.picked === side && side !== q.answer && (
                  <span className="quiz-mark bad">내 답</span>
                )}
              </button>
            );
          })}
        </div>

        {/* The explanation is the point of getting one wrong, so it is not a
            footnote - it is the biggest thing on screen once you have answered. */}
        <div className={"quiz-note" + (answered ? " show" : "")}>
          {answered && (
            <>
              <b className={answered.right ? "ok" : "bad"}>
                {answered.right ? "정답!" : answered.picked ? "땡" : "시간 초과"}
              </b>
              <span>{q.note}</span>
            </>
          )}
        </div>
       </div>
      </div>

      <p className="quiz-best">
        최고 기록 {record.best}개{record.best > 0 && ` · ${secs(record.bestMs)}`}
      </p>
    </div>
  );
}

function QuizResult({
  correct, total, ms, record, improved, unlocked, prize, onAgain, onBack,
}: {
  correct: number; total: number; ms: number; record: QuizRecord;
  improved: boolean; unlocked: PieceId[]; prize: number;
  onAgain: () => void; onBack: () => void;
}) {
  return (
    <div className="quiz-done">
      <div className="quiz-card">
        <span className="result-eyebrow">기록</span>
        <h2 className="quiz-final">
          <b>{correct}</b> / {total}
        </h2>
        <p className="quiz-sub">
          {secs(ms)} 걸렸다
          {improved ? " · 최고 기록 경신!" : ` · 최고 ${record.best}개 (${secs(record.bestMs)})`}
        </p>

        {prize > 0 && (
          <p className="result-prize">
            {COIN_ICON} <b>+{prize.toLocaleString()}</b> {COIN}
          </p>
        )}

        {unlocked.length > 0 && (
          <p className="unlock-note">
            🔓 차고에 새 말이 들어왔다 —{" "}
            {unlocked.map((id) => PIECES.find((p) => p.id === id)?.name ?? id).join(", ")}
          </p>
        )}

        <div className="result-actions">
          <button className="result-again" onClick={onAgain}>한 판 더</button>
          <button className="result-out" onClick={onBack}>나가기</button>
        </div>
      </div>
    </div>
  );
}
