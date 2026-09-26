import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ВЕРОН CRM — рабочий кабинет" },
      { name: "description", content: "Внутренняя CRM автосалона ВЕРОН: лиды, клиенты, задачи." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "ВЕРОН CRM — рабочий кабинет" },
      {
        property: "og:description",
        content: "Внутренняя CRM автосалона ВЕРОН: лиды, клиенты, задачи.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/today" : "/auth", replace: true });
  },
  component: () => null,
});
