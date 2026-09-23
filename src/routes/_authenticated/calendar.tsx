import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { ACTION_SHORT, fmtDay, fmtTime, useMe } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Календарь — ВЕРОН CRM" },
      { name: "description", content: "Звонки, чаты и встречи по датам" },
      { property: "og:title", content: "Календарь — ВЕРОН CRM" },
      { property: "og:description", content: "Звонки, чаты и встречи по датам" },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const { data: me } = useMe();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["calendar", me?.userId],
    enabled: !!me,
    queryFn: async () => {
      let q = supabase
        .from("tasks")
        .select("id, type, due_at, comment, client_id, clients(name, vehicle)")
        .eq("status", "open")
        .order("due_at");
      if (!me?.isAdmin) q = q.eq("manager_id", me!.userId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const groups = new Map<string, typeof tasks>();
  for (const task of tasks ?? []) {
    const key = new Date(task.due_at).toDateString();
    groups.set(key, [...(groups.get(key) ?? []), task]);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="label-xs">Календарь</p>
        <h1 className="text-xl font-semibold tracking-tight">Запланированные действия</h1>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
      {!isLoading && (tasks ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Запланированных действий нет.</p>
      )}

      {[...groups.entries()].map(([day, items]) => (
        <section key={day} className="space-y-2">
          <p className="label-xs">{fmtDay(new Date(day))}</p>
          <ul className="divide-y rounded-lg border bg-card">
            {(items ?? []).map((task) => (
              <li key={task.id}>
                <Link
                  to="/clients/$clientId"
                  params={{ clientId: task.client_id }}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/50"
                >
                  <span className="w-12 shrink-0 text-sm tabular-nums text-muted-foreground">
                    {fmtTime(task.due_at)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{task.clients?.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {task.clients?.vehicle ?? "—"}
                      {task.comment ? ` · ${task.comment}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {ACTION_SHORT[task.type]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
