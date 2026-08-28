import { useEffect, useState } from "react";
import {
  ALLIN_MAX, ALLIN_MIN, BOOSTER_CHARGE_MAX, BOOSTER_MULTIPLIER, CELLS, ROUNDS,
  TIME_LIMIT,
} from "../game/rules";
import { Arrow, Ring, Underline, Written } from "../ui/Scribble";
import "../ui/Scribble.css";
import "./HowToScreen.css";

/** how long a scene holds before it moves itself on */
const DWELL = 5600;

/**
 * The rules, drawn rather than written out.
 *
 * This was six paragraphs and two tables, and a wall of prose is the one thing
 * a player will not read before their first game - which is fatal here,
 * because a 눈치게임 played by someone who does not know what the majority
 * does is just guessing.
 *
 * So each rule is now a picture that assembles itself, a pen circle drawn
 * around the part that matters, and a line that writes itself underneath. The
 * circle is the whole trick: it points at one thing, so each scene can only
 * make one claim, which is a discipline prose does not impose.
 *
 * It advances on its own until you touch it, and then it never does again -
 * autoplay that fights you is worse than no autoplay.
 */
export default function HowToScreen({ onDone, first }: { onDone: () => void; first?: boolean }) {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const scene = SCENES[i];
  const last = i === SCENES.length - 1;

  useEffect(() => {
    if (!auto || last) return;
    const id = window.setTimeout(() => setI((n) => n + 1), DWELL);
    return () => clearTimeout(id);
  }, [i, auto, last]);

  const go = (n: number) => {
    setAuto(false);
    setI(Math.max(0, Math.min(SCENES.length - 1, n)));
  };

  return (
    <div className="how">
      <header className="how-head">
        <span className="how-eyebrow">게임 방법</span>
        <h2>남들이 뭘 고를지 맞히는 경주</h2>
      </header>

      {/* Tapping the picture is the obvious thing to do, so it is the control.
          The buttons underneath are for going back and for people who would
          rather not guess. */}
      <button
        className="how-stage"
        onClick={() => (last ? onDone() : go(i + 1))}
        aria-label="다음"
      >
        <svg className="how-art" viewBox="0 0 300 200" role="img" aria-label={scene.title}>
          {/* keyed so every mark redraws from nothing when the scene turns */}
          <g key={scene.key}>{scene.art}</g>
        </svg>

        <div className="how-say" key={scene.key + "-say"}>
          <strong className="how-title">
            <Written text={scene.title} delay={0.12} />
          </strong>
          <span className="how-line">
            <Written text={scene.line} delay={0.62} />
          </span>
        </div>
      </button>

      <div className="how-dots" role="tablist" aria-label="단계">
        {SCENES.map((s, n) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={n === i}
            aria-label={`${n + 1}. ${s.title}`}
            className={"how-dot" + (n === i ? " on" : "") + (n < i ? " done" : "")}
            onClick={() => go(n)}
          >
            {/* the bar fills over exactly the dwell, so the picture never
                turns over before the line under it has finished writing */}
            {n === i && auto && !last && <span className="how-fill" />}
          </button>
        ))}
      </div>

      <div className="how-nav">
        <button className="how-prev" onClick={() => go(i - 1)} disabled={i === 0}>이전</button>
        {last ? (
          <button className="how-go" onClick={onDone}>{first ? "알겠어, 시작하자" : "닫기"}</button>
        ) : (
          <>
            <button className="how-next" onClick={() => go(i + 1)}>다음</button>
            <button className="how-skip" onClick={onDone}>{first ? "건너뛰기" : "닫기"}</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---- the scenes ---------------------------------------------------------
   Every delay below is in seconds and hand-placed: the parts of the picture
   arrive first, the pen circle lands on the finished picture, and the line
   underneath writes last. Getting that order wrong makes the circle look
   like a loading spinner. */

/*
 * The frame is 300x200 rather than 300x160. The drawing has a fixed aspect, so
 * on a phone the panel is width-bound: a wider frame is a *smaller* drawing
 * with more empty card around it. Squarer means every mark is bigger for the
 * same screen.
 */
const SCENES: { key: string; title: string; line: string; art: JSX.Element }[] = [
  {
    key: "pick",
    title: "둘 중 하나를 고른다",
    line: `${TIME_LIMIT}초 안에. 안 고르면 자동으로 골라진다.`,
    art: (
      <>
        <g className="sc-in" style={{ animationDelay: "0.05s" }}>
          <rect x={16} y={34} width={118} height={96} rx={13}
            fill="var(--screen-3)" stroke="var(--a)" strokeWidth={1.8} />
          <text className="how-tag a" x={32} y={58}>A</text>
          <text className="how-emoji" x={32} y={94}>🍗</text>
          <text className="how-opt" x={32} y={118}>치킨</text>
        </g>
        <g className="sc-in" style={{ animationDelay: "0.2s" }}>
          <rect x={166} y={34} width={118} height={96} rx={13}
            fill="var(--screen-3)" stroke="var(--b)" strokeWidth={1.8} />
          <text className="how-tag b" x={182} y={58}>B</text>
          <text className="how-emoji" x={182} y={94}>🍕</text>
          <text className="how-opt" x={182} y={118}>피자</text>
        </g>
        <text className="how-vs sc-in" style={{ animationDelay: "0.36s" }} x={150} y={88}>VS</text>

        {/* the clock, because the choosing is timed and that is half the game */}
        <g className="sc-in" style={{ animationDelay: "0.5s" }}>
          <circle cx={150} cy={166} r={19} fill="none" stroke="var(--line)" strokeWidth={3.4} />
          <path d="M 150 147 A 19 19 0 1 1 132 179" fill="none" stroke="var(--b)"
            strokeWidth={3.4} strokeLinecap="round" />
          <text className="how-clock" x={150} y={172}>{TIME_LIMIT}</text>
        </g>

        <Ring cx={75} cy={82} rx={69} ry={60} delay={0.85} seed={1} />
      </>
    ),
  },
  {
    key: "many",
    title: "많은 쪽이 앞으로 간다",
    line: "정답은 없다. 남들이 어디로 갈지만 맞히면 된다.",
    art: (
      <>
        {[0, 1, 2, 3, 4].map((n) => (
          <circle key={n} className="sc-in" style={{ animationDelay: `${0.05 + n * 0.07}s` }}
            cx={42 + (n % 3) * 38} cy={52 + Math.floor(n / 3) * 40} r={14} fill="var(--a)" />
        ))}
        <text className="how-count a sc-in" style={{ animationDelay: "0.45s" }} x={80} y={134}>5명</text>

        {[0, 1, 2].map((n) => (
          <circle key={n} className="sc-in" style={{ animationDelay: `${0.4 + n * 0.07}s` }}
            cx={206 + (n % 2) * 38} cy={52 + Math.floor(n / 2) * 40} r={14} fill="var(--b)" />
        ))}
        <text className="how-count b sc-in" style={{ animationDelay: "0.66s" }} x={225} y={134}>3명</text>

        <Ring cx={80} cy={72} rx={70} ry={54} delay={0.9} seed={3} />
        {/* Forward is to the right, the way the race runs, and the label sits
            on the arrow rather than under the other group - an arrow pointing
            one way with its caption over the losing side reads as labelling
            the losers. */}
        <Arrow x1={100} y1={166} x2={200} y2={166} delay={1.5} bend={-8} />
        <text className="how-note sc-in" style={{ animationDelay: "1.7s" }} x={150} y={192}>이 5명이 전진</text>
      </>
    ),
  },
  {
    key: "gain",
    title: "다 몰리면 조금만 준다",
    line: "누구나 아는 답을 고르는 건 눈치가 아니니까.",
    art: (
      <>
        {[
          ["5 : 3", "+2칸", 48, "var(--gold)"],
          ["7 : 1", "+1칸", 104, "var(--ink-3)"],
          ["4 : 4", "+1칸", 160, "var(--ink-3)"],
        ].map(([split, gain, y, color], n) => (
          <g key={split as string} className="sc-in" style={{ animationDelay: `${0.1 + n * 0.16}s` }}>
            <text className="how-split" x={72} y={y as number}>{split}</text>
            <text className="how-gain" x={212} y={y as number} fill={color as string}>{gain}</text>
          </g>
        ))}
        <text className="how-note sc-in" style={{ animationDelay: "0.65s" }} x={272} y={160}>동점</text>
        <Ring cx={214} cy={98} rx={50} ry={25} delay={1.0} seed={5} />
        <Underline x={42} y={118} w={62} delay={1.5} color="var(--ink-3)" />
      </>
    ),
  },
  {
    key: "boost",
    title: "소수를 고르면 충전된다",
    line: `${BOOSTER_CHARGE_MAX}칸 차면 내가 켠 라운드만 ×${BOOSTER_MULTIPLIER}. 켜고 지면 그냥 날아간다.`,
    art: (
      <>
        <rect className="sc-in" style={{ animationDelay: "0.05s" }}
          x={22} y={62} width={176} height={40} rx={20}
          fill="var(--screen-3)" stroke="var(--line)" strokeWidth={1.8} />
        {/* the gauge fills a segment at a time, which is how it actually fills */}
        <rect className="sc-in" style={{ animationDelay: "0.45s" }}
          x={28} y={68} width={82} height={28} rx={14} fill="var(--gold)" opacity={0.55} />
        <rect className="sc-in" style={{ animationDelay: "0.95s" }}
          x={114} y={68} width={80} height={28} rx={14} fill="var(--gold)" />
        <text className="how-boost sc-in" style={{ animationDelay: "1.1s" }} x={110} y={142}>
          ⚡ {BOOSTER_CHARGE_MAX} / {BOOSTER_CHARGE_MAX} 충전
        </text>
        <text className="how-mult sc-in" style={{ animationDelay: "1.7s" }} x={252} y={94}>×{BOOSTER_MULTIPLIER}</text>
        {/* stops short of the ring: an arrowhead drawn on top of the thing
            it points at reads as a scribble over it */}
        <Arrow x1={204} y1={82} x2={216} y2={82} delay={1.45} />
        <Ring cx={252} cy={84} rx={33} ry={31} delay={1.85} seed={7} />
      </>
    ),
  },
  {
    key: "special",
    title: "특수 라운드는 미리 알려준다",
    line: `역전 라운드에선 소수가 앞으로 간다. ${ROUNDS}라운드 중 3번 온다.`,
    art: (
      <>
        {[
          ["더블", "이동 2배", 44, "var(--gold)"],
          ["역전", "소수가 전진", 102, "var(--a)"],
          ["올인", `내 칸의 ${Math.round(ALLIN_MIN * 100)}~${Math.round(ALLIN_MAX * 100)}%를 건다`, 160, "var(--b)"],
        ].map(([name, what, y, color], n) => (
          <g key={name as string} className="sc-in" style={{ animationDelay: `${0.08 + n * 0.18}s` }}>
            <rect x={14} y={(y as number) - 18} width={70} height={28} rx={14}
              fill="none" stroke={color as string} strokeWidth={1.8} />
            <text className="how-chip" x={49} y={(y as number) + 2} fill={color as string}>{name}</text>
            <text className="how-what" x={98} y={(y as number) + 2}>{what}</text>
          </g>
        ))}
        <Ring cx={124} cy={102} rx={118} ry={28} delay={0.95} color="var(--a)" seed={11} />
      </>
    ),
  },
  {
    key: "finish",
    title: `먼저 ${CELLS}칸`,
    line: `${ROUNDS}라운드 안에 아무도 못 가면, 그때 제일 앞선 사람이 이긴다.`,
    art: (
      <>
        <path className="sc-in" style={{ animationDelay: "0.05s" }}
          d="M 12 116 L 288 116" stroke="var(--screen-3)" strokeWidth={44} strokeLinecap="round" />
        <path className="sc-in" style={{ animationDelay: "0.15s" }}
          d="M 22 116 L 278 116" stroke="var(--ink-3)" strokeWidth={2.4}
          strokeDasharray="14 14" opacity={0.5} />

        {/* the chequered line, two rows of squares */}
        <g className="sc-in" style={{ animationDelay: "0.35s" }}>
          {[0, 1, 2, 3].map((n) => (
            <rect key={n} x={224 + (n % 2) * 11} y={96 + Math.floor(n / 2) * 20}
              width={11} height={20} fill={n % 3 === 0 ? "#f3f7fa" : "#1b232a"} />
          ))}
          <rect x={224} y={96} width={22} height={40} fill="none" stroke="var(--ink-3)" strokeWidth={1.2} />
        </g>

        <g className="sc-in" style={{ animationDelay: "0.7s" }}>
          <rect x={88} y={106} width={44} height={21} rx={8} fill="var(--gold)" />
          <rect x={96} y={102} width={11} height={4} rx={2} fill="#12171c" />
          <rect x={96} y={127} width={11} height={4} rx={2} fill="#12171c" />
          <text className="how-me" x={110} y={92}>나</text>
        </g>

        <Arrow x1={146} y1={116} x2={206} y2={116} delay={1.1} />
        <Ring cx={235} cy={116} rx={31} ry={40} delay={1.7} seed={13} />
        <text className="how-cells sc-in" style={{ animationDelay: "1.9s" }} x={235} y={184}>{CELLS}칸</text>
      </>
    ),
  },
];
