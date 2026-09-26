CREATE TABLE public.avito_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  avito_user_id text,
  avito_account_name text,
  webhook_url text,
  webhook_registered_at timestamptz,
  last_sync_at timestamptz,
  last_checked_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.avito_settings TO authenticated;
GRANT ALL ON public.avito_settings TO service_role;
ALTER TABLE public.avito_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avito settings select admin" ON public.avito_settings
  FOR SELECT TO authenticated USING (private.is_admin());
CREATE POLICY "avito settings insert admin" ON public.avito_settings
  FOR INSERT TO authenticated WITH CHECK (private.is_admin());
CREATE POLICY "avito settings update admin" ON public.avito_settings
  FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

INSERT INTO public.avito_settings (id) VALUES (1);

CREATE TABLE public.avito_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL DEFAULT 'message',
  chat_id text,
  author_name text,
  message_text text,
  item_title text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'received',
  note text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX avito_events_created_at_idx ON public.avito_events (created_at DESC);

GRANT SELECT ON public.avito_events TO authenticated;
GRANT ALL ON public.avito_events TO service_role;
ALTER TABLE public.avito_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avito events select admin" ON public.avito_events
  FOR SELECT TO authenticated USING (private.is_admin());

CREATE UNIQUE INDEX leads_avito_chat_id_key ON public.leads (avito_chat_id) WHERE avito_chat_id IS NOT NULL;