import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActionType = "call" | "chat" | "meeting";

export const ACTION_LABEL: Record<string, string> = {
  call: "Позвонить",
  chat: "Написать",
  meeting: "Встреча",
};

export const ACTION_SHORT: Record<string, string> = {
  call: "Звонок",
  chat: "Чат",
  meeting: "Встреча",
};

export const CLOSE_REASONS = [
  "Купил в другом месте",
  "Дорого",
  "Не подошёл автомобиль",
  "Не подошёл кредит",
  "Передумал",
  "Не выходит на связь",
  "Другое",
];

export const HISTORY_LABEL: Record<string, string> = {
  created: "Создан клиент",
  assigned: "Назначен менеджер",
  call: "Звонок",
  message: "Сообщение",
  comment: "Комментарий",
  next_action: "Назначено следующее действие",
  meeting: "Встреча",
  sold: "Продано",
  closed: "Закрыто",
};

const dateTime = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const timeOnly = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

const dayLong = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "long" });

export const fmtDateTime = (v: string | null | undefined) => (v ? dateTime.format(new Date(v)) : "—");
export const fmtTime = (v: string | null | undefined) => (v ? timeOnly.format(new Date(v)) : "—");
export const fmtDay = (v: string | Date) => dayLong.format(typeof v === "string" ? new Date(v) : v);

export function isToday(value: string) {
  const d = new Date(value);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export type Me = {
  userId: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    staleTime: 60_000,
    queryFn: async (): Promise<Me | null> => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return null;
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      return {
        userId: user.id,
        email: profileRes.data?.email ?? user.email ?? "",
        fullName: profileRes.data?.full_name || user.email?.split("@")[0] || "",
        isAdmin: (rolesRes.data ?? []).some((r) => r.role === "admin"),
      };
    },
  });
}

export async function logInteraction(
  clientId: string,
  managerId: string,
  type: string,
  description?: string,
) {
  await supabase.from("interactions").insert({
    client_id: clientId,
    manager_id: managerId,
    type,
    description: description ?? null,
  });
}
