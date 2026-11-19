CREATE TABLE public.user_credits (
  user_id uuid PRIMARY KEY,
  balance integer NOT NULL DEFAULT 2 CHECK (balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_credits TO authenticated;
GRANT ALL ON public.user_credits TO service_role;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own credits" ON public.user_credits FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance) VALUES (NEW.id, 2) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_credits AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();

INSERT INTO public.user_credits (user_id, balance) SELECT id, 2 FROM auth.users ON CONFLICT DO NOTHING;

-- Atomically spend credits; returns new balance or NULL when not enough.
CREATE OR REPLACE FUNCTION public.spend_credits(_user_id uuid, _amount integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nb integer;
BEGIN
  INSERT INTO public.user_credits (user_id, balance) VALUES (_user_id, 2) ON CONFLICT DO NOTHING;
  UPDATE public.user_credits SET balance = balance - _amount, updated_at = now()
    WHERE user_id = _user_id AND balance >= _amount RETURNING balance INTO nb;
  RETURN nb;
END $$;
CREATE OR REPLACE FUNCTION public.add_credits(_user_id uuid, _amount integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nb integer;
BEGIN
  INSERT INTO public.user_credits (user_id, balance) VALUES (_user_id, 0) ON CONFLICT DO NOTHING;
  UPDATE public.user_credits SET balance = balance + _amount, updated_at = now()
    WHERE user_id = _user_id RETURNING balance INTO nb;
  RETURN nb;
END $$;
REVOKE ALL ON FUNCTION public.spend_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer) TO service_role;