// Общие типы интеграции с Авито, безопасные для браузера.

export type AvitoStatus = {
  hasKeys: boolean;
  connected: boolean;
  accountId: string | null;
  accountName: string | null;
  webhookUrl: string | null;
  webhookRegisteredAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
};

export type AvitoEventRow = {
  id: string;
  event_type: string;
  chat_id: string | null;
  author_name: string | null;
  message_text: string | null;
  item_title: string | null;
  status: string;
  note: string | null;
  created_at: string;
};

export const AVITO_EVENT_STATUS: Record<string, string> = {
  received: "Получено",
  lead_created: "Создан лид",
  message_added: "Добавлено в чат клиента",
  duplicate: "Уже есть в работе",
  ignored: "Пропущено",
  error: "Ошибка",
};
