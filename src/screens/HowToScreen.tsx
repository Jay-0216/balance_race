import {
  ALLIN_MAX, ALLIN_MIN, BOOSTER_CHARGE_MAX, BOOSTER_MULTIPLIER, CELLS, ROUNDS,
  TIME_LIMIT,
} from "../game/rules";
import "./HowToScreen.css";

/**
 * The rules, in the order you meet them. Shown once on a first visit and
 * always reachable from the title, because the one thing a 눈치게임 cannot
 * survive is a player who does not know what the majority does.
 */
export default function HowToScreen({ onDone, first }: { onDone: () => void; first?: boolean }) {
  return (
    <div className="how">
      <header className="how-head">
        <span className="how-eyebrow">게임 방법</span>
        <h2>남들이 뭘 고를지 맞히는 경주</h2>
        <p>지식 문제가 아니다. 정답도 없다. <b>다수를 읽는 것</b>이 전부다.</p>
      </header>

      <div className="how-body">
        <section className="how-step">
          <span className="how-n">1</span>
          <div>
            <h3>둘 중 하나를 고른다</h3>
            <p>매 라운드 딜레마가 나온다. 제한 시간 <b>{TIME_LIMIT}초</b>.
              안 고르면 자동으로 아무거나 골라진다.</p>
          </div>
        </section>

        <section className="how-step">
          <span className="how-n">2</span>
          <div>
            <h3>다수 쪽이면 전진, 소수면 제자리</h3>
            <p>마감 전까지 <b>남의 선택은 안 보인다.</b> 몇 명이 골랐는지만 보인다.</p>
          </div>
        </section>

        <section className="how-step">
          <span className="how-n">3</span>
          <div>
            <h3>몰릴수록 적게 간다</h3>
            <table className="how-table">
              <tbody>
                <tr><td>5:3 · 6:2</td><td><b>+2칸</b></td></tr>
                <tr><td>7:1 · 8:0</td><td>+1칸 <span>— 다 아는 답은 안 쳐준다</span></td></tr>
                <tr><td>4:4 동점</td><td>+1칸 <span>— 모두</span></td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="how-step gold">
          <span className="how-n">4</span>
          <div>
            <h3>부스터 — 이 게임의 심장</h3>
            <p><b>소수를 고르면 충전된다.</b> 지금 지는 대신 나중을 사는 것이다.</p>
            <ul>
              <li>{BOOSTER_CHARGE_MAX}칸이 차면 버튼이 켜진다 (저절로 터지지 않는다)</li>
              <li>켠 라운드에 다수면 <b>이동 ×{BOOSTER_MULTIPLIER}</b></li>
              <li>켰는데 소수면 <b>충전이 그냥 날아간다</b></li>
            </ul>
            <p className="how-note">그래서 "언제 쓰느냐"가 진짜 결정이다.</p>
          </div>
        </section>

        <section className="how-step">
          <span className="how-n">5</span>
          <div>
            <h3>특수 라운드는 미리 알려준다</h3>
            <table className="how-table">
              <tbody>
                <tr><td>4라운드</td><td><b>더블</b> — 이동 2배</td></tr>
                <tr><td>7라운드</td><td><b>역전</b> — 소수가 전진</td></tr>
                <tr><td>10라운드</td><td><b>올인</b> — 내 칸의 {Math.round(ALLIN_MIN * 100)}~{Math.round(ALLIN_MAX * 100)}%를 건다</td></tr>
              </tbody>
            </table>
            <p className="how-note">미리 아니까 다들 딴 생각을 한다. 그게 노림수다.</p>
          </div>
        </section>

        <section className="how-step">
          <span className="how-n">6</span>
          <div>
            <h3>먼저 {CELLS}칸</h3>
            <p>{ROUNDS}라운드 안에 아무도 못 가면 <b>그때 제일 앞선 사람</b>이 이긴다.</p>
          </div>
        </section>
      </div>

      <button className="how-go" onClick={onDone}>
        {first ? "알겠어, 시작하자" : "닫기"}
      </button>
    </div>
  );
}
