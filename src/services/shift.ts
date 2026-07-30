export type Shift = "A" | "B" | "C";
const rotation: Shift[] = ["C", "A", "B"];
function pragueParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
    minute: "2-digit", second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** Převede jednoznačný pražský místní čas na UTC, včetně letního času. */
function pragueDate(year: number, month: number, day: number, hour = 6) {
  const wanted = Date.UTC(year, month - 1, day, hour, 0, 0);
  let result = wanted;
  for (let i = 0; i < 2; i++) {
    const p = pragueParts(new Date(result));
    const represented = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    result += wanted - represented;
  }
  return new Date(result);
}

export function shiftAt(date = new Date()) {
  const p = pragueParts(date);
  let localDay = Date.UTC(+p.year, +p.month - 1, +p.day);
  if (+p.hour < 6) localDay -= 86_400_000;
  const days = Math.floor((localDay - Date.UTC(2026, 0, 1)) / 86_400_000);
  const shift = rotation[((days % 3) + 3) % 3];
  const next = rotation[(rotation.indexOf(shift) + 1) % 3];
  const serviceDate = new Date(localDay);
  const nextDate = new Date(localDay + 86_400_000);
  const start = pragueDate(serviceDate.getUTCFullYear(), serviceDate.getUTCMonth() + 1, serviceDate.getUTCDate());
  const end = pragueDate(nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1, nextDate.getUTCDate());
  return { shift, next, start, end, remainingSeconds: Math.max(0, Math.floor((end.getTime() - date.getTime()) / 1000)) };
}
export function yearStatistics(year: number, now = new Date()) {
  const counts = { A: 0, B: 0, C: 0 };
  const days: { date: string; shift: Shift }[] = [];
  for (let d = new Date(Date.UTC(year, 0, 1, 12)); d.getUTCFullYear() === year; d.setUTCDate(d.getUTCDate() + 1)) {
    const item = { date: d.toISOString().slice(0, 10), shift: shiftAt(new Date(d)).shift };
    counts[item.shift]++; days.push(item);
  }
  const today = now.toISOString().slice(0, 10);
  return { counts, completed: days.filter((d) => d.date < today).length, remaining: days.filter((d) => d.date >= today).length, days };
}
