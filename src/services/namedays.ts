const names: Record<string, string> = {
  "01-01":"Nový rok", "05-01":"Svátek práce", "05-08":"Den vítězství", "07-05":"Cyril a Metoděj",
  "07-06":"Mistr Jan Hus", "09-28":"Václav", "10-28":"Den vzniku Československa", "11-17":"Den boje za svobodu",
  "12-24":"Štědrý den", "12-25":"1. svátek vánoční", "12-26":"Štěpán"
};
export function nameday(date = new Date()) {
  const key = new Intl.DateTimeFormat("en-US", { timeZone:"Europe/Prague", month:"2-digit", day:"2-digit" })
    .format(date).replace("/", "-");
  return names[key] ?? "Dnešní jmeniny";
}
