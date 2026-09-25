import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/crm";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/today", label: "Сегодня" },
  { to: "/new", label: "Новые" },
  { to: "/clients", label: "Клиенты" },
  { to: "/calendar", label: "Календарь" },
  { to: "/contract", label: "Договор" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4">
          <Link to="/today" className="text-sm font-semibold tracking-tight">
            ВЕРОН
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} label={item.label} />
            ))}
            {me?.isAdmin && <NavLink to="/control" label="Контроль" />}
          </nav>
          <button
            type="button"
            onClick={signOut}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          >
            Выйти
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 pb-16">{children}</main>
    </div>
  );
}

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
      )}
      activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
    >
      {label}
    </Link>
  );
}
