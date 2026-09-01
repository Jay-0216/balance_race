-- 카드 투표: pending 카드를 사람 손이 아니라 표로 걸러낸다.
--
-- 지금까지는 status가 'approved'로 바뀌는 유일한 길이 대시보드에서 손으로
-- 고치는 것뿐이었다. 그 자리를 대체하는 게 아니라 - 대시보드는 여전히 열려
-- 있다 - 더해서, 표가 임계값을 넘으면 같은 일이 자동으로 일어나게 한다.
--
-- 투표자 신원은 0007/0009의 좌석 토큰만큼 단단하지 않다. 여기 걸린 건 남의
-- 계정을 훔치는 문제가 아니라 장난 카드 하나를 밀어 넣는 문제라서, 클라이언트가
-- 스스로 대는 키(로그인했으면 유저 id, 아니면 이 기기의 로컬 id)로 충분하다 -
-- 볼트 병합에서 이미 받아들인 것과 같은 수준의 타협이다. 그 키를 DB 유니크
-- 제약으로 못 박아서 "한 카드에 한 표"는 실제로 지켜지게 한다.

alter table public.card_submissions
  add column if not exists submitter_key text;

-- pending 카드도 다른 사람이 읽을 수 있어야 투표를 할 수 있다. rejected는
-- 여전히 작성자만 본다 - 떨어진 카드를 남들에게 계속 보여줄 이유는 없다.
drop policy if exists cards_read_open on public.card_submissions;
create policy cards_read_open on public.card_submissions
  for select using (
    status in ('approved', 'pending') or (user_id is not null and user_id = auth.uid())
  );

create table if not exists public.card_votes (
  submission_id uuid        not null references public.card_submissions(id) on delete cascade,
  voter_key     text        not null check (length(voter_key) between 3 and 80),
  value         smallint    not null check (value in (1, -1)),
  created_at    timestamptz not null default now(),
  primary key (submission_id, voter_key)
);

alter table public.card_votes enable row level security;
-- no policies at all: raw rows are reachable only through the functions
-- below, which is what stops a client from reading who voted what.

/**
 * Cast (or change) a vote, and flip the card's status once it crosses a
 * threshold. Runs as the function owner because ordinary players have no
 * update policy on card_submissions - the dashboard's manual approval is
 * still the other legal way a card gets there, and stays that way.
 */
create or replace function public.vote_card(
  p_submission_id uuid, p_voter_key text, p_value smallint
) returns table (status text, up int, down int)
language plpgsql security definer set search_path = public as $$
declare
  v_submitter text;
  v_status    text;
  v_up        int;
  v_down      int;
begin
  if p_value not in (1, -1) then
    raise exception 'invalid vote value';
  end if;
  if length(coalesce(p_voter_key, '')) < 3 then
    raise exception 'weak voter key';
  end if;

  -- bare "status" here would be ambiguous: returns table(status text, ...)
  -- implicitly declares an OUT variable of that name, which collides with
  -- the column of the same name - so every reference below is qualified.
  select cs.submitter_key, cs.status into v_submitter, v_status
    from card_submissions cs where cs.id = p_submission_id for update;
  if not found then raise exception 'no such card'; end if;
  if v_status <> 'pending' then raise exception 'card already decided'; end if;
  if v_submitter is not null and v_submitter = p_voter_key then
    raise exception 'cannot vote on your own card';
  end if;

  insert into card_votes (submission_id, voter_key, value)
    values (p_submission_id, p_voter_key, p_value)
    on conflict (submission_id, voter_key) do update set value = excluded.value;

  select
      count(*) filter (where cv.value = 1)::int,
      count(*) filter (where cv.value = -1)::int
    into v_up, v_down
    from card_votes cv where cv.submission_id = p_submission_id;

  -- 재미없다고 판단하는 쪽이 문턱이 낮다: 시시한 카드를 가차없이 버리자던
  -- 것도 계획 문서 원래 방향이었다.
  if (v_up - v_down) >= 5 then
    update card_submissions cs set status = 'approved' where cs.id = p_submission_id;
    v_status := 'approved';
  elsif (v_up - v_down) <= -3 then
    update card_submissions cs set status = 'rejected' where cs.id = p_submission_id;
    v_status := 'rejected';
  end if;

  return query select v_status, v_up, v_down;
end;
$$;

/** Batched tallies for a list screen, plus the caller's own vote if any. */
create or replace function public.card_vote_counts(p_ids uuid[], p_voter_key text)
returns table (submission_id uuid, up int, down int, mine smallint)
language sql security definer set search_path = public as $$
  select
    s.id,
    count(*) filter (where v.value = 1)::int,
    count(*) filter (where v.value = -1)::int,
    max(v.value) filter (where v.voter_key = p_voter_key)
  from unnest(p_ids) as s(id)
  left join card_votes v on v.submission_id = s.id
  group by s.id;
$$;
