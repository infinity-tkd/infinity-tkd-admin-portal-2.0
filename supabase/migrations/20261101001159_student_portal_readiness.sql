-- Additive, service-only publication storage. Applying setup publishes no policy or result.
create table public.student_portal_readiness_policies (
  id uuid primary key default gen_random_uuid(),
  target_belt text not null check (length(btrim(target_belt)) between 1 and 80),
  version text not null check (length(btrim(version)) between 1 and 60),
  requirements jsonb not null check (jsonb_typeof(requirements) = 'object'),
  approval_reference text not null check (length(btrim(approval_reference)) between 1 and 200),
  approved_by uuid not null references public.profiles(id),
  approved_at timestamptz not null,
  publish_from timestamptz not null,
  publish_until timestamptz not null check (publish_until > publish_from),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(target_belt,version),
  check (approved_at <= publish_from)
);
create table public.student_portal_coach_confirmations (
  id uuid primary key default gen_random_uuid(),
  student_id varchar not null references public.students(id),
  policy_id uuid not null references public.student_portal_readiness_policies(id),
  requirement_key text not null check (requirement_key ~ '^[a-z0-9_-]{1,60}$'),
  result text not null check (result in ('passed','needs_work')),
  confirmed_by uuid not null references public.profiles(id),
  confirmed_at timestamptz not null,
  confirmation_reference text not null check (length(btrim(confirmation_reference)) between 1 and 200),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.student_portal_readiness_policies enable row level security;
alter table public.student_portal_coach_confirmations enable row level security;
revoke all on public.student_portal_readiness_policies, public.student_portal_coach_confirmations from public,anon,authenticated;
grant select,insert,update,delete on public.student_portal_readiness_policies, public.student_portal_coach_confirmations to service_role;
create index student_portal_readiness_active_idx on public.student_portal_readiness_policies(publish_from desc) where revoked_at is null;
create index student_portal_coach_confirmations_student_idx on public.student_portal_coach_confirmations(student_id,policy_id,confirmed_at desc);
create function public.validate_student_readiness_policy() returns trigger
language plpgsql security invoker set search_path = public,pg_temp as $$
declare r jsonb; item jsonb; ids text[] := '{}';
begin
  if tg_op='UPDATE' and (to_jsonb(new)-'revoked_at') is distinct from (to_jsonb(old)-'revoked_at') then
    raise exception 'Published requirements are immutable; publish a new version';
  end if;
  if not exists(select 1 from public.profiles where id=new.approved_by and is_active=true and role in ('Root','Super Root','Admin','Head Coach'))
    or new.approved_at>now() then raise exception 'Active academy approval is required'; end if;
  r := new.requirements;
  if not (r ?& array['minimumDays','minimumAverageGrade','attendance','lessons','skills']) or (select count(*) from jsonb_object_keys(r))<>5 then
    raise exception 'Invalid published requirement fields';
  end if;
  if jsonb_typeof(r->'minimumDays') is distinct from 'number' or (r->>'minimumDays') !~ '^[0-9]{1,5}$' or (r->>'minimumDays')::numeric>10000
    or jsonb_typeof(r->'minimumAverageGrade') is distinct from 'number' or (r->>'minimumAverageGrade')::numeric not between 0 and 4
    or jsonb_typeof(r->'attendance') is distinct from 'object'
    or not ((r->'attendance') ?& array['minimum','basis'])
    or (select count(*) from jsonb_object_keys(r->'attendance'))<>2
    or jsonb_typeof(r->'attendance'->'minimum') is distinct from 'number'
    or (r->'attendance'->>'minimum') !~ '^[0-9]{1,5}$' or (r->'attendance'->>'minimum')::numeric>10000
    or r->'attendance'->>'basis' not in ('unique_days','class_records','dated_sessions')
    or jsonb_typeof(r->'lessons') is distinct from 'array' or jsonb_array_length(r->'lessons')>200
    or jsonb_typeof(r->'skills') is distinct from 'array' or jsonb_array_length(r->'skills')>100
    or ((r->>'minimumAverageGrade')::numeric>0 and jsonb_array_length(r->'skills')=0) then raise exception 'Invalid published thresholds'; end if;
  for item in select value from jsonb_array_elements((r->'lessons')||(r->'skills')) loop
    if jsonb_typeof(item) is distinct from 'object' or item->>'id' is null or item->>'id' !~ '^[a-z0-9_-]{1,60}$' or item->>'id'=any(ids)
      or jsonb_typeof(item->'label') is distinct from 'object' or not ((item->'label') ?& array['en','kh','zh']) then raise exception 'Invalid or duplicate requirement'; end if;
    ids := array_append(ids,item->>'id');
  end loop;
  for item in select value from jsonb_array_elements(r->'lessons') loop
    if jsonb_typeof(item->'curriculumId') is distinct from 'number' or (item->>'curriculumId') !~ '^[0-9]{1,10}$'
      or not exists(select 1 from public.curriculum where id=(item->>'curriculumId')::bigint and is_active=true) then raise exception 'An active published lesson is required'; end if;
  end loop;
  for item in select value from jsonb_array_elements(r->'skills') loop
    if jsonb_typeof(item->'skillName') is distinct from 'string' or length(btrim(item->>'skillName')) not between 1 and 160
      or jsonb_typeof(item->'minimumGrade') is distinct from 'number' or (item->>'minimumGrade') !~ '^[1-4]$' then raise exception 'Invalid skill requirement'; end if;
  end loop;
  return new;
end $$;
create trigger student_readiness_policy_check before insert or update on public.student_portal_readiness_policies for each row execute function public.validate_student_readiness_policy();
create function public.validate_student_coach_confirmation() returns trigger
language plpgsql security invoker set search_path = public,pg_temp as $$
begin
  if tg_op='UPDATE' and (to_jsonb(new)-'revoked_at') is distinct from (to_jsonb(old)-'revoked_at') then raise exception 'Confirmations are immutable; record a new result'; end if;
  if not exists(select 1 from public.profiles where id=new.confirmed_by and is_active=true and role in ('Root','Super Root','Admin','Head Coach','Coach','Assistant Coach'))
    or new.confirmed_at>now() then raise exception 'An active coach confirmation is required'; end if;
  if not exists(select 1 from public.students where id=new.student_id and deleted_at is null) then raise exception 'An existing student is required'; end if;
  if not exists(select 1 from public.student_portal_readiness_policies p, lateral jsonb_array_elements(p.requirements->'lessons') lesson
    where p.id=new.policy_id and p.revoked_at is null and new.confirmed_at>=p.publish_from and new.confirmed_at<p.publish_until and lesson->>'id'=new.requirement_key) then
    raise exception 'A published lesson requirement is required';
  end if;
  return new;
end $$;
create trigger student_coach_confirmation_check before insert or update on public.student_portal_coach_confirmations for each row execute function public.validate_student_coach_confirmation();
revoke all on function public.validate_student_readiness_policy(),public.validate_student_coach_confirmation() from public,anon,authenticated;
grant execute on function public.validate_student_readiness_policy(),public.validate_student_coach_confirmation() to service_role;
