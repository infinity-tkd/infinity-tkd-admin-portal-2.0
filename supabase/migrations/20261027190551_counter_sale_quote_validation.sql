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
