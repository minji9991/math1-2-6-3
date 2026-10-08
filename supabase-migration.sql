-- 기존 프로젝트에 한 번만 실행하세요.
-- 기존 activity_sessions / activity_events / activity_answers / teacher_profiles는 그대로 사용합니다.

alter table public.activity_sessions
  add column if not exists last_seen_at timestamptz default now();

create table if not exists public.lesson_control (
  id integer primary key,
  step_1 boolean not null default true,
  step_2 boolean not null default false,
  step_3 boolean not null default false,
  step_4 boolean not null default false,
  step_5 boolean not null default false,
  step_6 boolean not null default false,
  step_7 boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.lesson_control(id)
values (1)
on conflict (id) do nothing;

alter table public.lesson_control enable row level security;

-- 학생 페이지는 현재 열린 활동 상태를 읽을 수 있어야 함
DROP POLICY IF EXISTS "student_read_lesson_control" ON public.lesson_control;
create policy "student_read_lesson_control"
on public.lesson_control for select
to anon, authenticated
using (true);

-- 교사만 활동 상태를 변경
DROP POLICY IF EXISTS "teacher_update_lesson_control" ON public.lesson_control;
create policy "teacher_update_lesson_control"
on public.lesson_control for update
to authenticated
using (public.is_teacher())
with check (public.is_teacher());

-- 같은 브라우저에서 교사 로그인 후 학생 페이지를 테스트해도 저장되게 허용
DROP POLICY IF EXISTS "authenticated_insert_sessions" ON public.activity_sessions;
create policy "authenticated_insert_sessions"
on public.activity_sessions for insert
to authenticated with check (true);

DROP POLICY IF EXISTS "authenticated_update_sessions" ON public.activity_sessions;
create policy "authenticated_update_sessions"
on public.activity_sessions for update
to authenticated using (true) with check (true);

DROP POLICY IF EXISTS "authenticated_insert_events" ON public.activity_events;
create policy "authenticated_insert_events"
on public.activity_events for insert
to authenticated with check (true);

DROP POLICY IF EXISTS "authenticated_insert_answers" ON public.activity_answers;
create policy "authenticated_insert_answers"
on public.activity_answers for insert
to authenticated with check (true);

-- 기존 익명 학생의 세션 갱신 정책이 없다면 생성
DROP POLICY IF EXISTS "anon_update_sessions" ON public.activity_sessions;
create policy "anon_update_sessions"
on public.activity_sessions for update
to anon using (true) with check (true);
