
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated, service_role;

DROP POLICY "own profile update" ON public.profiles;
DROP POLICY "admin insert profiles" ON public.profiles;
DROP POLICY "admin delete profiles" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR private.is_admin()) WITH CHECK (id = auth.uid() OR private.is_admin());
CREATE POLICY "admin insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (private.is_admin());
CREATE POLICY "admin delete profiles" ON public.profiles FOR DELETE TO authenticated USING (private.is_admin());

DROP POLICY "leads visible" ON public.leads;
DROP POLICY "admin manage leads" ON public.leads;
CREATE POLICY "leads visible" ON public.leads FOR SELECT TO authenticated USING (status = 'new' OR manager_id = auth.uid() OR private.is_admin());
CREATE POLICY "admin manage leads" ON public.leads FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY "clients select" ON public.clients;
DROP POLICY "clients insert" ON public.clients;
DROP POLICY "clients update" ON public.clients;
DROP POLICY "clients delete admin" ON public.clients;
CREATE POLICY "clients select" ON public.clients FOR SELECT TO authenticated USING (manager_id = auth.uid() OR private.is_admin());
CREATE POLICY "clients insert" ON public.clients FOR INSERT TO authenticated WITH CHECK (manager_id = auth.uid() OR private.is_admin());
CREATE POLICY "clients update" ON public.clients FOR UPDATE TO authenticated USING (manager_id = auth.uid() OR private.is_admin()) WITH CHECK (manager_id = auth.uid() OR private.is_admin());
CREATE POLICY "clients delete admin" ON public.clients FOR DELETE TO authenticated USING (private.is_admin());

DROP POLICY "tasks select" ON public.tasks;
DROP POLICY "tasks insert" ON public.tasks;
DROP POLICY "tasks update" ON public.tasks;
DROP POLICY "tasks delete" ON public.tasks;
CREATE POLICY "tasks select" ON public.tasks FOR SELECT TO authenticated USING (manager_id = auth.uid() OR private.is_admin());
CREATE POLICY "tasks insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (manager_id = auth.uid() OR private.is_admin());
CREATE POLICY "tasks update" ON public.tasks FOR UPDATE TO authenticated USING (manager_id = auth.uid() OR private.is_admin()) WITH CHECK (manager_id = auth.uid() OR private.is_admin());
CREATE POLICY "tasks delete" ON public.tasks FOR DELETE TO authenticated USING (manager_id = auth.uid() OR private.is_admin());

DROP POLICY "comments select" ON public.comments;
DROP POLICY "comments insert" ON public.comments;
CREATE POLICY "comments select" ON public.comments FOR SELECT TO authenticated USING (private.is_admin() OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.manager_id = auth.uid()));
CREATE POLICY "comments insert" ON public.comments FOR INSERT TO authenticated WITH CHECK (manager_id = auth.uid() AND (private.is_admin() OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.manager_id = auth.uid())));

DROP POLICY "interactions select" ON public.interactions;
DROP POLICY "interactions insert" ON public.interactions;
CREATE POLICY "interactions select" ON public.interactions FOR SELECT TO authenticated USING (private.is_admin() OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.manager_id = auth.uid()));
CREATE POLICY "interactions insert" ON public.interactions FOR INSERT TO authenticated WITH CHECK (private.is_admin() OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.manager_id = auth.uid()));

DROP POLICY "avito select" ON public.avito_messages;
DROP POLICY "avito insert" ON public.avito_messages;
CREATE POLICY "avito select" ON public.avito_messages FOR SELECT TO authenticated USING (private.is_admin() OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.manager_id = auth.uid()));
CREATE POLICY "avito insert" ON public.avito_messages FOR INSERT TO authenticated WITH CHECK (private.is_admin() OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.manager_id = auth.uid()));

DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
