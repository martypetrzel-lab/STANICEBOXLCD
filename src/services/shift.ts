export type Shift = "A" | "B" | "C";
const rotation: Shift[] = ["C", "A", "B"];
const reference = Date.UTC(2026, 0, 1, 5, 0, 0); // 06:00 Europe/Prague

function pragueParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}
export function shiftAt(date = new Date()) {
  const p = pragueParts(date);
  let localDay = Date.UTC(+p.year, +p.month - 1, +p.day);
  if (+p.hour < 6) localDay -= 86_400_000;
  const days = Math.floor((localDay - Date.UTC(2026, 0, 1)) / 86_400_000);
  const shift = rotation[((days % 3) + 3) % 3];
  const next = rotation[(rotation.indexOf(shift) + 1) % 3];
  const start = new Date(reference + days * 86_400_000);
  const end = new Date(start.getTime() + 86_400_000);
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
