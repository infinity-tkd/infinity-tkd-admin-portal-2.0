BEGIN;

CREATE OR REPLACE FUNCTION public.portal_save_product(p_actor uuid,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.products; v public.product_variants; item record; incoming jsonb; result jsonb; action text; vid uuid;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:pos_manage_inventory');
 action:=p_payload->>'action';
 IF action='CREATE_PRODUCT' THEN
 INSERT INTO public.products(sku,name,category_id,category_name,price_usd,cost_usd,stock,min_stock_threshold,sizes,has_variants,image_url,description)
 VALUES(upper(trim(p_payload->>'sku')),trim(p_payload->>'name'),(p_payload->>'categoryId')::integer,p_payload->>'categoryName',(p_payload->>'priceUsd')::numeric,COALESCE((p_payload->>'costUsd')::numeric,0),COALESCE((p_payload->>'stock')::integer,0),COALESCE((p_payload->>'minStockThreshold')::integer,5),ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'sizes','[]'))),COALESCE((p_payload->>'hasVariants')::boolean,false),p_payload->>'imageUrl',p_payload->>'description') RETURNING * INTO p;
 ELSE
 SELECT * INTO p FROM public.products WHERE id=(p_payload->>'productId')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product not found' USING ERRCODE='22023'; END IF;
 IF action='DELETE_PRODUCT' THEN
 UPDATE public.products SET is_active=false,allow_student_orders=false,updated_at=now() WHERE id=p.id;
 RETURN jsonb_build_object('id',p.id,'archived',true);
 END IF;
 IF action<>'UPDATE_PRODUCT' THEN RAISE EXCEPTION 'Invalid catalog action' USING ERRCODE='22023'; END IF;
 IF p_payload ? 'stock' AND (p_payload->>'stock')::integer<>p.stock THEN RAISE EXCEPTION 'Use Stock Adjustment to change inventory. Refresh the catalog if another sale changed it.' USING ERRCODE='22023'; END IF;
 UPDATE public.products SET sku=COALESCE(upper(trim(p_payload->>'sku')),sku),name=COALESCE(trim(p_payload->>'name'),name),category_id=CASE WHEN p_payload ? 'categoryId' THEN (p_payload->>'categoryId')::integer ELSE category_id END,
 category_name=COALESCE(p_payload->>'categoryName',category_name),price_usd=COALESCE((p_payload->>'priceUsd')::numeric,price_usd),cost_usd=COALESCE((p_payload->>'costUsd')::numeric,cost_usd),min_stock_threshold=COALESCE((p_payload->>'minStockThreshold')::integer,min_stock_threshold),
 image_url=CASE WHEN p_payload ? 'imageUrl' THEN p_payload->>'imageUrl' ELSE image_url END,description=CASE WHEN p_payload ? 'description' THEN p_payload->>'description' ELSE description END,
 is_active=COALESCE((p_payload->>'isActive')::boolean,is_active),allow_student_orders=COALESCE((p_payload->>'allowStudentOrders')::boolean,allow_student_orders),updated_at=now() WHERE id=p.id RETURNING * INTO p;
 END IF;
 IF p_payload ? 'variants' THEN
 incoming:=p_payload->'variants';
 IF jsonb_typeof(incoming)<>'array' OR jsonb_array_length(incoming)>200 THEN RAISE EXCEPTION 'Invalid variants' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.product_variants old WHERE old.product_id=p.id AND old.is_active=true AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(incoming) x WHERE x->>'id'=old.id::text OR upper(x->>'sku')=old.sku) AND (old.stock<>0 OR EXISTS(SELECT 1 FROM public.pos_order_items i JOIN public.pos_orders o ON o.id=i.order_id WHERE i.variant_id=old.id AND o.stock_reserved=true AND o.order_status NOT IN ('COMPLETED','CANCELLED')))) THEN RAISE EXCEPTION 'Cannot remove a variant with stock or reserved orders' USING ERRCODE='22023'; END IF;
 -- Preserve IDs so existing reservations, cart references and receipts remain linked.
 UPDATE public.product_variants old SET is_active=false WHERE product_id=p.id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(incoming) x WHERE x->>'id'=old.id::text OR upper(x->>'sku')=old.sku);
 FOR item IN SELECT value AS data FROM jsonb_array_elements(incoming) ORDER BY value->>'sku' LOOP
 SELECT * INTO v FROM public.product_variants WHERE product_id=p.id AND (id=NULLIF(item.data->>'id','')::uuid OR sku=upper(trim(item.data->>'sku'))) FOR UPDATE;
 IF FOUND THEN
 IF (item.data->>'stock')::integer<>v.stock THEN RAISE EXCEPTION 'Use Stock Adjustment to change variant inventory' USING ERRCODE='22023'; END IF;
 UPDATE public.product_variants SET sku=upper(trim(item.data->>'sku')),size=item.data->>'size',color=item.data->>'color',price_override=(item.data->>'priceOverride')::numeric,min_stock_threshold=COALESCE((item.data->>'minStockThreshold')::integer,3),is_active=true,updated_at=now() WHERE id=v.id;
 ELSE
 INSERT INTO public.product_variants(product_id,sku,size,color,price_override,stock,min_stock_threshold) VALUES(p.id,upper(trim(item.data->>'sku')),item.data->>'size',item.data->>'color',(item.data->>'priceOverride')::numeric,COALESCE((item.data->>'stock')::integer,0),COALESCE((item.data->>'minStockThreshold')::integer,3));
 END IF;
 END LOOP;
 UPDATE public.products SET has_variants=jsonb_array_length(incoming)>0,stock=CASE WHEN jsonb_array_length(incoming)>0 THEN (SELECT COALESCE(sum(stock),0) FROM public.product_variants WHERE product_id=p.id AND is_active=true) ELSE stock END,sizes=ARRAY(SELECT DISTINCT size FROM public.product_variants WHERE product_id=p.id AND is_active=true) WHERE id=p.id;
 ELSIF p.has_variants AND action='CREATE_PRODUCT' THEN RAISE EXCEPTION 'Variant products require variant rows' USING ERRCODE='22023'; END IF;
 SELECT to_jsonb(prod)||jsonb_build_object('variants',COALESCE((SELECT jsonb_agg(vr) FROM public.product_variants vr WHERE vr.product_id=p.id AND vr.is_active=true),'[]')) INTO result FROM public.products prod WHERE prod.id=p.id;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('CATALOG_SAVED',p_actor::text,p.id::text,jsonb_build_object('action',action));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.portal_save_product(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_save_product(uuid,jsonb) TO service_role;

CREATE TABLE IF NOT EXISTS public.households(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guardian_name text NOT NULL,guardian_phone text NOT NULL,
 guardian_email text NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.household_students(
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
 student_id varchar(20) NOT NULL REFERENCES public.students(id),PRIMARY KEY(household_id,student_id),UNIQUE(student_id)
);
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY portal_household_read ON public.households FOR SELECT TO authenticated USING(public.portal_has_permission('page:directory') OR public.portal_has_permission('page:financials'));
CREATE POLICY portal_household_student_read ON public.household_students FOR SELECT TO authenticated USING(public.portal_has_permission('page:directory') OR public.portal_has_permission('page:financials'));
REVOKE ALL ON public.households,public.household_students FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.households,public.household_students TO authenticated;
GRANT ALL ON public.households,public.household_students TO service_role;
CREATE OR REPLACE FUNCTION public.portal_save_household(p_actor uuid,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE hid uuid;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:student_edit');
 hid:=COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid());
 PERFORM pg_advisory_xact_lock(hashtextextended(hid::text,0));
 IF length(trim(p_payload->>'guardianName')) NOT BETWEEN 1 AND 150 OR length(trim(p_payload->>'guardianPhone')) NOT BETWEEN 1 AND 50 OR jsonb_array_length(p_payload->'studentIds')>50 THEN RAISE EXCEPTION 'Invalid household' USING ERRCODE='22023'; END IF;
 INSERT INTO public.households(id,guardian_name,guardian_phone,guardian_email) VALUES(hid,trim(p_payload->>'guardianName'),trim(p_payload->>'guardianPhone'),COALESCE(p_payload->>'guardianEmail',''))
 ON CONFLICT(id) DO UPDATE SET guardian_name=EXCLUDED.guardian_name,guardian_phone=EXCLUDED.guardian_phone,guardian_email=EXCLUDED.guardian_email,updated_at=now();
 DELETE FROM public.household_students WHERE household_id=hid;
 INSERT INTO public.household_students(household_id,student_id) SELECT hid,value FROM jsonb_array_elements_text(p_payload->'studentIds');
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('HOUSEHOLD_SAVED',p_actor::text,hid::text,'{}');
 RETURN jsonb_build_object('id',hid);
END $$;
REVOKE ALL ON FUNCTION public.portal_save_household(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_save_household(uuid,jsonb) TO service_role;

-- Views must respect the caller's underlying table policies.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT viewname FROM pg_views WHERE schemaname='public' LOOP
 EXECUTE format('ALTER VIEW public.%I SET (security_invoker=true)',r.viewname);
 END LOOP;
END $$;
COMMIT;
