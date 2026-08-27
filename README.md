# 결정 장애 레이스

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

**Netlify**로 배포한다. `netlify.toml`이 빌드 설정을 들고 있으므로 저장소를 연결만 하면 된다.
온라인 대전은 **Supabase**를 쓰고, 키가 없으면 온라인 메뉴만 꺼진 채 싱글은 그대로 돌아간다.

절차와 커스텀 도메인 설정은 [`docs/SETUP.md`](docs/SETUP.md)에 정리했다.

## 현재 상태

**Phase 4 진행 중** — 싱글 게임과 연출은 완료(`혼자 하기`), 온라인은 방 만들기·참가까지.
밸런스는 `npm run simulate`로 1000판 자동 대국을 돌려 검증한다.
다음은 온라인 대국 진행(라운드 동기화)과 Phase 4.5 로그인.
