-- Read-only checks. A zero denominator makes a broken rule fail.
SELECT 1 / (NOT has_function_privilege('authenticated', 'public.claim_daily_credit()', 'execute'))::integer AS users_cannot_claim_daily;
SELECT 1 / (NOT has_function_privilege('anon', 'public.claim_daily_credit()', 'execute'))::integer AS anonymous_cannot_claim_daily;