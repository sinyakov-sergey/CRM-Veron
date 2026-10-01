ALTER TABLE public.avito_messages
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_kind text;

CREATE TABLE IF NOT EXISTS public.client_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_files TO authenticated;
GRANT ALL ON public.client_files TO service_role;

ALTER TABLE public.client_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client files select" ON public.client_files
  FOR SELECT TO authenticated
  USING (private.is_admin() OR EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = client_files.client_id AND c.manager_id = auth.uid()
  ));

CREATE POLICY "client files insert" ON public.client_files
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin() OR EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = client_files.client_id AND c.manager_id = auth.uid()
  ));

CREATE POLICY "client files delete" ON public.client_files
  FOR DELETE TO authenticated
  USING (private.is_admin() OR EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = client_files.client_id AND c.manager_id = auth.uid()
  ));