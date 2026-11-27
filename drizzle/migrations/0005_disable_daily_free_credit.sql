CREATE OR REPLACE FUNCTION public.claim_daily_credit() RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT NULL::integer; $$;
REVOKE ALL ON FUNCTION public.claim_daily_credit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_credit() TO service_role;
COMMENT ON FUNCTION public.claim_daily_credit() IS 'Deprecated: daily rewards retired; never grants credits.';