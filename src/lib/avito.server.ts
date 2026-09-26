// Серверные помощники для работы с API Авито.
// Этот файл никогда не попадает в браузерную сборку.

const API = "https://api.avito.ru";

export type AvitoToken = { access_token: string; expires_in: number };

export async function getAvitoToken(): Promise<string> {
  const clientId = process.env["AVITO_CLIENT_ID"];
  const clientSecret = process.env["AVITO_CLIENT_SECRET"];
  if (!clientId || !clientSecret) throw new Error("Не заданы ключи Авито");

  const res = await fetch(`${API}/token/`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(`Авито не принял ключи (${res.status})`);
  }
  const json = (await res.json()) as AvitoToken;
  if (!json.access_token) throw new Error("Авито не вернул токен доступа");
  return json.access_token;
}

async function avitoFetch<T>(
  token: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Авито: ${res.status} ${text.slice(0, 300)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export type AvitoSelf = { id: number; name?: string; email?: string };

export function getSelf(token: string) {
  return avitoFetch<AvitoSelf>(token, "/core/v1/accounts/self");
}

export function registerWebhook(token: string, url: string) {
  return avitoFetch<{ ok?: boolean }>(token, "/messenger/v3/webhook", {
    method: "POST",
    body: { url },
  });
}

export function unregisterWebhook(token: string, url: string) {
  return avitoFetch<{ ok?: boolean }>(token, "/messenger/v1/webhook/unsubscribe", {
    method: "POST",
    body: { url },
  });
}

export type AvitoChat = {
  id: string;
  users?: Array<{ id: number; name?: string; public_user_profile?: { url?: string } }>;
  context?: { value?: { id?: number; title?: string; url?: string; price_string?: string } };
  last_message?: { content?: { text?: string }; created?: number; direction?: string };
};

export function getChats(token: string, userId: string, limit = 50) {
  return avitoFetch<{ chats: AvitoChat[] }>(
    token,
    `/messenger/v2/accounts/${userId}/chats?limit=${limit}&chat_types=u2i`,
  );
}

export function getChat(token: string, userId: string, chatId: string) {
  return avitoFetch<AvitoChat>(token, `/messenger/v2/accounts/${userId}/chats/${chatId}`);
}

export function getMessages(token: string, userId: string, chatId: string, limit = 50) {
  return avitoFetch<{ messages: Array<Record<string, unknown>> }>(
    token,
    `/messenger/v3/accounts/${userId}/chats/${chatId}/messages/?limit=${limit}`,
  );
}

export function sendMessage(token: string, userId: string, chatId: string, text: string) {
  return avitoFetch<Record<string, unknown>>(
    token,
    `/messenger/v1/accounts/${userId}/chats/${chatId}/messages`,
    { method: "POST", body: { message: { text }, type: "text" } },
  );
}

/** Имя собеседника в чате (тот, кто не является нашим аккаунтом). */
export function counterpartName(chat: AvitoChat, selfId: string): string {
  const other = (chat.users ?? []).find((u) => String(u.id) !== String(selfId));
  return other?.name?.trim() || "Покупатель с Авито";
}

export function counterpartId(chat: AvitoChat, selfId: string): string | null {
  const other = (chat.users ?? []).find((u) => String(u.id) !== String(selfId));
  return other ? String(other.id) : null;
}
