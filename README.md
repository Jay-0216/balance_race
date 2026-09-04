# 밸런스 레이스

다수와 같은 선택을 하면 전진하는 눈치게임 레이스.
매 라운드 둘 중 하나의 딜레마를 고르고, 다수 편이면 전진 · 소수면 제자리.

- 기획 및 개발 플랜 — [`docs/PLAN.md`](docs/PLAN.md)
- 배포와 백엔드 설정 — [`docs/SETUP.md`](docs/SETUP.md)
- 레이스 시각화 목업 — [`prototype/race-mockup.html`](prototype/race-mockup.html) (브라우저로 바로 열면 됨)

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ 생성
npm run typecheck
npm run simulate    # 1000판 밸런스 시뮬레이션
```

## 배포 · 백엔드

**GitHub Pages**로 배포한다. `main`에 푸시하면 `.github/workflows/deploy.yml`이 빌드해서 올리고,
커스텀 도메인 [`balance-race.kro.kr`](https://balance-race.kro.kr)로 서비스한다.
온라인 대전·로그인·카드 투표는 **Supabase**를 쓰고, 키가 없으면 그 기능들만 꺼진 채 싱글은 그대로 돌아간다.

절차는 [`docs/SETUP.md`](docs/SETUP.md)에 정리했다.

## 현재 상태

싱글 플레이(혼자 하기·퀴즈 혼자 풀기)와 온라인 대전(같이 레이스·라이브 만들기, realtime 동기화)이
모두 완료됐고, 매직링크 로그인과 기기 간 차고 동기화, 설치형 웹앱(PWA)까지 붙었다.
Phase 6 확장으로 개인 통계(차고의 "다수파 N%")와 카드 투표(커뮤니티가 낸 카드를 투표로
승인·반려)가 추가됐다. 아직 없는 건 시즌 랭킹 — 볼트 경제가 클라이언트를 신뢰하는 구조라
순위표를 얹기 전에 조작 방지가 먼저다.
밸런스는 `npm run simulate`로 1000판 자동 대국을 돌려 검증한다.
자세한 진행 기록은 [`docs/PLAN.md`](docs/PLAN.md).
