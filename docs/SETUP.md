# 배포와 백엔드 설정

## 1. Netlify 배포 (커스텀 도메인)

저장소에 `netlify.toml`이 있으므로 빌드 설정은 **입력할 게 없다.** Netlify가 읽어간다.

```toml
command = "npm run build"
publish = "dist"
NODE_VERSION = "22"
```

### 처음 연결

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**
2. **GitHub** 선택 → `Jay-0216/woow` 저장소 선택
3. Branch를 배포할 브랜치로 지정 (보통 `main`)
4. 빌드 설정은 `netlify.toml`이 채우므로 그대로 두고 **Deploy**

이후 그 브랜치에 푸시할 때마다 자동 배포된다.
PR을 올리면 **Deploy Preview**가 따로 생겨서 합치기 전에 눌러볼 수 있다.

### 커스텀 도메인

1. Netlify 사이트 → **Domain management → Add a domain**
2. 도메인을 입력하면 Netlify가 방식을 알려준다:
   - **Netlify DNS로 옮기기 (권장)** — 도메인 등록업체에서 네임서버를 Netlify 것으로 바꾼다.
     HTTPS 인증서와 갱신을 Netlify가 알아서 한다.
   - **DNS만 가리키기** — 등록업체에 레코드를 직접 넣는다:
     - 루트 `example.com` → **A 레코드 `75.2.60.5`** (또는 ALIAS/ANAME을 지원하면 `apex-loadbalancer.netlify.com`)
     - `www` → **CNAME `<사이트이름>.netlify.app`**
3. DNS가 퍼지면 (보통 몇 분~몇 시간) Netlify가 **Let's Encrypt 인증서를 자동 발급**한다.
   HTTPS가 안 켜지면 Domain management에서 **Verify DNS configuration**을 눌러본다.

> **주의:** `vite.config.ts`의 `base`는 `"/"`다. Netlify는 도메인 루트에 배포하기 때문.
> GitHub Pages로 되돌린다면 그때만 `"/woow/"`로 바꾸면 된다.

### GitHub Pages는 뺐다

Netlify로 가기로 했으므로 `.github/workflows/deploy.yml`은 삭제했다.
두 곳에 동시에 배포하면 어느 쪽이 최신인지 헷갈리고, Pages는 base 경로가 달라서
같은 빌드로 둘 다 맞출 수 없다.

---

## 2. Supabase 연결

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

Netlify는 **Site settings → Environment variables**에 같은 두 개를 넣고 재배포한다.

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
