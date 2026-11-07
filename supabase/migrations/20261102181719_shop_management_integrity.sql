-- Future catalog writes and inventory/fulfillment commands only; existing records are preserved.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

-- Apply the training-membership rule to every new student-channel order,
-- including legacy service RPCs. Existing orders/history are not rewritten.
CREATE FUNCTION public.portal_shop_membership_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE membership record;
BEGIN
 SELECT student_status,deleted_at INTO membership FROM public.students WHERE id=NEW.student_id FOR SHARE;
 IF NOT FOUND OR membership.deleted_at IS NOT NULL OR membership.student_status<>'Active' THEN RAISE EXCEPTION 'An active training membership is required to place a shop order' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.portal_shop_membership_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER portal_shop_active_membership BEFORE INSERT ON public.pos_orders
 FOR EACH ROW WHEN(NEW.order_channel='STUDENT_PORTAL') EXECUTE FUNCTION public.portal_shop_membership_guard();

CREATE OR REPLACE FUNCTION public.portal_save_product(p_actor uuid,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.products; v public.product_variants; item record; incoming jsonb; result jsonb; action text; vid uuid;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:pos_manage_inventory');
 action:=p_payload->>'action';
 IF action='CREATE_PRODUCT' THEN
 INSERT INTO public.products(sku,name,category_id,category_name,price_usd,cost_usd,stock,min_stock_threshold,sizes,has_variants,image_url,description,is_active,allow_student_orders)
 VALUES(upper(trim(p_payload->>'sku')),trim(p_payload->>'name'),(p_payload->>'categoryId')::integer,p_payload->>'categoryName',(p_payload->>'priceUsd')::numeric,COALESCE((p_payload->>'costUsd')::numeric,0),COALESCE((p_payload->>'stock')::integer,0),COALESCE((p_payload->>'minStockThreshold')::integer,5),ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'sizes','[]'))),COALESCE((p_payload->>'hasVariants')::boolean,false),p_payload->>'imageUrl',p_payload->>'description',COALESCE((p_payload->>'isActive')::boolean,true),COALESCE((p_payload->>'allowStudentOrders')::boolean,true)) RETURNING * INTO p;
 ELSE
 SELECT * INTO p FROM public.products WHERE id=(p_payload->>'productId')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product not found' USING ERRCODE='22023'; END IF;
 IF p_payload ? 'expectedUpdatedAt' AND p.updated_at IS DISTINCT FROM (p_payload->>'expectedUpdatedAt')::timestamptz THEN RAISE EXCEPTION 'Catalog changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
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
 IF action='UPDATE_PRODUCT' AND NOT p.has_variants AND p.stock<>0 AND jsonb_array_length(incoming)>0 THEN RAISE EXCEPTION 'Reconcile existing base stock before adding product variations' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(incoming) x WHERE length(trim(x->>'sku')) NOT BETWEEN 1 AND 50) OR (SELECT count(DISTINCT upper(trim(x->>'sku'))) FROM jsonb_array_elements(incoming) x)<>jsonb_array_length(incoming) THEN RAISE EXCEPTION 'Each variant needs a unique SKU' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(incoming) x WHERE NULLIF(x->>'id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.product_variants owned WHERE owned.id=(x->>'id')::uuid AND owned.product_id=p.id)) THEN RAISE EXCEPTION 'Variant does not belong to this product' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.product_variants old WHERE old.product_id=p.id AND old.is_active=true AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(incoming) x WHERE x->>'id'=old.id::text OR upper(x->>'sku')=old.sku) AND (old.stock<>0 OR EXISTS(SELECT 1 FROM public.pos_order_items i JOIN public.pos_orders o ON o.id=i.order_id WHERE i.variant_id=old.id AND o.stock_reserved=true AND o.order_status NOT IN ('COMPLETED','CANCELLED')))) THEN RAISE EXCEPTION 'Cannot remove a variant with stock or reserved orders' USING ERRCODE='22023'; END IF;
 -- Preserve IDs so existing reservations, cart references and receipts remain linked.
 UPDATE public.product_variants old SET is_active=false WHERE product_id=p.id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(incoming) x WHERE x->>'id'=old.id::text OR upper(x->>'sku')=old.sku);
 FOR item IN SELECT value AS data FROM jsonb_array_elements(incoming) ORDER BY value->>'sku' LOOP
 SELECT * INTO v FROM public.product_variants WHERE product_id=p.id AND CASE WHEN NULLIF(item.data->>'id','') IS NOT NULL THEN id=(item.data->>'id')::uuid ELSE sku=upper(trim(item.data->>'sku')) END FOR UPDATE;
 IF FOUND THEN
 IF (item.data->>'stock')::integer<>v.stock THEN RAISE EXCEPTION 'Use Stock Adjustment to change variant inventory' USING ERRCODE='22023'; END IF;
 UPDATE public.product_variants SET sku=upper(trim(item.data->>'sku')),size=CASE WHEN item.data ? 'size' THEN item.data->>'size' ELSE size END,color=CASE WHEN item.data ? 'color' THEN item.data->>'color' ELSE color END,price_override=CASE WHEN item.data ? 'priceOverride' THEN (item.data->>'priceOverride')::numeric ELSE price_override END,min_stock_threshold=COALESCE((item.data->>'minStockThreshold')::integer,min_stock_threshold),is_active=COALESCE((item.data->>'isActive')::boolean,is_active),updated_at=now() WHERE id=v.id;
 ELSE
 INSERT INTO public.product_variants(product_id,sku,size,color,price_override,stock,min_stock_threshold,is_active) VALUES(p.id,upper(trim(item.data->>'sku')),item.data->>'size',item.data->>'color',(item.data->>'priceOverride')::numeric,COALESCE((item.data->>'stock')::integer,0),COALESCE((item.data->>'minStockThreshold')::integer,3),COALESCE((item.data->>'isActive')::boolean,true)) RETURNING * INTO v;
 IF v.stock>0 THEN INSERT INTO public.inventory_logs(product_id,variant_id,change_quantity,balance_after,reason,logged_by,notes) VALUES(p.id,v.id,v.stock,v.stock,'RESTOCK',p_actor,'Initial variation stock'); END IF;
 END IF;
 END LOOP;
 UPDATE public.products SET has_variants=jsonb_array_length(incoming)>0,stock=CASE WHEN jsonb_array_length(incoming)>0 THEN (SELECT COALESCE(sum(stock),0) FROM public.product_variants WHERE product_id=p.id AND is_active=true) ELSE stock END,sizes=ARRAY(SELECT DISTINCT size FROM public.product_variants WHERE product_id=p.id AND is_active=true) WHERE id=p.id;
 ELSIF p.has_variants AND action='CREATE_PRODUCT' THEN RAISE EXCEPTION 'Variant products require variant rows' USING ERRCODE='22023'; END IF;
 IF action='CREATE_PRODUCT' AND NOT p.has_variants AND NOT(p_payload ? 'variants' AND jsonb_array_length(p_payload->'variants')>0) AND p.stock>0 THEN INSERT INTO public.inventory_logs(product_id,change_quantity,balance_after,reason,logged_by,notes) VALUES(p.id,p.stock,p.stock,'RESTOCK',p_actor,'Initial product stock'); END IF;
 SELECT to_jsonb(prod)||jsonb_build_object('variants',COALESCE((SELECT jsonb_agg(vr) FROM public.product_variants vr WHERE vr.product_id=p.id AND vr.is_active=true),'[]')) INTO result FROM public.products prod WHERE prod.id=p.id;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('CATALOG_SAVED',p_actor::text,p.id::text,jsonb_build_object('action',action,'fields',ARRAY(SELECT jsonb_object_keys(p_payload))));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.portal_save_product(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_save_product(uuid,jsonb) TO service_role;



CREATE TABLE public.portal_inventory_requests(
 actor_id uuid NOT NULL REFERENCES public.profiles(id),request_key uuid NOT NULL,
 payload jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,request_key)
);
ALTER TABLE public.portal_inventory_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_inventory_requests FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.portal_inventory_requests TO service_role;

CREATE FUNCTION public.portal_adjust_inventory_once(p_actor uuid,p_product_id uuid,p_variant_id uuid,p_change_qty integer,p_reason text,p_notes text,p_request_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous public.portal_inventory_requests; signature jsonb; result jsonb;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:pos_manage_inventory');
 IF p_request_key IS NULL THEN RAISE EXCEPTION 'An inventory request key is required' USING ERRCODE='22023'; END IF;
 IF p_reason NOT IN('RESTOCK','DAMAGE_WRITE_OFF','AUDIT_ADJUSTMENT') OR p_change_qty IS NULL OR p_change_qty=0 OR abs(p_change_qty::bigint)>100000 OR (p_reason='RESTOCK' AND p_change_qty<0) OR (p_reason='DAMAGE_WRITE_OFF' AND p_change_qty>0) THEN RAISE EXCEPTION 'Invalid inventory adjustment' USING ERRCODE='22023'; END IF;
 signature:=jsonb_build_object('product',p_product_id,'variant',p_variant_id,'quantity',p_change_qty,'reason',p_reason,'notes',p_notes);
 PERFORM pg_advisory_xact_lock(hashtextextended('inventory:'||p_actor::text||p_request_key::text,0));
 SELECT * INTO previous FROM public.portal_inventory_requests WHERE actor_id=p_actor AND request_key=p_request_key;
 IF FOUND THEN
  IF previous.payload IS DISTINCT FROM signature THEN RAISE EXCEPTION 'Inventory request key was already used for another adjustment' USING ERRCODE='22023'; END IF;
  RETURN previous.result||jsonb_build_object('replayed',true);
 END IF;
 result:=public.portal_adjust_inventory(p_actor,p_product_id,p_variant_id,p_change_qty,p_reason,p_notes);
 INSERT INTO public.portal_inventory_requests(actor_id,request_key,payload,result) VALUES(p_actor,p_request_key,signature,result);
 RETURN result||jsonb_build_object('replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.portal_adjust_inventory_once(uuid,uuid,uuid,integer,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_adjust_inventory_once(uuid,uuid,uuid,integer,text,text,uuid) TO service_role;

CREATE FUNCTION public.portal_transition_order(p_actor uuid,p_order_id uuid,p_new_order_status text,p_payment_status text DEFAULT NULL,p_admin_notes text DEFAULT NULL,p_expected_updated_at timestamptz DEFAULT NULL,p_payment_reference text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous public.pos_orders; changed public.pos_orders; result jsonb;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:pos_create_order');
 SELECT * INTO previous FROM public.pos_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE='P0002'; END IF;
 IF p_expected_updated_at IS NOT NULL AND previous.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Order changed. Refresh before updating.' USING ERRCODE='40001'; END IF;
 IF p_payment_status='PAID' AND previous.payment_status<>'PAID' AND (p_payment_reference IS NULL OR length(trim(p_payment_reference)) NOT BETWEEN 3 AND 150) THEN RAISE EXCEPTION 'A verified payment reference is required before recording collection' USING ERRCODE='22023'; END IF;
 result:=public.portal_update_order(p_actor,p_order_id,p_new_order_status,p_payment_status,p_admin_notes);
 -- Fulfillment and collection must not rewrite the original acceptance actor.
 UPDATE public.pos_orders SET confirmed_by=CASE WHEN previous.order_status IN('PENDING','PENDING_CONFIRMATION') AND p_new_order_status='CONFIRMED' THEN p_actor ELSE previous.confirmed_by END,
 confirmed_at=CASE WHEN previous.order_status IN('PENDING','PENDING_CONFIRMATION') AND p_new_order_status='CONFIRMED' THEN COALESCE(previous.confirmed_at,now()) ELSE previous.confirmed_at END WHERE id=p_order_id;
 SELECT * INTO changed FROM public.pos_orders WHERE id=p_order_id;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('ORDER_STATUS_UPDATED',p_actor::text,p_order_id::text,jsonb_build_object('previous_order_status',previous.order_status,'order_status',changed.order_status,'previous_payment_status',previous.payment_status,'payment_status',changed.payment_status,'payment_reference',NULLIF(trim(p_payment_reference),'')));
 RETURN result||jsonb_build_object('updated_at',changed.updated_at);
END $$;
REVOKE ALL ON FUNCTION public.portal_transition_order(uuid,uuid,text,text,text,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_transition_order(uuid,uuid,text,text,text,timestamptz,text) TO service_role;

-- Counter sales must record the amount shown to staff. The existing order
-- engine remains responsible for permissions, stock, audit and idempotency.
CREATE OR REPLACE FUNCTION public.portal_place_counter_order(
  p_actor uuid, p_payload jsonb, p_request_key uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  item record;
  product public.products;
  variant public.product_variants;
  price numeric;
  subtotal numeric := 0;
  quantity integer;
BEGIN
  PERFORM public.portal_assert_actor(p_actor, 'action:pos_create_order');
  IF p_request_key IS NULL THEN
    RAISE EXCEPTION 'A checkout request key is required' USING ERRCODE = '22023';
  END IF;

  -- Use the same request lock as the order engine. Completed retries must
  -- return their original order even if catalog prices changed afterward.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text || p_request_key::text, 0));
  IF EXISTS (SELECT 1 FROM public.pos_orders WHERE recorded_by = p_actor AND request_key = p_request_key) THEN
    RETURN public.portal_place_order(p_actor, 'ADMIN_POS', p_payload, p_request_key);
  END IF;
  IF p_payload->>'paymentMethod' NOT IN ('ABA Bank KHQR','Cash','Credit Card','Bank Transfer') THEN RAISE EXCEPTION 'Counter checkout requires a collected payment method' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_payload->'items') NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid cart' USING ERRCODE = '22023';
  END IF;

  -- Lock in the order engine's order and hold locks through settlement, so a
  -- price edit cannot race between this check and the inventory transaction.
  FOR item IN SELECT value AS data FROM jsonb_array_elements(p_payload->'items')
    ORDER BY value->>'productId', value->>'variantId'
  LOOP
    quantity := (item.data->>'qty')::integer;
    IF quantity IS NULL OR quantity NOT BETWEEN 1 AND 1000 THEN
      RAISE EXCEPTION 'Invalid quantity' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO product FROM public.products
      WHERE id = (item.data->>'productId')::uuid AND is_active = true FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product unavailable' USING ERRCODE = '22023';
    END IF;
    variant := NULL;
    IF NULLIF(item.data->>'variantId', '') IS NOT NULL THEN
      SELECT * INTO variant FROM public.product_variants
        WHERE id = (item.data->>'variantId')::uuid AND product_id = product.id AND is_active = true FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variant unavailable' USING ERRCODE = '22023';
      END IF;
    END IF;
    price := COALESCE(variant.price_override, product.price_usd);
    IF (item.data->>'price')::numeric IS DISTINCT FROM price THEN
      RAISE EXCEPTION 'POS_QUOTE_CHANGED' USING ERRCODE = 'P0001';
    END IF;
    subtotal := subtotal + round(price * quantity, 2);
  END LOOP;
  IF (p_payload->>'subtotal')::numeric IS DISTINCT FROM subtotal THEN
    RAISE EXCEPTION 'POS_QUOTE_CHANGED' USING ERRCODE = 'P0001';
  END IF;
  RETURN public.portal_place_order(p_actor, 'ADMIN_POS', p_payload, p_request_key);
END $$;

REVOKE ALL ON FUNCTION public.portal_place_counter_order(uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_place_counter_order(uuid, jsonb, uuid) TO service_role;


NOTIFY pgrst, 'reload schema';
COMMIT;
