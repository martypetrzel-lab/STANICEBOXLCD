const map: Record<string, string> = {
  á:"a", č:"c", ď:"d", é:"e", ě:"e", í:"i", ň:"n", ó:"o", ř:"r", š:"s", ť:"t", ú:"u", ů:"u", ý:"y", ž:"z"
};
export function removeDiacritics(value: string) {
  return [...value].map((c) => map[c] ?? map[c.toLowerCase()]?.toUpperCase() ?? c.normalize("NFD").replace(/[\u0300-\u036f]/g, "")).join("");
}
export function wrapLcd(value: string, width = 20, rows = 4) {
  const words = removeDiacritics(value).trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (let word of words) {
    while (word.length > width) {
      if (line) { lines.push(line); line = ""; }
      lines.push(word.slice(0, width)); word = word.slice(width);
    }
    if (!word) continue;
    if (`${line} ${word}`.trim().length <= width) line = `${line} ${word}`.trim();
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return { lines: lines.slice(0, rows), overflow: lines.slice(rows), scrollText: removeDiacritics(value) };
}
