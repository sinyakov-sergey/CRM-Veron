import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ACTION_SHORT, fmtDateTime, useMe } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({
    meta: [
      { title: "Клиенты — ВЕРОН CRM" },
      { name: "description", content: "Активные клиенты менеджера" },
      { property: "og:title", content: "Клиенты — ВЕРОН CRM" },
      { property: "og:description", content: "Активные клиенты менеджера" },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const { data: me } = useMe();
  const [search, setSearch] = useState("");

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", me?.userId],
    enabled: !!me,
    queryFn: async () => {
      let q = supabase
        .from("clients")
        .select("id, name, phone, vehicle, status, next_action_at")
        .eq("status", "active")
        .order("next_action_at", { ascending: true, nullsFirst: true });
      if (!me?.isAdmin) q = q.eq("manager_id", me!.userId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: nextTasks } = useQuery({
    queryKey: ["open-tasks", me?.userId],
    enabled: !!me,
    queryFn: async () => {
      let q = supabase.from("tasks").select("client_id, type, due_at").eq("status", "open");
      if (!me?.isAdmin) q = q.eq("manager_id", me!.userId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const term = search.trim().toLowerCase();
  const list = (clients ?? []).filter((c) =>
    term
      ? [c.name, c.phone ?? "", c.vehicle ?? ""].some((v) => v.toLowerCase().includes(term))
      : true,
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="label-xs">Клиенты</p>
        <h1 className="text-xl font-semibold tracking-tight">Активные клиенты</h1>
      </div>

      <Input
        placeholder="Поиск: имя, телефон, автомобиль"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
      {!isLoading && list.length === 0 && (
        <p className="text-sm text-muted-foreground">Клиентов нет.</p>
      )}

      {list.length > 0 && (
        <ul className="divide-y rounded-lg border bg-card">
          {list.map((client) => {
            const task = (nextTasks ?? [])
              .filter((t) => t.client_id === client.id)
              .sort((a, b) => a.due_at.localeCompare(b.due_at))[0];
            return (
              <li key={client.id}>
                <Link
                  to="/clients/$clientId"
                  params={{ clientId: client.id }}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{client.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {client.vehicle ?? "—"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    {task ? (
                      <>
                        <span className="block">{ACTION_SHORT[task.type]}</span>
                        <span className="block tabular-nums">{fmtDateTime(task.due_at)}</span>
                      </>
                    ) : (
                      <span className="text-warning">Нет действия</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
