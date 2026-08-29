# 배포와 백엔드 설정

## 1. GitHub Pages 배포

Netlify를 안 쓰기로 했으므로 `netlify.toml`은 지웠다.
저장소에 `.github/workflows/deploy.yml`이 있어서 **`main`에 푸시하면 자동으로 배포된다.**

### 처음 한 번만 — 저장소 설정

1. GitHub 저장소 → **Settings → Pages**
2. **Build and deployment → Source**를 **`GitHub Actions`**로 바꾼다
   (기본값인 "Deploy from a branch"로 두면 워크플로가 돌아도 아무것도 안 올라간다)
3. `main`에 푸시하면 **Actions** 탭에 `Deploy to GitHub Pages`가 돈다
4. 끝나면 주소가 나온다: `https://jay-0216.github.io/balance_race/`

### base 경로 — 여기만 안 틀리면 된다

GitHub Pages의 프로젝트 사이트는 **하위 폴더**(`/balance_race/`)에서 열린다.
`base`가 `/`면 자바스크립트 주소가 `/assets/...`가 돼서 **흰 화면**만 나온다.

`vite.config.ts`가 이걸 자동으로 고른다:

| `public/CNAME` | base | 주소 |
|---|---|---|
| 없음 | `/balance_race/` | `jay-0216.github.io/balance_race/` |
| 있음 | `/` | 커스텀 도메인 루트 |

**스위치가 하나뿐**이라 둘이 어긋날 일이 없다.

### 커스텀 도메인 — `balance-race.kro.kr`

**적용됨.** `public/CNAME`에 `balance-race.kro.kr` 한 줄이 들어 있고,
그래서 방금 빌드에서 base가 자동으로 `/`로 바뀐 걸 확인했다 (`vite.config.ts`가 이 파일을 본다).
남은 두 군데만 손으로 해주면 된다.

#### 1) kro.kr 관리 페이지에서 DNS를 넣는다

`kro.kr`는 무료 서브도메인 서비스라, 도메인 등록업체가 아니라 **kro.kr 자체 관리 콘솔**에
레코드를 넣는다 (im.kro.kr, 로그인 후 내 도메인 관리 → `balance-race.kro.kr` → 레코드 추가):

| 타입 | 호스트 | 값 |
|---|---|---|
| CNAME | `balance-race` (또는 빈 칸 — 콘솔이 요구하는 형식대로) | `jay-0216.github.io` |

kro.kr가 CNAME을 안 받아주는 서브도메인 형태라면(루트처럼 취급되는 경우) A 레코드 4개로 대신한다:

| 타입 | 호스트 | 값 |
|---|---|---|
| A | `balance-race` | `185.199.108.153` |
| A | `balance-race` | `185.199.109.153` |
| A | `balance-race` | `185.199.110.153` |
| A | `balance-race` | `185.199.111.153` |

#### 2) GitHub에 같은 도메인을 등록한다

저장소 → **Settings → Pages → Custom domain**에 `balance-race.kro.kr`을 넣고 **Save**.
GitHub이 DNS를 확인하는 데 몇 분~몇 시간 걸린다. 확인되면 **Enforce HTTPS**가
눌리게 되는데 **반드시 켠다.**

#### 잘 안 될 때

| 증상 | 원인 |
|---|---|
| "Domain does not resolve to the GitHub Pages server" | DNS가 아직 안 퍼졌다. 보통 10분~1시간, 길면 하루 |
| 사이트는 열리는데 **흰 화면** | 옛날 빌드가 캐시된 것. 강력 새로고침(Ctrl/Cmd+Shift+R) |
| HTTPS 체크박스가 회색 | 인증서 발급 전. 도메인 확인이 끝나야 켜진다 |
| 도메인이 저장소에서 자꾸 지워짐 | `public/CNAME`이 삭제됐다는 뜻. 배포 때마다 이 파일이 `dist/CNAME`으로 복사되며 지켜준다 |

> **`main`이 배포 브랜치다.** 작업은 `claude/...` 브랜치에서 하고 끝나면 `main`에 합친다.
> 합친 순간이 배포되는 순간이므로 **`main`은 항상 켜지는 상태여야 한다** —
> 합치기 전에 `npm run build`가 통과하는지 확인한다.

> **주의:** GitHub Pages에는 리다이렉트 규칙이 없다. 지금은 화면 전환이
> 전부 React 상태라 주소가 하나뿐이라 상관없지만, 나중에 진짜 라우터를 넣으면
> `dist/404.html`에 `index.html`을 복사하는 단계가 필요해진다.

---

## 2. Supabase 연결

### 2-0. 프로젝트는 네 계정에서 네가 만든다

여기(이 세션)에 연결된 Supabase 계정은 **네 계정이 아니다.**
그래서 마이그레이션을 대신 실행해 줄 수가 없다 — 남의 계정 DB에 테이블을 만드는 셈이 된다.
아래 순서대로 하면 5분이면 된다. SQL은 저장소에 이미 다 들어 있고, 붙여넣기만 하면 된다.

**이미 만들어져 있다.** 프로젝트 `balance_race`
(ref `niyrygzokkdppoafmker`, `https://niyrygzokkdppoafmker.supabase.co`)에
스키마 세 개를 전부 적용해뒀다 — 방·선택·계정·버그제보·카드제출.
새로 만들 일이 생기면 아래 순서다.

1. [supabase.com](https://supabase.com) → 네 계정으로 로그인 (GitHub 계정으로 바로 됨)
2. **New project** → Name 아무거나 / Region은 서울이나 도쿄 / Plan은 Free
3. `supabase/migrations/`의 `.sql` 일곱 개를 **번호 순서대로** SQL Editor에 붙여넣고 Run

무료 플랜은 **일주일 동안 아무도 안 쓰면 자동으로 일시정지**된다.
멈춰도 데이터는 안 없어지고, 대시보드에서 **Restore**를 누르면 다시 산다.

### 2-1. 키 가져오기

Supabase 대시보드 → 해당 프로젝트 → **Project Settings → API**

| 항목 | 넣을 곳 |
|---|---|
| Project URL | `VITE_SUPABASE_URL` |
| `anon` / `publishable` key | `VITE_SUPABASE_ANON_KEY` |

로컬은 저장소 루트에 `.env.local`을 만든다 (`.gitignore`에 있으므로 커밋되지 않는다):

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

**배포본에도 같은 두 개가 필요하다.** GitHub Pages는 정적 호스팅이라 환경변수 설정 칸이
없고, 값은 **빌드할 때** 번들에 박힌다. 그래서 GitHub Actions 쪽에 넣는다:

1. 저장소 → **Settings → Secrets and variables → Actions → New repository secret**
2. `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 두 개를 만든다
3. `.github/workflows/deploy.yml`의 빌드 단계에 넘겨준다:

```yaml
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

> 이 두 값은 **빌드 결과물에 그대로 들어간다.** 브라우저에서 보면 보인다.
> 그래도 되는 이유는 아래 3장에 있다 — `anon` 키는 RLS가 허락한 것만 할 수 있다.
> Secret에 넣는 건 저장소에 커밋하지 않으려는 것뿐이다.

> ⚠️ **`service_role` 키는 절대 넣지 말 것.** 그 키는 RLS를 통째로 무시한다.
> 브라우저에 들어가는 순간 누구나 남의 선택을 읽고 남의 방을 지울 수 있다.
> `anon` 키는 RLS가 허용한 것만 할 수 있어서 공개돼도 안전하다.

### 2-2. 스키마 적용

`supabase/migrations/0001_rooms.sql` 하나를 실행하면 된다.

**대시보드에서:** SQL Editor → New query → 파일 내용 붙여넣기 → Run

**CLI를 쓴다면:**
```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

### 2-3. 확인

- **Table Editor**에 `rooms`, `players`, `choices` 세 개가 보인다
- `choices`에 **SELECT 정책이 없다** — 이게 정상이다. 아래 참고
- **Database → Replication**에서 `rooms`, `players`가 realtime에 올라와 있다
  (`choices`는 일부러 빼놨다)

---

## 3. 이 스키마가 지키려는 것 하나

**아무도 남의 선택을 미리 볼 수 없어야 한다.** 나머지는 전부 부수적이다.

- `choices` 테이블에는 **SELECT 정책이 아예 없다.** RLS가 켜진 상태에서 정책이 없으면
  모든 읽기가 0행을 돌려준다. anon 키로는 물어봐도 못 본다.
- 집계는 `close_round()` RPC로만 나오고, 이 함수는 **마감 전이면 거절한다** —
  시간이 다 됐거나 전원이 제출했을 때만 답한다.
- 몇 명이 골랐는지는 `locked_count()`가 따로 알려준다. **몇 명인지는 알려주되 뭘 골랐는지는 안 알려준다.**
- `choices`는 realtime 발행 목록에서 **뺐다.** 구독을 열어두면 숨기려던 걸 그대로 흘려보낸다.
- 기본키가 `(방, 라운드, 플레이어)`라 **한 번 낸 선택은 못 바꾼다.**
  잠금 핍이 차는 걸 보고 마음을 바꾸는 게 막힌다.

### 스모크 테스트가 잡은 두 개 (닫음)

스키마를 넣고 나서 **anon 역할로 직접 시나리오를 돌려봤고, 첫 판에 두 개가 걸렸다.**

**1. 빈 방이 라운드를 열어줬다.** `close_round`는 "답한 사람 수 ≥ 사람 수"로 마감을 판단했는데,
플레이어가 0명이면 `1 ≥ 0`이라 **참**이다. 방을 만들고 선택 하나 넣고 부르면 그대로 답이 나왔다.
→ 이제 `사람 수 < 2`면 시계가 끝나기 전에는 절대 안 열어준다.

**2. 남을 봇으로 만들 수 있었다.** `players_update`가 `using (true)`라
방 코드만 알면 **다른 사람 행의 `is_bot`을 true로 바꿀 수 있었다.**
봇은 인원수에서 빠지므로 8명 중 6명을 봇으로 만들면 기준이 2명으로 떨어지고,
**시계가 도는 중에 전원의 선택을 읽을 수 있었다.**
→ `player_id`·`room_code`·`is_bot`·`seat`은 트리거로 **못 바꾸게 막았다.**
점수와 충전만 움직인다.

RLS의 UPDATE 검사는 옛 행과 새 행을 동시에 못 봐서, 정책이 아니라 트리거여야 한다.

### 아직 남은 구멍 — 게스트가 있는 한

계정 없이도 놀 수 있어야 하므로, 신원은 여전히 **브라우저에 저장된 랜덤 id**일 수 있다.
그래서 방 코드를 아는 사람이 **아직 안 고른 다른 사람의 id로 선택을 대신 낼 수는 있다.**
읽기는 못 하고, 이미 낸 선택도 못 바꾸고, 남을 봇으로 만들 수도 이제 없다.

완전히 막으려면 `player_id`를 `auth.uid()`에 묶고 **로그인을 필수로** 해야 한다.
로그인 자체는 붙었으니, 남은 건 "방에 들어오려면 로그인" 규칙을 켤지 결정하는 것뿐이다.
친구끼리 코드 공유해서 하는 단계에서는 감수할 만하다.

---

## 4. 로그인 · 버그 제보 · 카드 제출

### 4-1. 로그인 (이메일 매직 링크)

비밀번호가 없다. 이메일을 넣으면 링크가 오고, 그걸 누르면 로그인된다.
**설정할 게 딱 하나 있다** — 링크가 돌아올 주소를 Supabase에 알려줘야 한다:

Supabase 대시보드 → **Authentication → URL Configuration**

| 칸 | 넣을 값 |
|---|---|
| Site URL | `https://balance-race.kro.kr` |
| Redirect URLs | 위 주소 + `https://jay-0216.github.io/balance_race/` + `http://localhost:5173/balance_race/` (개발용) |

**이 목록에 없는 주소로는 링크가 안 돌아온다** — 그게 이 설정의 존재 이유다.
커스텀 도메인이 아직 안 붙었을 때를 대비해 GitHub Pages 기본 주소도 같이 넣어둔다 — 둘 다 있어야
도메인 붙이기 전후로 로그인이 끊기지 않는다.

> 내장 메일러는 **시간당 몇 통**으로 제한된다. 친구들끼리 쓰기엔 충분하지만
> 갑자기 30명이 동시에 가입하면 막힌다. 그땐 Authentication → Emails에서
> 외부 SMTP를 붙이면 된다.

> 로그인은 **선택**이다. 안 해도 전부 할 수 있고, 하면 이름이 기기를 따라온다.
> 나중에 Auth → Providers에서 **Anonymous sign-ins**를 켜면 이메일 없이도
> 진짜 계정을 줄 수 있다. 지금은 그 토글이 꺼져 있어서 안 넣었다.

### 4-2. 버그 제보 읽기

Table Editor → **`feedback`**. 앱에서는 **쓰기만 되고 읽기는 안 된다**
(select 정책이 아예 없다). 그래서 제보 내용은 여기서만 보인다.

`context` 칸에 화면 크기와 브라우저가 같이 들어온다. 재현할 때 쓰라고 넣은 것이다.

### 4-3. 카드 승인하기

플레이어가 낸 카드는 `card_submissions`에 **`pending`** 으로 들어온다.
이 상태에서는 낸 사람만 볼 수 있고 게임에는 안 나온다.

Table Editor → `card_submissions` → 쓸 만한 카드의 **`status`를 `approved`로** 바꾼다.
그 순간부터 모두의 덱에 섞인다 (앱이 시작할 때 승인된 카드를 가져온다).

**고르는 기준은 하나다: 둘 다 고를 만한가.**
한쪽이 명백한 정답이면 8명이 다 같은 쪽으로 몰려서 +1칸짜리 지루한 라운드가 된다.
