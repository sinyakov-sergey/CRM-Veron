import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ChatMessage = {
  id: string;
  direction: "in" | "out";
  text: string;
  createdAt: string;
  delivered: boolean;
};

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

/** Подтягивает переписку из Авито и отдаёт объединённую историю чата. */
export const avitoChatMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; refresh?: boolean }) => input)
  .handler(async ({ data, context }): Promise<{ messages: ChatMessage[]; synced: boolean; error?: string }> => {
    const client = await loadClient(context as never, data.clientId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
          const text: string =
            raw["content"]?.text ??
            raw["content"]?.call?.status ??
            (raw["type"] && raw["type"] !== "text" ? `[${raw["type"]}]` : "(без текста)");
          const out = String(raw["author_id"] ?? "") === String(me) || raw["direction"] === "out";
          return {
            client_id: client.id,
            chat_id: client.avito_chat_id,
            message_id: raw["id"] ? String(raw["id"]) : null,
            direction: out ? "out" : "in",
            message_text: text,
            created_at: created ? new Date(created * 1000).toISOString() : new Date().toISOString(),
            raw_data: raw as never,
            delivered: true,
          };
        });
        const withId = rows.filter((r) => r.message_id);
        if (withId.length) {
          await supabaseAdmin
            .from("avito_messages")
            .upsert(withId as never, { onConflict: "message_id", ignoreDuplicates: true });
        }
      } catch (e) {
        error = e instanceof Error ? e.message : "Не удалось обновить переписку";
      }
    }

    const { data: stored } = await supabaseAdmin
      .from("avito_messages")
      .select("id, direction, message_text, created_at, delivered")
      .eq("client_id", client.id)
      .order("created_at", { ascending: true })
      .limit(300);

    return {
      messages: (stored ?? []).map((m) => ({
        id: m.id,
        direction: m.direction === "out" ? "out" : "in",
        text: m.message_text,
        createdAt: m.created_at,
        delivered: m.delivered ?? true,
      })),
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
