export function parseCsvToRecipientLines(content: string) {
  const rawLines = content.replace(/\r/g, "").split("\n").map((v) => v.trim()).filter(Boolean);
  if (!rawLines.length) return "";
  const first = rawLines[0].toLowerCase();
  const hasHeader = first.includes("address") || first.includes("amount");
  const lines = hasHeader ? rawLines.slice(1) : rawLines;
  const out: string[] = [];
  for (const line of lines) {
    const parts = line.split(",").map((v) => v.trim()).filter(Boolean);
    if (parts.length >= 2) out.push(`${parts[0]},${parts[1]}`);
    else if (parts.length === 1) out.push(parts[0]);
  }
  return out.join("\n");
}
