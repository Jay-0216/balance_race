import quizData from "../data/quizzes.json";
import type { Quiz } from "./types";

/**
 * Quiz mode is you against the clock and your own record. There is no
 * opponent, no bot and nothing answering back.
 *
 * That is not a smaller version of the race, it is the opposite of it: the
 * race scores you for reading other people, and a question with a right
 * answer has nobody to read. Bolting bots onto it would only have produced
 * seven fake players who all happen to know the answer.
 */
export const QUIZZES = quizData as Quiz[];

export const QUIZ_COUNT = 10;
/** seconds per question - shorter than a dilemma, because you either know it
 *  or you are guessing, and a long clock only stretches the guess */
export const QUIZ_TIME = 12;

export function dealQuiz(count = QUIZ_COUNT, rng: () => number = Math.random): Quiz[] {
  const pool = [...QUIZZES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

export type QuizRecord = {
  plays: number;
  /** most correct in one run */
  best: number;
  /** total answering time of the run that set `best`, in ms */
  bestMs: number;
};

const KEY = "ddr.quiz";
const EMPTY: QuizRecord = { plays: 0, best: 0, bestMs: 0 };

export function loadRecord(): QuizRecord {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const p = JSON.parse(raw) as Partial<QuizRecord>;
    const num = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
    return { plays: num(p.plays), best: num(p.best), bestMs: num(p.bestMs) };
  } catch {
    return { ...EMPTY };
  }
}

/**
 * A run only beats the record by getting more right, or by getting the same
 * number right faster. Time alone is never a record: answering nothing in
 * two seconds is not a good run.
 */
export function saveRun(correct: number, ms: number): { record: QuizRecord; improved: boolean } {
  const prev = loadRecord();
  const improved =
    correct > prev.best || (correct === prev.best && correct > 0 && ms < prev.bestMs);
  const record: QuizRecord = {
    plays: prev.plays + 1,
    best: improved ? correct : prev.best,
    bestMs: improved ? ms : prev.bestMs,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // a private window just means the record does not survive a reload
  }
  return { record, improved };
}

export const secs = (ms: number) => (ms / 1000).toFixed(1) + "초";
