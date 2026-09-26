// Приём входящих обращений с Авито: создание лидов и запись сообщений.

import { counterpartId, counterpartName, type AvitoChat } from "./avito.server";

export type IngestInput = {
  chatId: string;
  authorName: string;
  messageText: string;
  itemTitle: string | null;
  itemId: string | null;
  avitoUserId: string | null;
  messageId: string | null;
  payload: unknown;
};

export function fromChat(chat: AvitoChat, selfId: string): IngestInput {
  return {
    chatId: chat.id,
    authorName: counterpartName(chat, selfId),
    messageText: chat.last_message?.content?.text ?? "",
    itemTitle: chat.context?.value?.title ?? null,
    itemId: chat.context?.value?.id ? String(chat.context.value.id) : null,
    avitoUserId: counterpartId(chat, selfId),
    messageId: null,
    payload: chat,
  };
}

/**
 * Обрабатывает одно входящее обращение.
 * Новый чат -> новый лид в разделе «Новые».
 * Знакомый чат -> сообщение в историю переписки клиента.
 */
export async function ingestAvitoMessage(input: IngestInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const base = {
    event_type: "message",
    chat_id: input.chatId,
    author_name: input.authorName,
    message_text: input.messageText || null,
    item_title: input.itemTitle,
    payload: (input.payload ?? null) as never,
  };

  // Уже взятый в работу клиент по этому чату?
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("avito_chat_id", input.chatId)
    .maybeSingle();

  if (client) {
    if (input.messageId) {
      const { data: existing } = await supabaseAdmin
        .from("avito_messages")
        .select("id")
        .eq("message_id", input.messageId)
        .maybeSingle();
      if (existing) {
        await supabaseAdmin
          .from("avito_events")
          .insert({ ...base, client_id: client.id, status: "duplicate" });
        return { status: "duplicate" as const };
      }
    }
    await supabaseAdmin.from("avito_messages").insert({
      client_id: client.id,
      chat_id: input.chatId,
      message_id: input.messageId,
      direction: "in",
      message_text: input.messageText || "(без текста)",
      raw_data: (input.payload ?? null) as never,
    });
    await supabaseAdmin
      .from("clients")
      .update({ last_contact_at: new Date().toISOString() })
      .eq("id", client.id);
    await supabaseAdmin
      .from("avito_events")
      .insert({ ...base, client_id: client.id, status: "message_added" });
    return { status: "message_added" as const, clientId: client.id };
  }

  // Лид по этому чату уже висит в «Новых»?
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("avito_chat_id", input.chatId)
    .maybeSingle();

  if (lead) {
    await supabaseAdmin
      .from("avito_events")
      .insert({ ...base, lead_id: lead.id, status: "duplicate" });
    return { status: "duplicate" as const, leadId: lead.id };
  }

  const { data: created, error } = await supabaseAdmin
    .from("leads")
    .insert({
      name: input.authorName,
      source: "Avito",
      source_id: input.chatId,
      avito_chat_id: input.chatId,
      avito_user_id: input.avitoUserId,
      avito_item_id: input.itemId,
      avito_item_title: input.itemTitle,
      vehicle: input.itemTitle,
      message: input.messageText || null,
      status: "new",
    })
    .select("id")
    .single();

  if (error || !created) {
    await supabaseAdmin
      .from("avito_events")
      .insert({ ...base, status: "error", note: error?.message ?? "Не удалось создать лид" });
    return { status: "error" as const };
  }

  await supabaseAdmin
    .from("avito_events")
    .insert({ ...base, lead_id: created.id, status: "lead_created" });
  return { status: "lead_created" as const, leadId: created.id };
}
