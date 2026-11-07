-- Documented academy taxonomy; does not create or alter official belt records.
create function public.student_portal_belt_order(p_name text) returns integer
language sql immutable security invoker set search_path='' as $$
 select case regexp_replace(replace(lower(p_name),'belt',''),'[^a-z0-9]','','g')
 when 'white' then 1 when 'yellow' then 2 when 'green' then 3 when 'blue' then 4 when 'brown' then 5 when 'red' then 6
 when 'black1stdan' then 7 when '1stdanblack' then 7 when '1stdan' then 7 when '1stpoomdan' then 7
 when 'black2nddan' then 8 when '2nddanblack' then 8 when '2nddan' then 8 when '2ndpoomdan' then 8
 when 'black3rddan' then 9 when '3rddanblack' then 9 when '3rddan' then 9 when '3rdpoomdan' then 9 else null end
$$;
revoke all on function public.student_portal_belt_order(text) from public,anon,authenticated;
grant execute on function public.student_portal_belt_order(text) to service_role;
create or replace function public.student_portal_record_event(p_actor uuid, p_student text, p_request uuid, p_kind text, p_payload jsonb)
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
   select belt_order into current_order from public.belts where regexp_replace(replace(lower(belt_name),'belt',''),'[^a-z0-9]','','g')=regexp_replace(replace(lower(athlete.current_belt),'belt',''),'[^a-z0-9]','','g');
   select belt_order into target_order from public.belts where regexp_replace(replace(lower(belt_name),'belt',''),'[^a-z0-9]','','g')=regexp_replace(replace(lower(lesson.target_belt),'belt',''),'[^a-z0-9]','','g');
   if not exists(select 1 from public.belts) then current_order:=public.student_portal_belt_order(athlete.current_belt); target_order:=public.student_portal_belt_order(lesson.target_belt); end if;
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
