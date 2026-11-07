-- Full student/staff records are private module data. Other operational screens
-- use the verified server summary endpoints with explicit field allowlists.
-- Restrictive SELECT fences narrow every existing permissive read policy without
-- replacing write rules, changing saved grants or changing business records.
BEGIN;

CREATE POLICY portal_directory_record_boundary ON public.students
 AS RESTRICTIVE FOR SELECT TO authenticated USING (
  (SELECT public.is_dojo_staff() AND public.portal_has_permission('page:directory'))
  OR public.is_current_student(id)
 );

-- Own-profile bootstrap is required before MFA setup/challenge. This does not
-- grant access to another profile or bypass the existing Student browser fence.
CREATE POLICY portal_staff_profile_boundary ON public.profiles
 AS RESTRICTIVE FOR SELECT TO authenticated USING (
  (id=(SELECT auth.uid()) AND is_active=true)
  OR (SELECT public.is_dojo_staff() AND public.portal_has_permission('page:staff'))
 );

CREATE POLICY portal_pos_catalog_boundary ON public.products
 AS RESTRICTIVE FOR SELECT TO authenticated USING (
  (SELECT public.is_dojo_staff() AND public.portal_has_permission('page:pos'))
 );
CREATE POLICY portal_pos_variant_boundary ON public.product_variants
 AS RESTRICTIVE FOR SELECT TO authenticated USING (
  (SELECT public.is_dojo_staff() AND public.portal_has_permission('page:pos'))
 );

CREATE POLICY portal_learning_asset_boundary ON public.library_assets
 AS RESTRICTIVE FOR SELECT TO authenticated USING (
  (SELECT public.is_dojo_staff() AND (
   public.portal_has_permission('page:library') OR public.portal_has_permission('page:lms')
   OR public.portal_has_permission('page:directory')
  ))
 );
CREATE POLICY portal_learning_template_boundary ON public.workout_templates
 AS RESTRICTIVE FOR SELECT TO authenticated USING (
  (SELECT public.is_dojo_staff() AND (
   public.portal_has_permission('page:library') OR public.portal_has_permission('page:lms')
   OR public.portal_has_permission('page:directory')
  ))
 );

CREATE POLICY portal_shared_schedule_boundary ON public.class_sessions
 AS RESTRICTIVE FOR SELECT TO authenticated USING (
  (SELECT public.is_dojo_staff() AND (
   public.portal_has_permission('page:schedule') OR public.portal_has_permission('page:attendance')
   OR public.portal_has_permission('page:dashboard') OR public.portal_has_permission('page:directory')
   OR public.portal_has_permission('page:financials') OR public.portal_has_permission('page:lms')
   OR public.portal_has_permission('page:pos')
  ))
 );

NOTIFY pgrst, 'reload schema';
COMMIT;
