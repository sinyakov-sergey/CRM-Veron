import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { ACTION_SHORT, fmtDateTime, fmtTime, isToday, useMe } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Сегодня — ВЕРОН CRM" },
      { name: "description", content: "Действия менеджера на сегодня" },
      { property: "og:title", content: "Сегодня — ВЕРОН CRM" },
      { property: "og:description", content: "Действия менеджера на сегодня" },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const { data: me } = useMe();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["today-tasks", me?.userId],
    enabled: !!me,
    queryFn: async () => {
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      let q = supabase
        .from("tasks")
        .select("id, type, due_at, comment, client_id, clients(name, vehicle, phone)")
        .eq("status", "open")
        .lte("due_at", endOfDay.toISOString())
        .order("due_at", { ascending: true });
      if (!me?.isAdmin) q = q.eq("manager_id", me!.userId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const overdue = (tasks ?? []).filter((t) => new Date(t.due_at) < new Date() && !isToday(t.due_at));
  const rest = (tasks ?? []).filter((t) => !overdue.includes(t));

  return (
    <div className="space-y-8">
      <div>
        <p className="label-xs">Сегодня</p>
        <h1 className="text-xl font-semibold tracking-tight">С кем связаться</h1>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}

      {!isLoading && (tasks ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">На сегодня действий нет.</p>
      )}

      {overdue.length > 0 && (
        <section className="space-y-2">
          <p className="label-xs text-destructive">Просрочено</p>
          <TaskList items={overdue} overdue />
        </section>
      )}

      {rest.length > 0 && (
        <section className="space-y-2">
          {overdue.length > 0 && <p className="label-xs">Сегодня</p>}
          <TaskList items={rest} />
        </section>
      )}
    </div>
  );
}

type TaskRow = {
  id: string;
  type: string;
  due_at: string;
  comment: string | null;
  client_id: string;
  clients: { name: string; vehicle: string | null; phone: string | null } | null;
};

function TaskList({ items, overdue }: { items: TaskRow[]; overdue?: boolean }) {
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {items.map((task) => (
        <li key={task.id}>
          <Link
            to="/clients/$clientId"
            params={{ clientId: task.client_id }}
            className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/50"
          >
            <span
              className={
                "w-16 shrink-0 text-sm tabular-nums " +
                (overdue ? "text-destructive" : "text-muted-foreground")
              }
            >
              {overdue ? fmtDateTime(task.due_at) : fmtTime(task.due_at)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{task.clients?.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {task.clients?.vehicle ?? "—"}
                {task.comment ? ` · ${task.comment}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{ACTION_SHORT[task.type]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
