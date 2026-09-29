import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  id: z.string().optional(),
  version: z.string().optional(),
  timestamp: z.number().optional(),
  payload: z.object({
    type: z.string().optional(),
    value: z.object({
      id: z.string().optional(),
      chat_id: z.string(),
      user_id: z.union([z.string(), z.number()]).optional(),
      author_id: z.union([z.string(), z.number()]).optional(),
      type: z.string().optional(),
      item_id: z.union([z.string(), z.number()]).optional(),
      content: z.object({ text: z.string().optional() }).partial().optional(),
    }),
  }),
});

export const Route = createFileRoute("/api/public/avito/$token")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const expected = process.env["AVITO_WEBHOOK_TOKEN"];
        if (!expected || params.token !== expected) {
          return new Response("Forbidden", { status: 403 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const parsed = payloadSchema.safeParse(body);
        if (!parsed.success) return new Response("ok");

        const value = parsed.data.payload.value;
        const selfId = value.user_id != null ? String(value.user_id) : null;
        const authorId = value.author_id != null ? String(value.author_id) : null;

        // Исходящие сообщения (написал наш менеджер) в лиды не превращаем.
        if (selfId && authorId && selfId === authorId) return new Response("ok");

        const { getAvitoToken, getChat, counterpartName, counterpartId } = await import(
          "@/lib/avito.server"
        );
        const { ingestAvitoMessage } = await import("@/lib/avito-ingest.server");

        let authorName = "Покупатель с Авито";
        let itemTitle: string | null = null;
        let avitoUserId = authorId;

        try {
          if (selfId) {
            const token = await getAvitoToken();
            const chat = await getChat(token, selfId, value.chat_id);
            authorName = counterpartName(chat, selfId);
            itemTitle = chat.context?.value?.title ?? null;
            avitoUserId = counterpartId(chat, selfId) ?? authorId;
          }
        } catch {
          // Данные чата недоступны — создаём лид по тому, что пришло в событии.
        }

        await ingestAvitoMessage({
          chatId: value.chat_id,
          authorName,
          messageText: value.content?.text ?? "",
          itemTitle,
          itemId: value.item_id != null ? String(value.item_id) : null,
          avitoUserId,
          messageId: value.id ?? null,
          payload: body,
        });

        return Response.json({ ok: true });
      },
    },
  },
});
