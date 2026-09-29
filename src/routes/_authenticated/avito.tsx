import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useMe, fmtDateTime } from "@/lib/crm";
import { AVITO_EVENT_STATUS, type AvitoEventRow } from "@/lib/avito-shared";
import { avitoStatus, avitoCheck, avitoRegisterWebhook, avitoSyncChats } from "@/lib/avito.functions";

export const Route = createFileRoute("/_authenticated/avito")({
  head: () => ({
    meta: [
      { title: "Интеграция с Авито — ВЕРОН CRM" },
      { name: "description", content: "Подключение Авито: новые обращения попадают в лиды автоматически" },
      { property: "og:title", content: "Интеграция с Авито — ВЕРОН CRM" },
      {
        property: "og:description",
        content: "Подключение Авито: новые обращения попадают в лиды автоматически",
      },
    ],
  }),
  component: AvitoPage,
});

function AvitoPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();

  const status = useServerFn(avitoStatus);
  const check = useServerFn(avitoCheck);
  const register = useServerFn(avitoRegisterWebhook);
  const sync = useServerFn(avitoSyncChats);

  const statusQ = useQuery({
    queryKey: ["avito-status"],
    enabled: !!me?.isAdmin,
    queryFn: () => status({ data: undefined as never }),
  });

  const eventsQ = useQuery({
    queryKey: ["avito-events"],
    enabled: !!me?.isAdmin,
    queryFn: async (): Promise<AvitoEventRow[]> => {
      const { data } = await supabase
        .from("avito_events")
        .select("id, event_type, chat_id, author_name, message_text, item_title, status, note, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []) as AvitoEventRow[];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["avito-status"] });
    queryClient.invalidateQueries({ queryKey: ["avito-events"] });
  };

  const checkM = useMutation({
    mutationFn: () => check({ data: undefined as never }),
    onSuccess: (r) => {
      if (r.ok) toast.success(`Подключено: аккаунт ${r.accountName || r.accountId}`);
      else toast.error(r.error);
      refresh();
    },
    onError: () => toast.error("Не удалось связаться с Авито"),
  });

  const registerM = useMutation({
    mutationFn: () => register({ data: undefined as never }),
    onSuccess: (r) => {
      if (r.ok) toast.success("Авито будет присылать новые обращения сюда");
      else toast.error(r.error);
      refresh();
    },
    onError: () => toast.error("Не удалось подключить приём сообщений"),
  });

  const syncM = useMutation({
    mutationFn: () => sync({ data: undefined as never }),
    onSuccess: (r) => {
      if (r.ok) toast.success(`Проверено диалогов: ${r.total}. Новых лидов: ${r.created}`);
      else toast.error(r.error);
      refresh();
    },
    onError: () => toast.error("Не удалось загрузить диалоги"),
  });

  if (me && !me.isAdmin) {
    return <p className="text-sm text-muted-foreground">Раздел доступен только руководителю.</p>;
  }

  const s = statusQ.data;
  const busy = checkM.isPending || registerM.isPending || syncM.isPending;

  return (
    <div className="space-y-6">
      <div>
        <p className="label-xs">Интеграция</p>
        <h1 className="text-xl font-semibold tracking-tight">Авито</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Когда покупатель пишет по объявлению, обращение само появляется в разделе «Новые».
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={
              "inline-flex items-center gap-2 text-sm font-medium " +
              (s?.connected ? "text-foreground" : "text-muted-foreground")
            }
          >
            <span
              className={
                "h-2 w-2 rounded-full " + (s?.connected ? "bg-emerald-500" : "bg-muted-foreground/40")
              }
            />
            {statusQ.isLoading
              ? "Проверяем…"
              : s?.connected
                ? `Подключено${s.accountName ? `: ${s.accountName}` : ""}`
                : "Не подключено"}
          </span>
          {s?.accountId && (
            <span className="text-xs text-muted-foreground">Аккаунт Авито: {s.accountId}</span>
          )}
        </div>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="label-xs">Приём сообщений подключён</dt>
            <dd>{s?.webhookRegisteredAt ? fmtDateTime(s.webhookRegisteredAt) : "—"}</dd>
          </div>
          <div>
            <dt className="label-xs">Последняя загрузка диалогов</dt>
            <dd>{s?.lastSyncAt ? fmtDateTime(s.lastSyncAt) : "—"}</dd>
          </div>
        </dl>

        {s?.lastError && (
          <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {s.lastError}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => checkM.mutate()} disabled={busy}>
            Проверить подключение
          </Button>
          <Button variant="outline" onClick={() => registerM.mutate()} disabled={busy}>
            Подключить приём сообщений
          </Button>
          <Button variant="outline" onClick={() => syncM.mutate()} disabled={busy}>
            Загрузить последние диалоги
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">Последние обращения с Авито</p>
        </div>
        {(eventsQ.data ?? []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Пока обращений не было. Они появятся здесь сразу после подключения.
          </p>
        ) : (
          <ul className="divide-y">
            {(eventsQ.data ?? []).map((e) => (
              <li key={e.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{e.author_name || "Покупатель"}</span>
                  <span className="text-xs text-muted-foreground">
                    {AVITO_EVENT_STATUS[e.status] ?? e.status} · {fmtDateTime(e.created_at)}
                  </span>
                </div>
                {e.item_title && (
                  <p className="text-xs text-muted-foreground">{e.item_title}</p>
                )}
                {e.message_text && <p className="mt-1 text-sm">{e.message_text}</p>}
                {e.note && <p className="mt-1 text-xs text-destructive">{e.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
