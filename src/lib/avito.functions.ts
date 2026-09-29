import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AvitoStatus } from "./avito-shared";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Доступно только руководителю");
}

function webhookUrl() {
  const token = process.env["AVITO_WEBHOOK_TOKEN"];
  const base =
    process.env["LOVABLE_PROJECT_URL"] ??
    `https://project--${process.env["VITE_PROJECT_ID"] ?? "927b5a32-11ea-4f4b-89a3-2eff2931f097"}.lovable.app`;
  return `${base}/api/public/avito/${token}`;
}

/** Текущее состояние подключения к Авито. */
export const avitoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AvitoStatus> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("avito_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return {
      hasKeys: Boolean(process.env["AVITO_CLIENT_ID"] && process.env["AVITO_CLIENT_SECRET"]),
      connected: Boolean(data?.avito_user_id),
      accountId: data?.avito_user_id ?? null,
      accountName: data?.avito_account_name ?? null,
      webhookUrl: data?.webhook_url ?? webhookUrl(),
      webhookRegisteredAt: data?.webhook_registered_at ?? null,
      lastSyncAt: data?.last_sync_at ?? null,
      lastError: data?.last_error ?? null,
    };
  });

/** Проверка ключей: запрашиваем данные аккаунта Авито. */
export const avitoCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getAvitoToken, getSelf } = await import("./avito.server");
    try {
      const token = await getAvitoToken();
      const self = await getSelf(token);
      await supabaseAdmin
        .from("avito_settings")
        .update({
          avito_user_id: String(self.id),
          avito_account_name: self.name ?? self.email ?? null,
          last_checked_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      return { ok: true as const, accountId: String(self.id), accountName: self.name ?? "" };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Неизвестная ошибка";
      await supabaseAdmin
        .from("avito_settings")
        .update({ last_error: message, last_checked_at: new Date().toISOString() })
        .eq("id", 1);
      return { ok: false as const, error: message };
    }
  });

/** Подписка Авито на наш адрес приёма сообщений. */
export const avitoRegisterWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getAvitoToken, registerWebhook } = await import("./avito.server");
    const url = webhookUrl();
    try {
      const token = await getAvitoToken();
      await registerWebhook(token, url);
      await supabaseAdmin
        .from("avito_settings")
        .update({
          webhook_url: url,
          webhook_registered_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      return { ok: true as const, url };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Неизвестная ошибка";
      await supabaseAdmin.from("avito_settings").update({ last_error: message }).eq("id", 1);
      return { ok: false as const, error: message };
    }
  });

/** Ручная загрузка последних диалогов Авито. */
export const avitoSyncChats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getAvitoToken, getSelf, getChats } = await import("./avito.server");
    const { fromChat, ingestAvitoMessage } = await import("./avito-ingest.server");
    try {
      const token = await getAvitoToken();
      const { data: settings } = await supabaseAdmin
        .from("avito_settings")
        .select("avito_user_id")
        .eq("id", 1)
        .maybeSingle();
      const selfId = settings?.avito_user_id ?? String((await getSelf(token)).id);
      const { chats } = await getChats(token, selfId, 50);
      let created = 0;
      for (const chat of chats ?? []) {
        const res = await ingestAvitoMessage(fromChat(chat, selfId));
        if (res.status === "lead_created") created += 1;
      }
      await supabaseAdmin
        .from("avito_settings")
        .update({
          avito_user_id: selfId,
          last_sync_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      return { ok: true as const, total: chats?.length ?? 0, created };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Неизвестная ошибка";
      await supabaseAdmin.from("avito_settings").update({ last_error: message }).eq("id", 1);
      return { ok: false as const, error: message };
    }
  });
