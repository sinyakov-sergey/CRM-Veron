import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildContract, dateLong, dateShort, formatMoney, numberToWords } from "@/lib/contract";

export const Route = createFileRoute("/_authenticated/contract")({
  head: () => ({
    meta: [
      { title: "Договор купли-продажи — ВЕРОН CRM" },
      { name: "description", content: "Заполнение реквизитов и выгрузка договора купли-продажи в Word" },
      { property: "og:title", content: "Договор купли-продажи — ВЕРОН CRM" },
      { property: "og:description", content: "Заполнение реквизитов и выгрузка договора купли-продажи в Word" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContractPage,
});

type Field = { key: string; label: string; type?: string; placeholder?: string; wide?: boolean };

const SECTIONS: { title: string; fields: Field[] }[] = [
  { title: "Договор", fields: [{ key: "date", label: "Дата договора", type: "date" }] },
  {
    title: "Покупатель",
    fields: [
      { key: "buyer_fio", label: "ФИО", placeholder: "Салмин Степан Александрович", wide: true },
      { key: "passport", label: "Паспорт (серия и номер)", placeholder: "4220 272772" },
      { key: "passport_date", label: "Дата выдачи", type: "date" },
      { key: "passport_by", label: "Кем выдан", placeholder: "УМВД РОССИИ ПО ЛИПЕЦКОЙ ОБЛАСТИ", wide: true },
      { key: "passport_code", label: "Код подразделения", placeholder: "480-022" },
      { key: "buyer_address", label: "Адрес регистрации", placeholder: "Липецкая обл. г. Усмань ул. Октябрьская д.19А", wide: true },
    ],
  },
  {
    title: "Автомобиль",
    fields: [
      { key: "vin", label: "VIN", placeholder: "XW8ZZZ1KZAG500935" },
      { key: "body_number", label: "Номер кузова", placeholder: "XW8ZZZ1KZAG500935" },
      { key: "brand_model", label: "Марка, модель", placeholder: "Volkswagen Jetta" },
      { key: "vehicle_type", label: "Тип ТС", placeholder: "Легковой" },
      { key: "category", label: "Категория", placeholder: "В" },
      { key: "year", label: "Год выпуска", placeholder: "2009" },
      { key: "color", label: "Цвет кузова", placeholder: "черный" },
      { key: "power_hp", label: "Мощность, л.с.", placeholder: "122" },
      { key: "engine_volume", label: "Объём, куб. см", placeholder: "1390" },
      { key: "fuel", label: "Тип двигателя", placeholder: "Бензин" },
      { key: "engine_number", label: "№ двигателя", placeholder: "CAX 303904" },
      { key: "mileage", label: "Пробег, км", placeholder: "282 558" },
      { key: "pts", label: "Паспорт ТС", placeholder: "77 УХ 904923 ВЫДАН 25.02.2023" },
      { key: "plate", label: "Госномер", placeholder: "М068КК136" },
      { key: "sts", label: "СТС", placeholder: "9944 468769" },
      { key: "price", label: "Стоимость, ₽", type: "number", placeholder: "760000" },
    ],
  },
  {
    title: "Продавец",
    fields: [
      { key: "seller_name", label: "Наименование", wide: true },
      { key: "seller_short", label: "Подпись (Фамилия И.О.)" },
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

const DEFAULTS: Record<string, string> = {
  date: new Date().toISOString().slice(0, 10),
  vehicle_type: "Легковой",
  category: "В",
  seller_name: "Индивидуальный предприниматель Солдатов Илья Сергеевич",
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
  const [v, setV] = useState<Record<string, string>>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const set = (k: string, val: string) => setV((s) => ({ ...s, [k]: val }));

  async function generate() {
    const required = ["date", "buyer_fio", "vin", "brand_model", "price"];
    const missing = required.filter((k) => !v[k]?.trim());
    if (missing.length) {
      toast.error("Заполните дату, ФИО покупателя, VIN, марку и стоимость");
      return;
    }
    const price = Number(v["price"]);
    const g = (k: string) => (v[k] ?? "").trim();
    const buyerFull = [
      g("buyer_fio"),
      g("passport") && `паспорт: ${g("passport")}`,
      (g("passport_by") || g("passport_date")) &&
        `выдан ${g("passport_by")} ${dateShort(g("passport_date"))}`.trim(),
      g("passport_code") && `код подразделения ${g("passport_code")}`,
      g("buyer_address") && `адрес: ${g("buyer_address")}`,
    ]
      .filter(Boolean)
      .join(" ");
    const values: Record<string, string> = {
      ...Object.fromEntries(Object.keys(v).map((k) => [k, g(k)])),
      date: dateLong(g("date")),
      buyer_full: buyerFull,
      buyer_short: g("buyer_fio"),
      price_num: formatMoney(price),
      price_words: numberToWords(price),
    };
    setBusy(true);
    try {
      const surname = g("buyer_fio").split(" ")[0] || "покупатель";
      await buildContract(values, `ДКП ${surname} ${dateShort(g("date"))}.docx`);
      toast.success("Договор сформирован");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сформировать договор");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Договор купли-продажи</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Заполните реквизиты — договор и акт приёма-передачи скачаются в Word.
        </p>
      </div>

      {SECTIONS.map((s) => (
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
