import type { Gender } from "./generateTeams.ts";

const WORDS: Record<string, Gender> = {
  m: "M",
  male: "M",
  boy: "M",
  boys: "M",
  f: "F",
  female: "F",
  girl: "F",
  girls: "F",
};

const COLUMN: Record<string, Gender> = {
  ...WORDS,
  b: "M",
  g: "F",
};

function tokenGender(token: string, allowInitial: boolean): Gender | null {
  const key = token.trim().toLowerCase().replace(/\.$/, "");
  return (allowInitial ? COLUMN : WORDS)[key] ?? null;
}

function cleanName(name: string): string {
  return name.trim().replace(/^["']|["']$/g, "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function isHeader(line: string): boolean {
  return /^(name|player|student)(\s*,\s*|\t)\s*(gender|sex|m\/f|boy\/girl)?$/i.test(line);
}

export function parseRosterLines(text: string): { name: string; gender: Gender }[] {
  const players: { name: string; gender: Gender }[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || isHeader(line)) continue;

    let name = line;
    let gender: Gender = "U";

    if (line.includes("\t")) {
      const [first, second = ""] = line.split("\t");
      const parsed = tokenGender(second, true);
      name = first;
      if (parsed) gender = parsed;
    } else {
      const comma = line.lastIndexOf(",");
      if (comma !== -1) {
        const parsed = tokenGender(line.slice(comma + 1), true);
        if (parsed) {
          name = line.slice(0, comma);
          gender = parsed;
        }
      } else {
        const parts = line.split(/\s+/);
        const last = parts[parts.length - 1] ?? "";
        const parsed = tokenGender(last, false);
        if (parsed && parts.length > 1) {
          name = parts.slice(0, -1).join(" ");
          gender = parsed;
        }
      }
    }

    const cleaned = cleanName(name);
    if (!cleaned) continue;
    if (!cleaned.includes(" ") && tokenGender(cleaned, true)) continue;
    players.push({ name: cleaned, gender });
  }

  return players;
}
