
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin','manager');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin()) WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY "admin insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- New user handler: creates profile, admin role for the owner email, manager otherwise
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN lower(NEW.email) = 'dimavalgura@yandex.ru' THEN 'admin'::public.app_role ELSE 'manager'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Leads
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  source text NOT NULL DEFAULT 'Avito',
  source_id text,
  avito_chat_id text,
  avito_user_id text,
  avito_item_id text,
  avito_item_title text,
  vehicle text,
  message text,
  status text NOT NULL DEFAULT 'new',
  manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads visible" ON public.leads FOR SELECT TO authenticated
  USING (status = 'new' OR manager_id = auth.uid() OR public.is_admin());
CREATE POLICY "admin manage leads" ON public.leads FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Clients
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  source text NOT NULL DEFAULT 'Avito',
  source_id text,
  avito_chat_id text,
  avito_user_id text,
  avito_item_id text,
  avito_item_title text,
  vehicle text,
  status text NOT NULL DEFAULT 'active',
  close_reason text,
  closed_at timestamptz,
  sold_at timestamptz,
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_contact_at timestamptz,
  next_action_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients select" ON public.clients FOR SELECT TO authenticated
  USING (manager_id = auth.uid() OR public.is_admin());
CREATE POLICY "clients insert" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (manager_id = auth.uid() OR public.is_admin());
CREATE POLICY "clients update" ON public.clients FOR UPDATE TO authenticated
  USING (manager_id = auth.uid() OR public.is_admin())
  WITH CHECK (manager_id = auth.uid() OR public.is_admin());
CREATE POLICY "clients delete admin" ON public.clients FOR DELETE TO authenticated USING (public.is_admin());

-- Tasks
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'call',
  due_at timestamptz NOT NULL,
  comment text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks select" ON public.tasks FOR SELECT TO authenticated
  USING (manager_id = auth.uid() OR public.is_admin());
CREATE POLICY "tasks insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (manager_id = auth.uid() OR public.is_admin());
CREATE POLICY "tasks update" ON public.tasks FOR UPDATE TO authenticated
  USING (manager_id = auth.uid() OR public.is_admin())
  WITH CHECK (manager_id = auth.uid() OR public.is_admin());
CREATE POLICY "tasks delete" ON public.tasks FOR DELETE TO authenticated
  USING (manager_id = auth.uid() OR public.is_admin());

-- Comments
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments select" ON public.comments FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.manager_id = auth.uid()));
CREATE POLICY "comments insert" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (manager_id = auth.uid() AND (public.is_admin() OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.manager_id = auth.uid())));

-- Interactions (history)
CREATE TABLE public.interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.interactions TO authenticated;
GRANT ALL ON public.interactions TO service_role;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interactions select" ON public.interactions FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.manager_id = auth.uid()));
CREATE POLICY "interactions insert" ON public.interactions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.manager_id = auth.uid()));

-- Avito messages
CREATE TABLE public.avito_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  chat_id text,
  message_id text,
  direction text NOT NULL DEFAULT 'out',
  message_text text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  created_at timestamptz NOT NULL DEFAULT now(),
  raw_data jsonb
);
GRANT SELECT, INSERT ON public.avito_messages TO authenticated;
GRANT ALL ON public.avito_messages TO service_role;
ALTER TABLE public.avito_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "avito select" ON public.avito_messages FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.manager_id = auth.uid()));
CREATE POLICY "avito insert" ON public.avito_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.manager_id = auth.uid()));

-- Atomic lead claim
CREATE OR REPLACE FUNCTION public.claim_lead(_lead_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _lead public.leads%ROWTYPE;
  _client_id uuid;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Требуется авторизация'; END IF;

  UPDATE public.leads
     SET status = 'taken', manager_id = _uid
   WHERE id = _lead_id AND status = 'new'
  RETURNING * INTO _lead;

  IF _lead.id IS NULL THEN
    RAISE EXCEPTION 'Лид уже взят другим менеджером';
  END IF;

  INSERT INTO public.clients (name, phone, source, source_id, avito_chat_id, avito_user_id,
    avito_item_id, avito_item_title, vehicle, manager_id, last_contact_at)
  VALUES (_lead.name, _lead.phone, _lead.source, _lead.source_id, _lead.avito_chat_id, _lead.avito_user_id,
    _lead.avito_item_id, _lead.avito_item_title, _lead.vehicle, _uid, NULL)
  RETURNING id INTO _client_id;

  INSERT INTO public.interactions (client_id, manager_id, type, description)
  VALUES (_client_id, _uid, 'created', 'Клиент создан из нового лида'),
         (_client_id, _uid, 'assigned', 'Назначен менеджер');

  IF _lead.message IS NOT NULL AND length(_lead.message) > 0 THEN
    INSERT INTO public.avito_messages (client_id, chat_id, direction, message_text, created_at)
    VALUES (_client_id, _lead.avito_chat_id, 'in', _lead.message, _lead.created_at);
  END IF;

  RETURN _client_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_lead(uuid) TO authenticated;
