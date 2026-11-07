-- Account management can be delegated through Settings without Staff-directory
-- access. It must not expose member medical/address data or certificate history.
-- Settings uses the verified, explicitly projected account-summary endpoint.
BEGIN;

CREATE POLICY portal_staff_member_boundary ON public.members
 AS RESTRICTIVE FOR SELECT TO authenticated USING (
  ((id=(SELECT auth.uid())) AND (SELECT public.auth_is_active()))
  OR (SELECT public.is_dojo_staff() AND public.portal_has_permission('page:staff'))
 );

CREATE POLICY portal_staff_address_boundary ON public.member_addresses
 AS RESTRICTIVE FOR SELECT TO authenticated USING (
  ((member_id=(SELECT auth.uid())) AND (SELECT public.auth_is_active()))
  OR (SELECT public.is_dojo_staff() AND public.portal_has_permission('page:staff'))
 );

-- Certificate history has no existing independent self-service read policy.
CREATE POLICY portal_staff_dan_boundary ON public.staff_dan_history
 AS RESTRICTIVE FOR SELECT TO authenticated USING (
  (SELECT public.is_dojo_staff() AND public.portal_has_permission('page:staff'))
 );

NOTIFY pgrst, 'reload schema';
COMMIT;
