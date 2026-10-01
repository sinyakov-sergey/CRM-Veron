CREATE POLICY "client files storage select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-files'
    AND (
      private.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.manager_id = auth.uid()
          AND c.id::text = (storage.foldername(name))[1]
      )
    )
  );

CREATE POLICY "client files storage insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-files'
    AND (
      private.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.manager_id = auth.uid()
          AND c.id::text = (storage.foldername(name))[1]
      )
    )
  );

CREATE POLICY "client files storage delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-files'
    AND (
      private.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.manager_id = auth.uid()
          AND c.id::text = (storage.foldername(name))[1]
      )
    )
  );