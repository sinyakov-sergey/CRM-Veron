import JSZip from "jszip";

const MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];

export function dateLong(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d} ${MONTHS[m - 1]} ${y} г.`;
}

export function dateShort(iso: string) {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : "";
}

const ONES_M = ["","один","два","три","четыре","пять","шесть","семь","восемь","девять"];
const ONES_F = ["","одна","две","три","четыре","пять","шесть","семь","восемь","девять"];
const TEENS = ["десять","одиннадцать","двенадцать","тринадцать","четырнадцать","пятнадцать","шестнадцать","семнадцать","восемнадцать","девятнадцать"];
const TENS = ["","","двадцать","тридцать","сорок","пятьдесят","шестьдесят","семьдесят","восемьдесят","девяносто"];
const HUND = ["","сто","двести","триста","четыреста","пятьсот","шестьсот","семьсот","восемьсот","девятьсот"];

function plural(n: number, f: [string, string, string]) {
  const a = n % 100, b = n % 10;
  if (a >= 11 && a <= 19) return f[2];
  if (b === 1) return f[0];
  if (b >= 2 && b <= 4) return f[1];
  return f[2];
}

function triad(n: number, fem: boolean) {
  const w: (string | undefined)[] = [];
  w.push(HUND[Math.floor(n / 100)]);
  const t = n % 100;
  if (t >= 10 && t < 20) w.push(TEENS[t - 10]);
  else {
    w.push(TENS[Math.floor(t / 10)]);
    w.push((fem ? ONES_F : ONES_M)[t % 10]);
  }
  return w.filter(Boolean).join(" ");
}

export function numberToWords(num: number): string {
  if (!Number.isFinite(num) || num < 0) return "";
  num = Math.floor(num);
  if (num === 0) return "ноль";
  const parts: string[] = [];
  const scales: { fem: boolean; forms: [string, string, string] | null }[] = [
    { fem: false, forms: null },
    { fem: true, forms: ["тысяча", "тысячи", "тысяч"] },
    { fem: false, forms: ["миллион", "миллиона", "миллионов"] },
    { fem: false, forms: ["миллиард", "миллиарда", "миллиардов"] },
  ];
  let i = 0;
  while (num > 0 && i < scales.length) {
    const n = num % 1000;
    if (n) {
      const s = scales[i]!;
      parts.unshift([triad(n, s.fem), s.forms ? plural(n, s.forms) : ""].filter(Boolean).join(" "));
    }
    num = Math.floor(num / 1000);
    i++;
  }
  return parts.join(" ");
}

export function formatMoney(n: number) {
  return Math.floor(n).toLocaleString("ru-RU").replace(/\u00a0|\u202f/g, " ");
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function buildContract(values: Record<string, string>, filename: string) {
  const res = await fetch("/templates/dkp.docx");
  if (!res.ok) throw new Error("Шаблон договора не найден");
  const zip = await JSZip.loadAsync(await res.arrayBuffer());
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("Шаблон повреждён");
  const xml = await file.async("string");
  const out = xml.replace(/\{\{(\w+)\}\}/g, (_, k: string) => esc(values[k] ?? ""));
  zip.file("word/document.xml", out);
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
