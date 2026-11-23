-- Run against the database via the data query tool. Everything rolls back.
BEGIN;
INSERT INTO public.user_credits(user_id, balance) VALUES ('11111111-1111-4111-8111-111111111111',7), ('22222222-2222-4222-8222-222222222222',0);
DO $test$
DECLARE b integer; rejected boolean := false;
BEGIN
  PERFORM public.apply_store_event('integration:first','11111111-1111-4111-8111-111111111111','PRODUCTION','integration:tx1','integration:sub','cineflow_monthly',100,'2030-01-01',false,true);
  SELECT balance INTO b FROM public.user_credits WHERE user_id='11111111-1111-4111-8111-111111111111';
  IF b <> 57 THEN RAISE EXCEPTION 'Monthly rollover failed: %',b; END IF;
  PERFORM public.apply_store_event('integration:first','11111111-1111-4111-8111-111111111111','PRODUCTION','integration:tx1','integration:sub','cineflow_monthly',100,'2030-01-01',false,true);
  PERFORM public.apply_store_event('integration:same-tx','11111111-1111-4111-8111-111111111111','PRODUCTION','integration:tx1','integration:sub','cineflow_monthly',101,'2030-01-01',false,true);
  SELECT balance INTO b FROM public.user_credits WHERE user_id='11111111-1111-4111-8111-111111111111';
  IF b <> 57 THEN RAISE EXCEPTION 'Duplicate event/payment granted twice'; END IF;
  PERFORM public.apply_store_event('integration:renew','11111111-1111-4111-8111-111111111111','PRODUCTION','integration:tx2','integration:sub','cineflow_weekly',200,'2030-01-08',false,true);
  SELECT balance INTO b FROM public.user_credits WHERE user_id='11111111-1111-4111-8111-111111111111';
  IF b <> 69 THEN RAISE EXCEPTION 'Weekly renewal failed'; END IF;
  PERFORM public.apply_store_event('integration:refund','11111111-1111-4111-8111-111111111111','PRODUCTION','integration:tx2','integration:sub','cineflow_weekly',300,'2030-01-08',true,false);
  SELECT balance INTO b FROM public.user_credits WHERE user_id='11111111-1111-4111-8111-111111111111';
  IF b <> 69 THEN RAISE EXCEPTION 'Refund removed credits'; END IF;
  PERFORM public.apply_store_event('integration:stale','11111111-1111-4111-8111-111111111111','PRODUCTION','integration:tx2','integration:sub','cineflow_weekly',250,'2030-01-08',false,false);
  PERFORM public.apply_store_event('integration:later-nonpayment','11111111-1111-4111-8111-111111111111','PRODUCTION','integration:tx2','integration:sub','cineflow_weekly',350,'2030-01-08',false,false);
  IF NOT (SELECT revoked FROM public.store_subscriptions WHERE original_transaction_id='integration:sub') THEN RAISE EXCEPTION 'Refunded access was reactivated'; END IF;
  BEGIN
    PERFORM public.apply_store_event('integration:wrong-owner','22222222-2222-4222-8222-222222222222','PRODUCTION','integration:tx2','integration:other','cineflow_weekly',400,'2030-01-08',false,true);
  EXCEPTION WHEN raise_exception THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Cross-account payment was accepted'; END IF;
  IF has_function_privilege('authenticated','public.apply_store_event(text,uuid,text,text,text,text,bigint,timestamptz,boolean,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Users can grant paid credits'; END IF;
  DELETE FROM public.user_credits WHERE user_id='11111111-1111-4111-8111-111111111111';
  IF EXISTS (SELECT 1 FROM public.store_subscriptions WHERE original_transaction_id='integration:sub') THEN RAISE EXCEPTION 'Account deletion kept subscription'; END IF;
  IF EXISTS (SELECT 1 FROM public.store_payments WHERE original_transaction_id='integration:sub' AND user_id IS NOT NULL) THEN RAISE EXCEPTION 'Account deletion kept payment identity'; END IF;
END;
$test$;
ROLLBACK;