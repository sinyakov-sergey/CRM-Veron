import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { isToday, useMe } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/control")({
  head: () => ({
    meta: [
      { title: "Контроль — ВЕРОН CRM" },
      { name: "description", content: "Показатели менеджеров и распределение лидов" },
      { property: "og:title", content: "Контроль — ВЕРОН CRM" },
      { property: "og:description", content: "Показатели менеджеров и распределение лидов" },
    ],
  }),
  component: ControlPage,
});

type Row = {
  id: string;
  name: string;
  active: number;
  today: number;
  overdue: number;
  meetings: number;
  sold: number;
  closed: number;
  isActive: boolean;
};

function ControlPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();

  const statsQ = useQuery({
    queryKey: ["control"],
    enabled: !!me?.isAdmin,
    queryFn: async (): Promise<Row[]> => {
      const [{ data: profiles }, { data: clients }, { data: tasks }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, is_active").order("full_name"),
        supabase.from("clients").select("id, status, manager_id"),
        supabase.from("tasks").select("id, type, due_at, status, manager_id"),
      ]);

      const now = Date.now();
      return (profiles ?? []).map((p) => {
        const myClients = (clients ?? []).filter((c) => c.manager_id === p.id);
        const myTasks = (tasks ?? []).filter((t) => t.manager_id === p.id && t.status === "open");
        return {
          id: p.id,
          name: p.full_name || p.email || "Менеджер",
          active: myClients.filter((c) => c.status === "active").length,
          today: myTasks.filter((t) => isToday(t.due_at)).length,
          overdue: myTasks.filter((t) => new Date(t.due_at).getTime() < now && !isToday(t.due_at))
            .length,
          meetings: myTasks.filter((t) => t.type === "meeting").length,
          sold: myClients.filter((c) => c.status === "sold").length,
          closed: myClients.filter((c) => c.status === "closed").length,
          isActive: p.is_active ?? true,
        };
      });
    },
  });

  const distribute = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("distribute_new_leads");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Лиды распределены");
      queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Ошибка"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["control"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Ошибка"),
  });

  if (me && !me.isAdmin) {
    return <p className="text-sm text-muted-foreground">Раздел доступен только руководителю.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs">Контроль</p>
          <h1 className="text-xl font-semibold tracking-tight">Менеджеры</h1>
        </div>
        <Button onClick={() => distribute.mutate()} disabled={distribute.isPending}>
          Распределить новые лиды
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Менеджер</th>
              <th className="px-3 py-2 font-medium">Активные</th>
              <th className="px-3 py-2 font-medium">Сегодня</th>
              <th className="px-3 py-2 font-medium">Просрочено</th>
              <th className="px-3 py-2 font-medium">Встречи</th>
              <th className="px-3 py-2 font-medium">Продажи</th>
              <th className="px-3 py-2 font-medium">Закрыто</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {(statsQ.data ?? []).map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  {r.name}
                  {!r.isActive && <span className="ml-2 text-xs text-muted-foreground">отключён</span>}
                </td>
                <td className="px-3 py-2 tabular-nums">{r.active}</td>
                <td className="px-3 py-2 tabular-nums">{r.today}</td>
                <td className="px-3 py-2 tabular-nums">{r.overdue}</td>
                <td className="px-3 py-2 tabular-nums">{r.meetings}</td>
                <td className="px-3 py-2 tabular-nums">{r.sold}</td>
                <td className="px-3 py-2 tabular-nums">{r.closed}</td>
                <td className="px-3 py-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleActive.mutate({ id: r.id, next: !r.isActive })}
                  >
                    {r.isActive ? "Отключить" : "Включить"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
