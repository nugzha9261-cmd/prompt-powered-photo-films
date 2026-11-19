ALTER TABLE public.user_credits ADD COLUMN IF NOT EXISTS last_daily_claim timestamptz;
CREATE OR REPLACE FUNCTION public.claim_daily_credit()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bal integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  UPDATE public.user_credits SET balance = balance + 1, last_daily_claim = now(), updated_at = now()
   WHERE user_id = auth.uid() AND (last_daily_claim IS NULL OR last_daily_claim <= now() - interval '24 hours')
   RETURNING balance INTO _bal;
  RETURN _bal;
END $$;
REVOKE ALL ON FUNCTION public.claim_daily_credit() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_credit() TO authenticated;