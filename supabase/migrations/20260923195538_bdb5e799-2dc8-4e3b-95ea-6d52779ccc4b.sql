
CREATE OR REPLACE FUNCTION public.distribute_new_leads()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _lead public.leads%ROWTYPE;
  _managers uuid[];
  _count int := 0;
  _idx int := 0;
  _mgr uuid;
  _client_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Только администратор может распределять лиды';
  END IF;

  SELECT array_agg(p.id ORDER BY p.created_at)
    INTO _managers
    FROM public.profiles p
    JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'manager'
   WHERE p.is_active;

  IF _managers IS NULL OR array_length(_managers, 1) = 0 THEN
    RAISE EXCEPTION 'Нет активных менеджеров';
  END IF;

  SELECT COALESCE(count(*), 0) INTO _idx FROM public.clients;

  FOR _lead IN SELECT * FROM public.leads WHERE status = 'new' ORDER BY created_at LOOP
    _mgr := _managers[(_idx % array_length(_managers, 1)) + 1];
    _idx := _idx + 1;

    UPDATE public.leads SET status = 'taken', manager_id = _mgr WHERE id = _lead.id;

    INSERT INTO public.clients (name, phone, source, source_id, avito_chat_id, avito_user_id,
      avito_item_id, avito_item_title, vehicle, manager_id)
    VALUES (_lead.name, _lead.phone, _lead.source, _lead.source_id, _lead.avito_chat_id, _lead.avito_user_id,
      _lead.avito_item_id, _lead.avito_item_title, _lead.vehicle, _mgr)
    RETURNING id INTO _client_id;

    INSERT INTO public.interactions (client_id, manager_id, type, description)
    VALUES (_client_id, _mgr, 'created', 'Клиент создан из нового лида'),
           (_client_id, _mgr, 'assigned', 'Менеджер назначен автоматически');

    IF _lead.message IS NOT NULL AND length(_lead.message) > 0 THEN
      INSERT INTO public.avito_messages (client_id, chat_id, direction, message_text, created_at)
      VALUES (_client_id, _lead.avito_chat_id, 'in', _lead.message, _lead.created_at);
    END IF;

    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.distribute_new_leads() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.distribute_new_leads() TO authenticated;
