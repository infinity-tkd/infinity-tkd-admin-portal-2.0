-- Additive student-only self tracking. Official grades and billing are unchanged.
create table public.student_portal_progress (
 student_id varchar(50) not null references public.students(id),
 curriculum_id integer not null references public.curriculum(id),
 completed boolean not null default false,
 repetition_count integer not null default 0 check (repetition_count between 0 and 1000000),
 updated_at timestamptz not null default now(),
 primary key (student_id, curriculum_id)
);
create table public.student_portal_events (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references public.profiles(id),
 student_id varchar(50) not null references public.students(id),
 request_key uuid not null,
 kind text not null check (kind in ('lesson','workout','template','stat')),
 payload jsonb not null check (octet_length(payload::text) <= 65536),
 created_at timestamptz not null default now(),
 unique (actor_id, request_key)
);
create index student_portal_events_student_created on public.student_portal_events(student_id,created_at desc);
create table public.student_portal_preferences (
 user_id uuid primary key references public.profiles(id),
 theme text not null default 'light' check (theme in ('light','dark')),
 language text not null default 'en' check (language in ('en','kh','zh')),
 updated_at timestamptz not null default now()
);
alter table public.student_portal_progress enable row level security;
alter table public.student_portal_events enable row level security;
alter table public.student_portal_preferences enable row level security;
revoke all on public.student_portal_progress, public.student_portal_events, public.student_portal_preferences from public, anon, authenticated;
grant select,insert,update,delete on public.student_portal_progress, public.student_portal_events, public.student_portal_preferences to service_role;

create function public.student_portal_record_event(p_actor uuid, p_student text, p_request uuid, p_kind text, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare actor public.profiles; athlete public.students; existing public.student_portal_events; result public.student_portal_events;
 lesson public.curriculum; current_order integer; target_order integer; repetitions integer; completed boolean;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server only' using errcode='42501'; end if;
 select * into actor from public.profiles where id=p_actor and role='Student' and is_active=true and must_change_password=false for share;
 if not found then raise exception 'Account ineligible' using errcode='42501'; end if;
 select * into athlete from public.students where id=p_student and deleted_at is null and student_status in ('Active','Paused') for share;
 if not found or not (coalesce(athlete.profile_id=p_actor,false) or coalesce(actor.student_id=p_student,false)) then raise exception 'Student mismatch' using errcode='42501'; end if;
 if (athlete.profile_id is not null and athlete.profile_id<>p_actor) or (actor.student_id is not null and actor.student_id<>p_student)
 or exists(select 1 from public.students where profile_id=p_actor and id<>p_student) then raise exception 'Contradictory identity links' using errcode='42501'; end if;
 if p_request is null or p_kind is null or p_payload is null or p_kind not in ('lesson','workout','template','stat') or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>65536 then raise exception 'Invalid event' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text||p_request::text,0));
 select * into existing from public.student_portal_events where actor_id=p_actor and request_key=p_request;
 if found then
  if existing.student_id<>p_student or existing.kind<>p_kind or existing.payload<>p_payload then raise exception 'Request key reused' using errcode='22023'; end if;
  return to_jsonb(existing);
 end if;
 if p_kind='lesson' then
  select * into lesson from public.curriculum where id=(p_payload->>'lessonId')::integer and is_active=true for share;
  if not found then raise exception 'Lesson unavailable' using errcode='22023'; end if;
  if lesson.target_belt is not null and lesson.target_belt not in ('All','All Belts','All Levels','Beginner') then
   select belt_order into current_order from public.belts where belt_name=athlete.current_belt;
   select belt_order into target_order from public.belts where belt_name=lesson.target_belt;
   if current_order is null or target_order is null or current_order<target_order then raise exception 'Lesson unavailable for belt' using errcode='42501'; end if;
  end if;
  repetitions:=coalesce((p_payload->>'repetitionsCount')::integer,0);
  if repetitions not between 0 and 10000 then raise exception 'Invalid repetitions' using errcode='22023'; end if;
  completed:=coalesce((p_payload->>'completed')::boolean,false);
  insert into public.student_portal_progress(student_id,curriculum_id,completed,repetition_count)
  values(p_student,lesson.id,completed,repetitions)
  on conflict(student_id,curriculum_id) do update set
   completed=public.student_portal_progress.completed or excluded.completed,
   repetition_count=least(1000000,public.student_portal_progress.repetition_count+excluded.repetition_count),updated_at=now();
 end if;
 insert into public.student_portal_events(actor_id,student_id,request_key,kind,payload) values(p_actor,p_student,p_request,p_kind,p_payload) returning * into result;
 return to_jsonb(result);
end $$;
revoke all on function public.student_portal_record_event(uuid,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.student_portal_record_event(uuid,text,uuid,text,jsonb) to service_role;
