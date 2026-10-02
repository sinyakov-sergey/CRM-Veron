import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildContract, dateLong, dateShort, formatMoney, numberToWords } from "@/lib/contract";

export const Route = createFileRoute("/_authenticated/contract")({
  head: () => ({
    meta: [
      { title: "Договоры — ВЕРОН CRM" },
      { name: "description", content: "Договор купли-продажи и агентский договор: заполнение реквизитов и выгрузка в Word" },
      { property: "og:title", content: "Договоры — ВЕРОН CRM" },
      { property: "og:description", content: "Договор купли-продажи и агентский договор: заполнение реквизитов и выгрузка в Word" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContractPage,
});

type Kind = "dkp" | "agent";
type Field = { key: string; label: string; type?: string; placeholder?: string; wide?: boolean; only?: Kind };

const KIND_LABEL: Record<Kind, string> = {
  dkp: "Договор купли-продажи",
  agent: "Агентский договор",
};

function sections(kind: Kind): { title: string; fields: Field[] }[] {
  const person = kind === "agent" ? "Принципал (собственник авто)" : "Покупатель";
  const all: { title: string; fields: Field[] }[] = [
    { title: "Договор", fields: [{ key: "date", label: "Дата договора", type: "date" }] },
    {
      title: person,
      fields: [
        { key: "buyer_fio", label: "ФИО", placeholder: "Иванов Иван Иванович", wide: true },
        { key: "birth_date", label: "Дата рождения", type: "date", only: "agent" },
        { key: "birth_place", label: "Место рождения", placeholder: "г. Воронеж", only: "agent" },
        { key: "passport", label: "Паспорт (серия и номер)", placeholder: "2018 262388" },
        { key: "passport_date", label: "Дата выдачи", type: "date" },
        { key: "passport_by", label: "Кем выдан", placeholder: "ГУ МВД РОССИИ ПО ВОРОНЕЖСКОЙ ОБЛАСТИ", wide: true },
        { key: "passport_code", label: "Код подразделения", placeholder: "360-007" },
        { key: "buyer_address", label: "Адрес регистрации", placeholder: "Воронежская обл. г. Воронеж ул. Черняховского д.15А кв.35", wide: true },
      ],
    },
    {
      title: "Автомобиль",
      fields: [
        { key: "vin", label: "VIN", placeholder: "X9FKXXEEBKBM46884" },
        { key: "body_number", label: "Номер кузова", placeholder: "X9FKXXEEBKBM46884", only: "dkp" },
        { key: "brand_model", label: "Марка, модель", placeholder: "Ford Focus III" },
        { key: "vehicle_type", label: "Тип ТС", placeholder: "Легковой" },
        { key: "category", label: "Категория", placeholder: "В", only: "dkp" },
        { key: "year", label: "Год выпуска", placeholder: "2011" },
        { key: "color", label: "Цвет кузова", placeholder: "серо-коричневый" },
        { key: "power_hp", label: "Мощность, л.с.", placeholder: "122", only: "dkp" },
        { key: "engine_volume", label: "Объём, куб. см", placeholder: "1390", only: "dkp" },
        { key: "fuel", label: "Тип двигателя", placeholder: "Бензин", only: "dkp" },
        { key: "engine_number", label: "№ двигателя", placeholder: "PNDA BM46884" },
        { key: "mileage", label: "Пробег, км", placeholder: "182 558", only: "dkp" },
        { key: "pts", label: "ПТС (ЭПТС): номер, кем и когда выдан", placeholder: "36 РУ 464442 МРЭО ГИБДД №2 ГУ МВД РОССИИ 07.07.2026", wide: true },
        { key: "plate", label: "Госномер", placeholder: "Р859УА36" },
        { key: "sts", label: "СТС", placeholder: "99 93 879456" },
        {
          key: "price",
          label: kind === "agent" ? "Сумма Принципалу за ТС, ₽" : "Стоимость, ₽",
          type: "number",
          placeholder: "780000",
        },
      ],
    },
    {
      title: kind === "agent" ? "Агент" : "Продавец",
      fields: [
        { key: "seller_name", label: "Наименование", wide: true },
        { key: "seller_director", label: "В лице (родительный падеж)", only: "agent" },
        { key: "seller_short", label: "Подпись (Фамилия И.О.)", only: "dkp" },
        { key: "seller_address", label: "Место нахождения", wide: true },
        { key: "seller_ogrnip", label: "ОГРНИП" },
        { key: "seller_inn", label: "ИНН" },
        { key: "seller_account", label: "Расчётный счёт" },
        { key: "seller_corr", label: "Корр. счёт" },
        { key: "seller_bank", label: "Банк", wide: true },
        { key: "seller_bik", label: "БИК" },
      ],
    },
  ];
  return all.map((s) => ({ ...s, fields: s.fields.filter((f) => !f.only || f.only === kind) }));
}

const DEFAULTS: Record<string, string> = {
  date: new Date().toISOString().slice(0, 10),
  vehicle_type: "Легковой",
  category: "В",
  seller_name: "Индивидуальный предприниматель Солдатов Илья Сергеевич",
  seller_director: "Солдатова Ильи Сергеевича",
  seller_short: "Солдатов И.С",
  seller_address: "394036, гор. Воронеж, ул. Смоленская, д. 18, кв 5",
  seller_ogrnip: "324366800061363",
  seller_inn: "366602827853",
  seller_account: "40802810813000118699",
  seller_corr: "30101810600000000681",
  seller_bank: "ЦЕНТРАЛЬНО-ЧЕРНОЗЕМНЫЙ БАНК ПАО СБЕРБАНК",
  seller_bik: "042007681",
};

function ContractPage() {
  const [kind, setKind] = useState<Kind>("dkp");
  const [v, setV] = useState<Record<string, string>>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const set = (k: string, val: string) => setV((s) => ({ ...s, [k]: val }));

  async function generate() {
    const required = ["date", "buyer_fio", "vin", "brand_model", "price"];
    const missing = required.filter((k) => !v[k]?.trim());
    if (missing.length) {
      toast.error(
        kind === "agent"
          ? "Заполните дату, ФИО принципала, VIN, марку и сумму"
          : "Заполните дату, ФИО покупателя, VIN, марку и стоимость",
      );
      return;
    }
    const price = Number(v["price"]);
    const g = (k: string) => (v[k] ?? "").trim();

    let personFull: string;
    if (kind === "agent") {
      personFull = [
        g("buyer_fio").toUpperCase(),
        g("birth_date") && `род. ${dateShort(g("birth_date"))}`,
        g("birth_place") && `в ${g("birth_place")}`,
        g("buyer_address") && `адрес: ${g("buyer_address")}`,
        g("passport") && `паспорт: ${g("passport")}`,
        (g("passport_by") || g("passport_date")) &&
          `выдан: ${dateShort(g("passport_date"))} ${g("passport_by")}`.trim(),
        g("passport_code") && `код подразделения: ${g("passport_code")}`,
      ]
        .filter(Boolean)
        .join(", ");
    } else {
      personFull = [
        g("buyer_fio"),
        g("passport") && `паспорт: ${g("passport")}`,
        (g("passport_by") || g("passport_date")) &&
          `выдан ${g("passport_by")} ${dateShort(g("passport_date"))}`.trim(),
        g("passport_code") && `код подразделения ${g("passport_code")}`,
        g("buyer_address") && `адрес: ${g("buyer_address")}`,
      ]
        .filter(Boolean)
        .join(" ");
    }

    const values: Record<string, string> = {
      ...Object.fromEntries(Object.keys(v).map((k) => [k, g(k)])),
      date: dateLong(g("date")),
      buyer_full: personFull,
      buyer_short: g("buyer_fio"),
      principal_full: personFull,
      principal_fio: g("buyer_fio").toUpperCase(),
      price_num: formatMoney(price),
      price_words: numberToWords(price),
    };
    setBusy(true);
    try {
      const surname = g("buyer_fio").split(" ")[0] || (kind === "agent" ? "принципал" : "покупатель");
      const prefix = kind === "agent" ? "Агентский договор" : "ДКП";
      await buildContract(
        values,
        `${prefix} ${surname} ${dateShort(g("date"))}.docx`,
        kind === "agent" ? "/templates/agent.docx" : "/templates/dkp.docx",
      );
      toast.success("Договор сформирован");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сформировать договор");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{KIND_LABEL[kind]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Заполните реквизиты — договор и акт приёма-передачи скачаются в Word.
          </p>
        </div>
        <div className="inline-flex rounded-lg border bg-card p-1" role="tablist">
          {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={
                "rounded-md px-3 py-1.5 text-sm transition-colors " +
                (kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
              }
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {sections(kind).map((s) => (
        <section key={s.title} className="space-y-3">
          <h2 className="label-xs">{s.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {s.fields.map((f) => (
              <label key={f.key} className={f.wide ? "space-y-1 sm:col-span-2" : "space-y-1"}>
                <span className="text-xs text-muted-foreground">{f.label}</span>
                <Input
                  type={f.type ?? "text"}
                  value={v[f.key] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </label>
            ))}
          </div>
          {s.title === "Автомобиль" && Number(v["price"]) > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatMoney(Number(v["price"]))} ({numberToWords(Number(v["price"]))} рублей 00 копеек)
            </p>
          )}
        </section>
      ))}

      <Button size="lg" onClick={generate} disabled={busy}>
        {busy ? "Формирую…" : "Сформировать"}
      </Button>
    </div>
  );
}
