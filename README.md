# 결정 장애 레이스

다수와 같은 선택을 하면 전진하는 눈치게임 레이스.
매 라운드 둘 중 하나의 딜레마를 고르고, 다수 편이면 전진 · 소수면 제자리.

- 기획 및 개발 플랜 — [`docs/PLAN.md`](docs/PLAN.md)
- 레이스 시각화 목업 — [`prototype/race-mockup.html`](prototype/race-mockup.html) (브라우저로 바로 열면 됨)

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ 생성
npm run typecheck
npm run simulate    # 1000판 밸런스 시뮬레이션
```

`main`에 푸시하면 GitHub Actions가 GitHub Pages로 배포한다
(저장소 Settings → Pages → Source를 **GitHub Actions**로 한 번 설정해야 동작).

## 현재 상태

**Phase 2 완료** — 봇 7명과 12라운드 실제 게임이 돌아간다. `혼자 하기`에서 확인.
밸런스는 `npm run simulate`로 1000판 자동 대국을 돌려 검증한다.
다음은 Phase 3 — 결과 공개 타임라인, 사운드, 특수 라운드 연출.
