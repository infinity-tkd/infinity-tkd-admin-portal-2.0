-- Isolated approval snapshots. No athlete is published by applying this setup.
create table public.student_portal_ranking_publications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 120),
  season_start date not null,
  season_end date not null check (season_end >= season_start),
  methodology text not null default 'medal_order' check (methodology = 'medal_order'),
  entries jsonb not null check (jsonb_typeof(entries)='array' and jsonb_array_length(entries) between 1 and 1000),
  approval_reference text not null check (length(btrim(approval_reference)) between 1 and 200),
  approved_by uuid not null references public.profiles(id),
  approved_at timestamptz not null,
  publish_from timestamptz not null default now(),
  publish_until timestamptz not null check (publish_until > publish_from),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.student_portal_ranking_publications enable row level security;
revoke all on public.student_portal_ranking_publications from public, anon, authenticated;
grant select,insert,update,delete on public.student_portal_ranking_publications to service_role;
create index student_portal_ranking_publications_active_idx
  on public.student_portal_ranking_publications (approved_at desc) where revoked_at is null;
create function public.validate_student_ranking_publication() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare entry jsonb; medal text; medal_count numeric;
begin
  if not exists (select 1 from public.profiles where id=new.approved_by and is_active=true
    and role in ('Root','Super Root','Admin','Head Coach')) then
    raise exception 'An active academy approver is required';
  end if;
  if new.approved_at>now() then raise exception 'Approval cannot be in the future'; end if;
  for entry in select value from jsonb_array_elements(new.entries) loop
    if jsonb_typeof(entry) is distinct from 'object' then
      raise exception 'Each published athlete must be an object';
    end if;
    if not (entry ?& array['student_id','display_name','consent_reference','gold','silver','bronze'])
      or (select count(*) from jsonb_object_keys(entry))<>6 then
      raise exception 'Only approved athlete fields are allowed';
    end if;
    if jsonb_typeof(entry->'student_id') is distinct from 'string'
      or jsonb_typeof(entry->'display_name') is distinct from 'string'
      or jsonb_typeof(entry->'consent_reference') is distinct from 'string'
      or length(btrim(entry->>'student_id')) not between 1 and 64
      or length(btrim(entry->>'display_name')) not between 1 and 120
      or length(btrim(entry->>'consent_reference')) not between 1 and 200 then
      raise exception 'Each athlete needs an approved display name and consent reference';
    end if;
    if not exists (select 1 from public.students where id=entry->>'student_id') then
      raise exception 'Published athlete must refer to an academy student';
    end if;
    foreach medal in array array['gold','silver','bronze'] loop
      if jsonb_typeof(entry->medal) is distinct from 'number' then
        raise exception 'Published medal counts must be integers';
      end if;
      medal_count := (entry->>medal)::numeric;
      if medal_count<0 or medal_count>10000 or trunc(medal_count)<>medal_count then
        raise exception 'Published medal counts must be integers between 0 and 10000';
      end if;
    end loop;
  end loop;
  if (select count(*)<>count(distinct value->>'student_id') from jsonb_array_elements(new.entries)) then
    raise exception 'Duplicate athlete in publication';
  end if;
  return new;
end $$;
revoke all on function public.validate_student_ranking_publication() from public,anon,authenticated;
grant execute on function public.validate_student_ranking_publication() to service_role;
create trigger validate_student_ranking_publication before insert or update
  on public.student_portal_ranking_publications for each row
  execute function public.validate_student_ranking_publication();
comment on table public.student_portal_ranking_publications is
  'Staff-approved, time-bounded snapshots. Private academy records do not imply publication or consent.';
