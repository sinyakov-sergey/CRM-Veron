import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ChatAttachment = {
  kind: "image" | "file" | "link";
  url: string;
  name: string | null;
};

export type ChatMessage = {
  id: string;
  direction: "in" | "out";
  text: string;
  createdAt: string;
  delivered: boolean;
  attachment: ChatAttachment | null;
};

const BUCKET = "client-files";

/** Клиент доступен текущему менеджеру (RLS) и привязан к чату Авито. */
async function loadClient(context: { supabase: any }, clientId: string) {
  const { data, error } = await context.supabase
    .from("clients")
    .select("id, avito_chat_id, avito_item_title")
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Клиент не найден");
  return data as { id: string; avito_chat_id: string | null; avito_item_title: string | null };
}

async function selfId(): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("avito_settings")
    .select("avito_user_id")
    .eq("id", 1)
    .maybeSingle();
  if (data?.avito_user_id) return data.avito_user_id;
  const { getAvitoToken, getSelf } = await import("./avito.server");
  const token = await getAvitoToken();
  return String((await getSelf(token)).id);
}

type Parsed = { text: string; kind: string | null; url: string | null; name: string | null };

/** Разбирает сообщение Авито: текст и вложение (фото, ссылка, файл). */
function parseAvito(raw: Record<string, any>, biggest: (s: any) => string | null): Parsed {
  const type = String(raw["type"] ?? "text");
  const c = raw["content"] ?? {};
  if (type === "image") {
    return { text: "", kind: "image", url: biggest(c.image?.sizes), name: null };
  }
  if (type === "link" && c.link?.url) {
    return { text: c.link?.text ?? "", kind: "link", url: c.link.url, name: c.link?.preview?.title ?? null };
  }
  if (type === "file" || c.file) {
    const f = c.file ?? {};
    return { text: "", kind: f.url ? "file" : null, url: f.url ?? null, name: f.name ?? "Файл" };
  }
  if (type === "voice") return { text: "🎤 Голосовое сообщение (откройте в Авито)", kind: null, url: null, name: null };
  if (type === "item") return { text: `Объявление: ${c.item?.title ?? ""}`.trim(), kind: c.item?.item_url ? "link" : null, url: c.item?.item_url ?? null, name: c.item?.title ?? null };
  if (type === "location") return { text: `📍 ${c.location?.text ?? "Геопозиция"}`, kind: null, url: null, name: null };
  const text: string = c.text ?? c.call?.status ?? (type !== "text" ? `[${type}]` : "(без текста)");
  return { text, kind: null, url: null, name: null };
}

/** Подтягивает переписку из Авито и отдаёт объединённую историю чата. */
export const avitoChatMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; refresh?: boolean }) => input)
  .handler(async ({ data, context }): Promise<{ messages: ChatMessage[]; synced: boolean; error?: string }> => {
    const client = await loadClient(context as never, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { biggestSize } = await import("./avito.server");

    let error: string | undefined;
    if (client.avito_chat_id) {
      try {
        const { getAvitoToken, getMessages } = await import("./avito.server");
        const token = await getAvitoToken();
        const me = await selfId();
        const res = await getMessages(token, me, client.avito_chat_id, 100);
        const rows = (res.messages ?? []).map((m) => {
          const raw = m as Record<string, any>;
          const created = typeof raw["created"] === "number" ? raw["created"] : null;
          const p = parseAvito(raw, biggestSize);
          const out = String(raw["author_id"] ?? "") === String(me) || raw["direction"] === "out";
          return {
            client_id: client.id,
            chat_id: client.avito_chat_id,
            message_id: raw["id"] ? String(raw["id"]) : null,
            direction: out ? "out" : "in",
            message_text: p.text,
            message_type: String(raw["type"] ?? "text"),
            attachment_kind: p.kind,
            attachment_url: p.url,
            attachment_name: p.name,
            created_at: created ? new Date(created * 1000).toISOString() : new Date().toISOString(),
            raw_data: raw as never,
            delivered: true,
          };
        });
        const withId = rows.filter((r) => r.message_id);
        if (withId.length) {
          const ids = withId.map((r) => r.message_id as string);
          const { data: existing } = await supabaseAdmin
            .from("avito_messages")
            .select("message_id")
            .in("message_id", ids);
          const known = new Set((existing ?? []).map((r) => r.message_id));
          const fresh = withId.filter((r) => !known.has(r.message_id));
          if (fresh.length) {
            const { error: insErr } = await supabaseAdmin.from("avito_messages").insert(fresh as never);
            if (insErr) throw new Error(insErr.message);
          }
        }
      } catch (e) {
        error = e instanceof Error ? e.message : "Не удалось обновить переписку";
      }
    }

    const { data: stored } = await supabaseAdmin
      .from("avito_messages")
      .select("id, direction, message_text, message_type, created_at, delivered, attachment_kind, attachment_url, attachment_name, raw_data")
      .eq("client_id", client.id)
      .order("created_at", { ascending: true })
      .limit(300);

    const messages: ChatMessage[] = [];
    for (const m of stored ?? []) {
      let kind = m.attachment_kind as string | null;
      let url = m.attachment_url as string | null;
      let name = m.attachment_name as string | null;
      let text = m.message_text;
      // Старые сообщения, сохранённые до поддержки вложений.
      const rawAny = m.raw_data as Record<string, any> | null;
      const rawMsg = (rawAny?.["payload"]?.["value"] ?? rawAny) as Record<string, any> | null;
      if (!kind && rawMsg && typeof rawMsg === "object" && rawMsg["type"] && rawMsg["type"] !== "text") {
        const p = parseAvito(rawMsg, biggestSize);
        kind = p.kind;
        url = p.url;
        name = p.name;
        text = p.text;
      }
      if (url && url.startsWith("storage:")) {
        const { data: signed } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(url.slice("storage:".length), 60 * 60);
        url = signed?.signedUrl ?? null;
      }
      messages.push({
        id: m.id,
        direction: m.direction === "out" ? "out" : "in",
        text,
        createdAt: m.created_at,
        delivered: m.delivered ?? true,
        attachment:
          kind && url ? { kind: kind as ChatAttachment["kind"], url, name } : null,
      });
    }

    return {
      messages,
      synced: Boolean(client.avito_chat_id) && !error,
      ...(error ? { error } : {}),
    };
  });

/** Отправляет сообщение покупателю в Авито и сохраняет его в истории. */
export const avitoChatSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; text: string }) => input)
  .handler(async ({ data, context }) => {
    const text = data.text.trim();
    if (!text) throw new Error("Сообщение пустое");
    const client = await loadClient(context as never, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let delivered = false;
    let messageId: string | null = null;
    let error: string | undefined;

    if (!client.avito_chat_id) {
      error = "У клиента нет диалога Авито";
    } else {
      try {
        const { getAvitoToken, sendMessage } = await import("./avito.server");
        const token = await getAvitoToken();
        const me = await selfId();
        const res = (await sendMessage(token, me, client.avito_chat_id, text)) as Record<string, any>;
        messageId = res?.["id"] ? String(res["id"]) : null;
        delivered = true;
      } catch (e) {
        error = e instanceof Error ? e.message : "Авито не принял сообщение";
      }
    }

    await supabaseAdmin.from("avito_messages").insert({
      client_id: client.id,
      chat_id: client.avito_chat_id,
      message_id: messageId,
      direction: "out",
      message_text: text,
      delivered,
    } as never);

    const now = new Date().toISOString();
    await supabaseAdmin.from("clients").update({ last_contact_at: now }).eq("id", client.id);
    await supabaseAdmin.from("interactions").insert({
      client_id: client.id,
      manager_id: (context as never as { userId: string }).userId,
      type: "message",
      description: `Авито: ${text.slice(0, 120)}`,
    });

    return { ok: delivered, ...(error ? { error } : {}) };
  });

/**
 * Отправляет фото покупателю в Авито. Файл заранее загружен менеджером
 * в хранилище по пути `{clientId}/...` (доступ проверяется правилами хранилища).
 */
export const avitoChatSendImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; path: string; fileName: string }) => {
    if (!input.path.startsWith(`${input.clientId}/`)) throw new Error("Неверный путь файла");
    return input;
  })
  .handler(async ({ data, context }) => {
    const client = await loadClient(context as never, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let delivered = false;
    let messageId: string | null = null;
    let error: string | undefined;

    if (!client.avito_chat_id) {
      error = "У клиента нет диалога Авито";
    } else {
      try {
        const { data: blob, error: dlErr } = await supabaseAdmin.storage.from(BUCKET).download(data.path);
        if (dlErr || !blob) throw new Error("Файл не найден в хранилище");
        const { getAvitoToken, uploadImage, sendImage } = await import("./avito.server");
        const token = await getAvitoToken();
        const me = await selfId();
        const { imageId } = await uploadImage(token, me, blob, data.fileName);
        const res = (await sendImage(token, me, client.avito_chat_id, imageId)) as Record<string, any>;
        messageId = res?.["id"] ? String(res["id"]) : null;
        delivered = true;
      } catch (e) {
        error = e instanceof Error ? e.message : "Авито не принял фото";
      }
    }

    await supabaseAdmin.from("avito_messages").insert({
      client_id: client.id,
      chat_id: client.avito_chat_id,
      message_id: messageId,
      direction: "out",
      message_text: "",
      message_type: "image",
      attachment_kind: "image",
      attachment_url: `storage:${data.path}`,
      attachment_name: data.fileName,
      delivered,
    } as never);

    const now = new Date().toISOString();
    await supabaseAdmin.from("clients").update({ last_contact_at: now }).eq("id", client.id);
    await supabaseAdmin.from("interactions").insert({
      client_id: client.id,
      manager_id: (context as never as { userId: string }).userId,
      type: "message",
      description: `Авито: фото ${data.fileName}`,
    });

    return { ok: delivered, ...(error ? { error } : {}) };
  });
