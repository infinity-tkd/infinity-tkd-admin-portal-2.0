create function public.student_portal_cancel_pending_order(p_actor uuid,p_student text,p_order uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor public.profiles; athlete public.students; o public.pos_orders; item record;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server only' using errcode='42501'; end if;
 select * into actor from public.profiles where id=p_actor and role='Student' and is_active=true and must_change_password=false for share;
 if not found then raise exception 'Account ineligible' using errcode='42501'; end if;
 select * into athlete from public.students where id=p_student and deleted_at is null for share;
 if not found or not (coalesce(athlete.profile_id=p_actor,false) or coalesce(actor.student_id=p_student,false)) then raise exception 'Student mismatch' using errcode='42501'; end if;
 if (athlete.profile_id is not null and athlete.profile_id<>p_actor) or (actor.student_id is not null and actor.student_id<>p_student) or exists(select 1 from public.students where profile_id=p_actor and id<>p_student) then raise exception 'Contradictory identity links' using errcode='42501'; end if;
 select * into o from public.pos_orders where id=p_order and student_id=p_student and order_channel='STUDENT_PORTAL' for update;
 if not found then raise exception 'Order unavailable' using errcode='42501'; end if;
 if o.order_status='CANCELLED' then return jsonb_build_object('order_id',o.id,'order_status',o.order_status); end if;
 if o.order_status<>'PENDING_CONFIRMATION' or o.payment_status<>'PENDING' then raise exception 'Contact academy to cancel a confirmed or settled order' using errcode='22023'; end if;
 if length(trim(p_reason)) not between 3 and 500 then raise exception 'Reason required' using errcode='22023'; end if;
 if o.stock_reserved then
  for item in select * from public.pos_order_items where order_id=o.id order by product_id,variant_id loop
   perform public.portal_stock_change(item.product_id,item.variant_id,item.quantity,'ORDER_CANCELLED_RESTORE',p_actor,o.id,p_reason);
  end loop;
 end if;
 update public.pos_orders set order_status='CANCELLED',payment_status='VOID',stock_reserved=false,cancelled_at=now(),cancellation_reason=p_reason,updated_at=now() where id=o.id;
 insert into public.audit_logs(action,performed_by,target_id,details) values('STUDENT_ORDER_CANCELLED',p_actor::text,o.id::text,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('order_id',o.id,'order_status','CANCELLED','payment_status','VOID');
end $$;
revoke all on function public.student_portal_cancel_pending_order(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.student_portal_cancel_pending_order(uuid,text,uuid,text) to service_role;
