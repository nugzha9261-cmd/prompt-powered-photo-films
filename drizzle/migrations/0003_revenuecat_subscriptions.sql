CREATE TABLE public.store_subscriptions (
  environment text NOT NULL CHECK (environment IN ('PRODUCTION', 'SANDBOX')),
  original_transaction_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.user_credits(user_id) ON DELETE CASCADE,
  product_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  last_event_ms bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (environment, original_transaction_id)
);
GRANT SELECT ON public.store_subscriptions TO authenticated;
GRANT ALL ON public.store_subscriptions TO service_role;
ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_subscription_read ON public.store_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.store_payments (
  environment text NOT NULL,
  transaction_id text NOT NULL,
  original_transaction_id text NOT NULL,
  user_id uuid REFERENCES public.user_credits(user_id) ON DELETE SET NULL,
  product_id text NOT NULL,
  credits integer NOT NULL,
  PRIMARY KEY (environment, transaction_id)
);
GRANT ALL ON public.store_payments TO service_role;
ALTER TABLE public.store_payments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.store_events (
  event_id text PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.store_events TO service_role;
ALTER TABLE public.store_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.apply_store_event(
  _event_id text, _user_id uuid, _environment text, _transaction_id text,
  _original_transaction_id text, _product_id text, _event_ms bigint,
  _expires_at timestamptz, _revoked boolean, _paid boolean
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _owner uuid; _grant integer; _inserted integer;
BEGIN
  IF _environment NOT IN ('PRODUCTION','SANDBOX') OR _event_ms < 0 OR _expires_at IS NULL THEN
    RAISE EXCEPTION 'Invalid subscription event';
  END IF;
  _grant := CASE _product_id WHEN 'cineflow_weekly' THEN 12 WHEN 'cineflow_monthly' THEN 50 WHEN 'cineflow_quarterly' THEN 180 ELSE NULL END;
  IF _grant IS NULL THEN RAISE EXCEPTION 'Unknown subscription product'; END IF;
  IF NOT _paid THEN _grant := 0; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_environment || ':' || _original_transaction_id, 0));
  SELECT user_id INTO _owner FROM public.store_subscriptions
    WHERE environment = _environment AND original_transaction_id = _original_transaction_id;
  IF FOUND AND _owner IS DISTINCT FROM _user_id THEN RAISE EXCEPTION 'Subscription belongs to another account'; END IF;
  SELECT user_id INTO _owner FROM public.store_payments
    WHERE environment = _environment AND transaction_id = _transaction_id;
  IF FOUND AND _owner IS DISTINCT FROM _user_id THEN RAISE EXCEPTION 'Payment belongs to another account'; END IF;
  INSERT INTO public.store_events(event_id) VALUES (_event_id) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  IF _inserted = 0 THEN RETURN 'duplicate'; END IF;
  -- Never recreate a deleted account from a late payment event.
  IF NOT EXISTS (SELECT 1 FROM public.user_credits WHERE user_id = _user_id) THEN RAISE EXCEPTION 'Credit account missing'; END IF;
  IF _grant > 0 THEN
    INSERT INTO public.store_payments(environment, transaction_id, original_transaction_id, user_id, product_id, credits)
      VALUES (_environment, _transaction_id, _original_transaction_id, _user_id, _product_id, _grant) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS _inserted = ROW_COUNT;
    IF _inserted > 0 THEN
      UPDATE public.user_credits SET balance = balance + _grant, updated_at = now() WHERE user_id = _user_id;
    END IF;
  END IF;
  INSERT INTO public.store_subscriptions(environment, original_transaction_id, user_id, product_id, expires_at, revoked, last_event_ms)
    VALUES (_environment, _original_transaction_id, _user_id, _product_id, _expires_at, _revoked, _event_ms)
  ON CONFLICT (environment, original_transaction_id) DO UPDATE SET
    product_id = EXCLUDED.product_id, expires_at = EXCLUDED.expires_at,
    revoked = EXCLUDED.revoked, last_event_ms = EXCLUDED.last_event_ms
  WHERE EXCLUDED.last_event_ms > public.store_subscriptions.last_event_ms
    OR (EXCLUDED.last_event_ms = public.store_subscriptions.last_event_ms AND EXCLUDED.revoked);
  -- Refunds deliberately preserve credits; only premium access is revoked.
  RETURN 'processed';
END;
$fn$;
REVOKE ALL ON FUNCTION public.apply_store_event(text,uuid,text,text,text,text,bigint,timestamptz,boolean,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_store_event(text,uuid,text,text,text,text,bigint,timestamptz,boolean,boolean) TO service_role;