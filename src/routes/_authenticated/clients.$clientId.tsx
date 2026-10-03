import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { avitoChatMessages, avitoChatSend, avitoChatSendImage } from "@/lib/avito-chat.functions";
import {
  ACTION_SHORT,
  CLOSE_REASONS,
  HISTORY_LABEL,
  fmtDateTime,
  logInteraction,
  useMe,
} from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  head: () => ({
    meta: [
      { title: "Карточка клиента — ВЕРОН CRM" },
      { name: "description", content: "Связаться с клиентом и назначить следующее действие" },
      { property: "og:title", content: "Карточка клиента — ВЕРОН CRM" },
      { property: "og:description", content: "Связаться с клиентом и назначить следующее действие" },
    ],
  }),
  component: ClientPage,
});

function ClientPage() {
  const { clientId } = Route.useParams();
  const { data: me } = useMe();
  const queryClient = useQueryClient();

  const [showPhone, setShowPhone] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [step, setStep] = useState<"idle" | "choose" | "action" | "close">("idle");

  const invalidate = () => queryClient.invalidateQueries();

  const clientQ = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const commentsQ = useQuery({
    queryKey: ["comments", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, text, created_at, manager_id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((c) => c.manager_id))];
      const names = new Map<string, string>();
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ids);
        for (const p of profiles ?? []) names.set(p.id, p.full_name || p.email || "Менеджер");
      }
      return (data ?? []).map((c) => ({ ...c, author: names.get(c.manager_id) ?? "Менеджер" }));
    },
  });

  const tasksQ = useQuery({
    queryKey: ["client-tasks", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("client_id", clientId)
        .eq("status", "open")
        .order("due_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const historyQ = useQuery({
    queryKey: ["history", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interactions")
        .select("id, type, description, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveComment = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Нет сессии");
      const text = comment.trim();
      if (!text) throw new Error("Комментарий пустой");
      const { error } = await supabase
        .from("comments")
        .insert({ client_id: clientId, manager_id: me.userId, text });
      if (error) throw error;
      await supabase
        .from("clients")
        .update({ last_contact_at: new Date().toISOString() })
        .eq("id", clientId);
      await logInteraction(clientId, me.userId, "comment", text.slice(0, 120));
    },
    onSuccess: () => {
      setComment("");
      setStep("choose");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Ошибка"),
  });

  const client = clientQ.data;

  if (clientQ.isLoading) return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  if (!client) return <p className="text-sm text-muted-foreground">Клиент не найден.</p>;

  const openTask = (tasksQ.data ?? [])[0];

  return (
    <div className="space-y-8">
      <Link to="/clients" className="text-xs text-muted-foreground hover:text-foreground">
        ← Клиенты
      </Link>

      {/* Шапка: кто это, что нужно, как связаться */}
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
        <p className="mt-1 text-base text-muted-foreground">{client.vehicle ?? "Автомобиль не указан"}</p>

        {client.status !== "active" && (
          <p className="mt-3 inline-block rounded-md bg-muted px-2 py-1 text-xs">
            {client.status === "sold"
              ? `Продано · ${fmtDateTime(client.sold_at)}`
              : `Закрыт · ${client.close_reason} · ${fmtDateTime(client.closed_at)}`}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button asChild={!!client.phone} onClick={() => setShowPhone(true)} size="lg">
            {client.phone ? <a href={`tel:${client.phone}`}>Позвонить</a> : <span>Позвонить</span>}
          </Button>
          <Button variant="outline" size="lg" onClick={() => setChatOpen((v) => !v)}>
            Чат
          </Button>
          {client.phone && (
            <button
              type="button"
              className="text-base tabular-nums text-foreground underline-offset-4 hover:underline"
              onClick={() => {
                navigator.clipboard?.writeText(client.phone!);
                toast.success("Номер скопирован");
              }}
            >
              {client.phone}
            </button>
          )}
        </div>
        {showPhone && client.phone && (
          <p className="mt-2 text-xs text-muted-foreground">Нажмите на номер, чтобы скопировать.</p>
        )}

        <ManagerRow
          clientId={clientId}
          managerId={client.manager_id}
          isAdmin={!!me?.isAdmin}
          meId={me?.userId ?? null}
        />
      </section>

      {chatOpen && <AvitoChat clientId={clientId} />}

      <ClientFiles clientId={clientId} />


      {openTask && (
        <section className="rounded-lg border bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">Следующее действие: </span>
          {ACTION_SHORT[openTask.type]} · {fmtDateTime(openTask.due_at)}
          {openTask.comment ? ` · ${openTask.comment}` : ""}
        </section>
      )}

      {/* Комментарий */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Комментарий</h2>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={5}
          className="min-h-32 text-base leading-relaxed"
          placeholder="Что обсудили с клиентом…"
        />
        <Button onClick={() => saveComment.mutate()} disabled={saveComment.isPending}>
          Сохранить комментарий
        </Button>

        {(commentsQ.data ?? []).length > 0 && (
          <ul className="space-y-3 pt-2">
            {(commentsQ.data ?? []).map((c) => (
              <li key={c.id} className="rounded-lg border bg-card p-4">
                <p className="whitespace-pre-wrap text-base leading-relaxed">{c.text}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {c.author} ·{" "}
                  {fmtDateTime(c.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Обязательный следующий шаг */}
      {client.status === "active" && (
        <section className="space-y-4">
          {step === "choose" && (
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm">Выберите, что дальше:</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setStep("action")}>
                  Назначить следующее действие
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStep("close")}>
                  Закрыть клиента
                </Button>
              </div>
            </div>
          )}

          {step !== "choose" && step !== "action" && step !== "close" && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setStep("action")}>
                Следующее действие
              </Button>
              <Button size="sm" variant="outline" onClick={() => setStep("close")}>
                Закрыть клиента
              </Button>
              <MarkSoldButton clientId={clientId} />
            </div>
          )}

          {step === "action" && (
            <NextActionForm
              clientId={clientId}
              onDone={() => {
                setStep("idle");
                invalidate();
              }}
              onCancel={() => setStep("idle")}
            />
          )}

          {step === "close" && (
            <CloseClientForm
              clientId={clientId}
              onDone={() => {
                setStep("idle");
                invalidate();
              }}
              onCancel={() => setStep("idle")}
            />
          )}
        </section>
      )}

      {/* История */}
      <section className="space-y-2">
        <h2 className="label-xs">История</h2>
        <ul className="space-y-1.5">
          {(historyQ.data ?? []).map((h) => (
            <li key={h.id} className="flex gap-3 text-sm">
              <span className="w-28 shrink-0 tabular-nums text-muted-foreground">
                {fmtDateTime(h.created_at)}
              </span>
              <span className="min-w-0">
                {HISTORY_LABEL[h.type] ?? h.type}
                {h.description ? <span className="text-muted-foreground"> · {h.description}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MarkSoldButton({ clientId }: { clientId: string }) {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Нет сессии");
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("clients")
        .update({ status: "sold", sold_at: now, next_action_at: null })
        .eq("id", clientId);
      if (error) throw error;
      await supabase
        .from("tasks")
        .update({ status: "done", completed_at: now })
        .eq("client_id", clientId)
        .eq("status", "open");
      await logInteraction(clientId, me.userId, "sold", "Автомобиль продан");
    },
    onSuccess: () => {
      toast.success("Клиент отмечен как продажа");
      queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Ошибка"),
  });

  return (
    <Button size="sm" variant="secondary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      Продано
    </Button>
  );
}

function NextActionForm({
  clientId,
  onDone,
  onCancel,
}: {
  clientId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { data: me } = useMe();
  const [type, setType] = useState<"call" | "chat" | "meeting">("call");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Нет сессии");
      const dueAt = new Date(`${date}T${time}`);
      if (Number.isNaN(dueAt.getTime())) throw new Error("Укажите дату и время");
      const { error } = await supabase.from("tasks").insert({
        client_id: clientId,
        manager_id: me.userId,
        type,
        due_at: dueAt.toISOString(),
        comment: note.trim() || null,
      });
      if (error) throw error;
      await supabase
        .from("clients")
        .update({ next_action_at: dueAt.toISOString() })
        .eq("id", clientId);
      await logInteraction(
        clientId,
        me.userId,
        "next_action",
        `${ACTION_SHORT[type]} · ${fmtDateTime(dueAt.toISOString())}${note ? ` · ${note}` : ""}`,
      );
    },
    onSuccess: () => {
      toast.success("Действие назначено");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Ошибка"),
  });

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <p className="text-sm font-medium">Следующее действие</p>
      <div className="flex gap-2">
        {(["call", "chat", "meeting"] as const).map((t) => (
          <Button
            key={t}
            type="button"
            size="sm"
            variant={type === t ? "default" : "outline"}
            onClick={() => setType(t)}
          >
            {ACTION_SHORT[t]}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-40"
        />
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-32" />
      </div>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Короткий комментарий"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          Сохранить
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </div>
  );
}

function CloseClientForm({
  clientId,
  onDone,
  onCancel,
}: {
  clientId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { data: me } = useMe();
  const [reason, setReason] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Нет сессии");
      if (!reason) throw new Error("Выберите причину");
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("clients")
        .update({ status: "closed", close_reason: reason, closed_at: now, next_action_at: null })
        .eq("id", clientId);
      if (error) throw error;
      await supabase
        .from("tasks")
        .update({ status: "done", completed_at: now })
        .eq("client_id", clientId)
        .eq("status", "open");
      await logInteraction(clientId, me.userId, "closed", reason);
    },
    onSuccess: () => {
      toast.success("Клиент закрыт");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Ошибка"),
  });

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <p className="text-sm font-medium">Причина закрытия</p>
      <div className="flex flex-wrap gap-2">
        {CLOSE_REASONS.map((r) => (
          <Button
            key={r}
            type="button"
            size="sm"
            variant={reason === r ? "default" : "outline"}
            onClick={() => setReason(r)}
          >
            {r}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          Закрыть клиента
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </div>
  );
}

const BUCKET = "client-files";

function safeName(name: string) {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
}

function ManagerRow({
  clientId,
  managerId,
  isAdmin,
  meId,
}: {
  clientId: string;
  managerId: string;
  isAdmin: boolean;
  meId: string | null;
}) {
  const queryClient = useQueryClient();
  const managersQ = useQuery({
    queryKey: ["managers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, is_active")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const list = managersQ.data ?? [];
  const current = list.find((m) => m.id === managerId);
  const label = (m: { full_name: string; email: string }) => m.full_name || m.email || "Менеджер";

  const change = useMutation({
    mutationFn: async (newId: string) => {
      if (!meId) throw new Error("Нет сессии");
      const target = list.find((m) => m.id === newId);
      const { error } = await supabase.from("clients").update({ manager_id: newId }).eq("id", clientId);
      if (error) throw error;
      await supabase
        .from("tasks")
        .update({ manager_id: newId })
        .eq("client_id", clientId)
        .eq("status", "open");
      await logInteraction(
        clientId,
        meId,
        "assigned",
        `Клиент передан менеджеру ${target ? label(target) : ""}`.trim(),
      );
    },
    onSuccess: () => {
      toast.success("Ответственный менеджер изменён");
      queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Ошибка"),
  });

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Ответственный менеджер:</span>
      {isAdmin ? (
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={managerId}
          disabled={change.isPending}
          onChange={(e) => change.mutate(e.target.value)}
          aria-label="Ответственный менеджер"
        >
          {!current && <option value={managerId}>—</option>}
          {list
            .filter((m) => m.is_active || m.id === managerId)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {label(m)}
              </option>
            ))}
        </select>
      ) : (
        <span className="font-medium">
          {current ? label(current) : "—"}
          {current?.email && current.full_name ? (
            <span className="ml-1 font-normal text-muted-foreground">({current.email})</span>
          ) : null}
        </span>
      )}
    </div>
  );
}

function ClientFiles({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const inputRef = useRef<HTMLInputElement>(null);

  const filesQ = useQuery({
    queryKey: ["client-files", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_files")
        .select("id, file_name, file_path, mime_type, size_bytes, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      if (!me) throw new Error("Нет сессии");
      for (const file of files) {
        const path = `${clientId}/docs/${safeName(file.name)}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type || "application/octet-stream",
        });
        if (upErr) throw upErr;
        const { error } = await supabase.from("client_files").insert({
          client_id: clientId,
          manager_id: me.userId,
          file_name: file.name,
          file_path: path,
          mime_type: file.type || null,
          size_bytes: file.size,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Файл сохранён");
      queryClient.invalidateQueries({ queryKey: ["client-files", clientId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Не удалось загрузить"),
  });

  const remove = useMutation({
    mutationFn: async (f: { id: string; file_path: string }) => {
      await supabase.storage.from(BUCKET).remove([f.file_path]);
      const { error } = await supabase.from("client_files").delete().eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["client-files", clientId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Ошибка"),
  });

  async function open(path: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
    if (error || !data) {
      toast.error("Не удалось открыть файл");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const files = filesQ.data ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Документы</h2>
        <Button
          size="sm"
          variant="outline"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {upload.isPending ? "Загрузка…" : "Прикрепить файл"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const list = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (list.length) upload.mutate(list);
          }}
        />
      </div>
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">Файлов пока нет — договоры, сканы, фото.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <button
                type="button"
                className="truncate text-left underline-offset-4 hover:underline"
                onClick={() => open(f.file_path)}
              >
                {f.file_name}
              </button>
              <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                {f.size_bytes ? `${Math.max(1, Math.round(f.size_bytes / 1024))} КБ · ` : ""}
                {fmtDateTime(f.created_at)}
                <button
                  type="button"
                  className="hover:text-destructive"
                  onClick={() => remove.mutate(f)}
                  aria-label={`Удалить ${f.file_name}`}
                >
                  Удалить
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AvitoChat({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const loadMessages = useServerFn(avitoChatMessages);
  const sendMessage = useServerFn(avitoChatSend);
  const sendImage = useServerFn(avitoChatSendImage);

  const messagesQ = useQuery({
    queryKey: ["avito", clientId],
    queryFn: () => loadMessages({ data: { clientId } }),
    refetchInterval: 20000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["avito", clientId] });
    queryClient.invalidateQueries({ queryKey: ["history", clientId] });
  };

  const send = useMutation({
    mutationFn: async () => {
      const body = text.trim();
      if (!body) return { ok: true } as { ok: boolean; error?: string };
      return await sendMessage({ data: { clientId, text: body } });
    },
    onSuccess: (res) => {
      setText("");
      if (res && res.ok === false) toast.error(res.error ?? "Сообщение не ушло в Авито");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Ошибка"),
  });

  const attach = useMutation({
    mutationFn: async (file: File) => {
      if (!me) throw new Error("Нет сессии");
      const isImage = /^image\/(jpeg|png|webp|gif)$/.test(file.type);
      if (isImage) {
        const path = `${clientId}/chat/${safeName(file.name)}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
        if (error) throw error;
        const res = await sendImage({ data: { clientId, path, fileName: file.name } });
        return { kind: "image" as const, ...res };
      }
      // Авито принимает в чате только фото — документ сохраняем в карточке клиента.
      const path = `${clientId}/docs/${safeName(file.name)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
      if (error) throw error;
      const { error: insErr } = await supabase.from("client_files").insert({
        client_id: clientId,
        manager_id: me.userId,
        file_name: file.name,
        file_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      if (insErr) throw insErr;
      return { kind: "doc" as const, ok: true };
    },
    onSuccess: (res) => {
      if (res.kind === "doc") {
        toast.info("Авито не принимает документы в чате — файл сохранён в «Документах» клиента");
        queryClient.invalidateQueries({ queryKey: ["client-files", clientId] });
      } else if (res.ok === false) {
        toast.error(("error" in res && res.error) || "Фото не ушло в Авито");
      } else {
        toast.success("Фото отправлено");
      }
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Не удалось отправить файл"),
  });

  const messages = messagesQ.data?.messages ?? [];

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <p className="text-xs text-muted-foreground">
          {messagesQ.data?.error
            ? "Переписка Авито недоступна"
            : messagesQ.data?.synced
              ? "Переписка Авито · обновляется автоматически"
              : "Переписка"}
        </p>
        <Button size="sm" variant="ghost" onClick={() => messagesQ.refetch()} disabled={messagesQ.isFetching}>
          Обновить
        </Button>
      </div>
      <div className="max-h-96 space-y-3 overflow-y-auto p-4">
        {messagesQ.isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
        {!messagesQ.isLoading && messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Сообщений пока нет.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.direction === "out" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                "max-w-[80%] rounded-lg px-3 py-2 text-sm " +
                (m.direction === "out" ? "bg-primary text-primary-foreground" : "bg-muted")
              }
            >
              {m.attachment?.kind === "image" && (
                <a href={m.attachment.url} target="_blank" rel="noopener noreferrer" className="block">
                  <img
                    src={m.attachment.url}
                    alt={m.attachment.name ?? "Фото"}
                    className="max-h-64 rounded-md object-contain"
                    loading="lazy"
                  />
                </a>
              )}
              {m.attachment && m.attachment.kind !== "image" && (
                <a
                  href={m.attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block underline underline-offset-4"
                >
                  {m.attachment.kind === "file" ? "📎 " : "🔗 "}
                  {m.attachment.name || m.attachment.url}
                </a>
              )}
              {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
              <p className="mt-1 text-[11px] opacity-70">
                {fmtDateTime(m.createdAt)}
                {m.direction === "out" && !m.delivered ? " · не отправлено" : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
      <form
        className="flex gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={attach.isPending}
          aria-label="Прикрепить фото или файл"
          title="Прикрепить фото или файл"
        >
          {attach.isPending ? "…" : "📎"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) attach.mutate(f);
          }}
        />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith("image/"));
            if (f) {
              e.preventDefault();
              attach.mutate(f);
            }
          }}
          placeholder="Сообщение покупателю в Авито"
        />
        <Button type="submit" disabled={send.isPending}>
          Отправить
        </Button>
      </form>
    </section>
  );
}
