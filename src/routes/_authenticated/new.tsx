import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/new")({
  head: () => ({
    meta: [
      { title: "Новые лиды — ВЕРОН CRM" },
      { name: "description", content: "Новые входящие обращения автосалона" },
      { property: "og:title", content: "Новые лиды — ВЕРОН CRM" },
      { property: "og:description", content: "Новые входящие обращения автосалона" },
    ],
  }),
  component: NewLeadsPage,
});

function NewLeadsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: leads, isLoading } = useQuery({
    queryKey: ["new-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("status", "new")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const claim = useMutation({
    mutationFn: async (leadId: string) => {
      const { data, error } = await supabase.rpc("claim_lead", { _lead_id: leadId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries();
      navigate({ to: "/clients/$clientId", params: { clientId } });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось взять лид");
      queryClient.invalidateQueries({ queryKey: ["new-leads"] });
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="label-xs">Новые</p>
        <h1 className="text-xl font-semibold tracking-tight">Входящие обращения</h1>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
      {!isLoading && (leads ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Новых обращений нет.</p>
      )}

      <ul className="space-y-3">
        {(leads ?? []).map((lead) => (
          <li key={lead.id} className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{lead.name}</p>
                <p className="text-sm text-muted-foreground">{lead.vehicle ?? "Автомобиль не указан"}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {lead.source} · {fmtDateTime(lead.created_at)}
              </p>
            </div>
            {lead.message && <p className="mt-3 text-sm leading-relaxed">{lead.message}</p>}
            <Button
              className="mt-4"
              size="sm"
              disabled={claim.isPending}
              onClick={() => claim.mutate(lead.id)}
            >
              Взять в работу
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
