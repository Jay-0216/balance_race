# 배포와 백엔드 설정

## 1. GitHub Pages 배포

Netlify를 안 쓰기로 했으므로 `netlify.toml`은 지웠다.
저장소에 `.github/workflows/deploy.yml`이 있어서 **`main`에 푸시하면 자동으로 배포된다.**

### 처음 한 번만 — 저장소 설정

1. GitHub 저장소 → **Settings → Pages**
2. **Build and deployment → Source**를 **`GitHub Actions`**로 바꾼다
   (기본값인 "Deploy from a branch"로 두면 워크플로가 돌아도 아무것도 안 올라간다)
3. `main`에 푸시하면 **Actions** 탭에 `Deploy to GitHub Pages`가 돈다
4. 끝나면 주소가 나온다: `https://jay-0216.github.io/woow/`

### base 경로 — 여기만 안 틀리면 된다

GitHub Pages의 프로젝트 사이트는 **하위 폴더**(`/woow/`)에서 열린다.
`base`가 `/`면 자바스크립트 주소가 `/assets/...`가 돼서 **흰 화면**만 나온다.

`vite.config.ts`가 이걸 자동으로 고른다:

| `public/CNAME` | base | 주소 |
|---|---|---|
| 없음 | `/woow/` | `jay-0216.github.io/woow/` |
| 있음 | `/` | 커스텀 도메인 루트 |

**스위치가 하나뿐**이라 둘이 어긋날 일이 없다.

### 커스텀 도메인

1. 저장소에 **`public/CNAME`** 파일을 만들고 도메인만 한 줄 적는다:
   ```
   race.example.com
   ```
   빌드하면 `dist/CNAME`으로 복사되고, 동시에 base가 `/`로 바뀐다.
2. 도메인 등록업체 DNS에 레코드를 넣는다:
   - 서브도메인(`race.example.com`) → **CNAME** `jay-0216.github.io`
   - 루트(`example.com`) → **A 레코드 4개**
     `185.199.108.153` / `185.199.109.153` / `185.199.110.153` / `185.199.111.153`
3. Settings → Pages → **Custom domain**에 같은 도메인을 넣고
   **Enforce HTTPS**를 켠다 (인증서 발급까지 몇 분~몇 시간)

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

1. [supabase.com](https://supabase.com) → 네 계정으로 로그인 (GitHub 계정으로 바로 됨)
2. **New project**
   - **Name**: `woow` (뭐든 상관없다)
   - **Database Password**: 자동 생성 눌러서 나온 걸 **어딘가 저장해 둔다.**
     이건 브라우저 앱에서는 안 쓰지만, 잃어버리면 재설정해야 한다
   - **Region**: `Northeast Asia (Seoul)` — 한국에서 하면 여기가 제일 빠르다
   - **Plan**: Free
3. 2분쯤 기다리면 프로젝트가 뜬다

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

### 아직 남은 구멍 — 로그인 전까지

지금은 계정이 없어서 신원이 **브라우저에 저장된 랜덤 id**다.
그래서 방 코드를 아는 사람이 **아직 안 고른 다른 사람의 id로 선택을 대신 낼 수는 있다.**
읽기는 못 하고, 이미 낸 선택도 못 바꾼다.

제대로 막으려면 `player_id`를 `auth.uid()`에 묶어야 하고, 그게 **Phase 4.5 로그인**이다.
친구끼리 코드 공유해서 하는 단계에서는 감수할 만하지만, 공개하기 전에는 반드시 닫아야 한다.
