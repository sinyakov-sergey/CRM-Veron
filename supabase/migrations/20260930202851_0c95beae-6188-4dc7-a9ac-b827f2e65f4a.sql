CREATE UNIQUE INDEX IF NOT EXISTS avito_messages_message_id_uniq
  ON public.avito_messages (message_id) WHERE message_id IS NOT NULL;

ALTER TABLE public.avito_messages
  ADD COLUMN IF NOT EXISTS delivered boolean NOT NULL DEFAULT true;