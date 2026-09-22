import type { Gender, Skill } from "./generateTeams.ts";

export type RosterEntry = {
  name: string;
  gender: Gender;
  period: string;
  skill: Skill | null;
};

const WORDS: Record<string, Gender> = {
  m: "M",
  male: "M",
  boy: "M",
  boys: "M",
  f: "F",
  female: "F",
  girl: "F",
  girls: "F",
  u: "U",
  unspecified: "U",
  unknown: "U",
  na: "U",
  "n/a": "U",
};

const COLUMN: Record<string, Gender> = {
  ...WORDS,
  b: "M",
  g: "F",
};

const SKILL_WORDS: Record<string, Skill> = {
  beginner: 1,
  developing: 1,
  low: 1,
  weak: 1,
  okay: 3,
  ok: 3,
  average: 3,
  intermediate: 3,
  medium: 3,
  mid: 3,
  advanced: 5,
  strong: 5,
  high: 5,
};

type Columns = {
  name: number;
  gender?: number;
  period?: number;
  skill?: number;
  width: number;
  tabs: boolean;
};

function tokenGender(token: string, allowInitial: boolean): Gender | null {
  const key = token.trim().toLowerCase().replace(/\.$/, "");
  return (allowInitial ? COLUMN : WORDS)[key] ?? null;
}

export function parseSkill(token: string): Skill | null {
  const key = token.trim().toLowerCase().replace(/\.$/, "");
  if (SKILL_WORDS[key]) return SKILL_WORDS[key];
  if (/^[1-5]$/.test(key)) return Number(key) as Skill;
  return null;
}

function cleanName(name: string): string {
  return name.trim().replace(/^["']|["']$/g, "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function isLoneToken(name: string): boolean {
  if (name.includes(" ")) return false;
  return tokenGender(name, true) !== null || parseSkill(name) !== null;
}

function periodHeader(line: string): string | null {
  const named = line.match(/^(?:period|per\.?|pd\.?)\s*[:#-]?\s*(.+)$/i);
  if (named?.[1]) return named[1].trim().slice(0, 20);
  const ordinal = line.match(/^(\d+)(?:st|nd|rd|th)\s+period$/i);
  if (ordinal?.[1]) return ordinal[1];
  const short = line.match(/^p\s*(\d+)$/i);
  if (short?.[1]) return short[1];
  return null;
}

function splitCsv(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function readColumns(cells: string[], tabs: boolean): Columns | null {
  const map: Partial<Columns> = { tabs, width: cells.length };
  cells.forEach((cell, index) => {
    const key = cell.trim().toLowerCase().replace(/[.#]/g, "");
    if (key === "name" || key === "player" || key === "student") map.name = index;
    else if (key === "gender" || key === "sex" || key === "m/f" || key === "boy/girl" || key === "mf") map.gender = index;
    else if (key === "period" || key === "per" || key === "pd" || key === "class" || key === "class period") {
      map.period = index;
    } else if (key === "skill" || key === "skills" || key === "level" || key === "rating" || key === "ability") {
      map.skill = index;
    }
  });
  if (map.name === undefined) return null;
  if (map.gender === undefined && map.period === undefined && map.skill === undefined) return null;
  return {
    name: map.name,
    gender: map.gender,
    period: map.period,
    skill: map.skill,
    width: cells.length,
    tabs,
  };
}

function entry(name: string, gender: Gender, period: string, skill: Skill | null): RosterEntry | null {
  const cleaned = cleanName(name);
  if (!cleaned || isLoneToken(cleaned)) return null;
  return { name: cleaned, gender, period: period.trim().slice(0, 20), skill };
}

function fromColumns(cells: string[], columns: Columns, fallbackPeriod: string): RosterEntry | null {
  const genderCell = columns.gender === undefined ? "" : (cells[columns.gender] ?? "");
  const periodCell = columns.period === undefined ? "" : (cells[columns.period] ?? "");
  const skillCell = columns.skill === undefined ? "" : (cells[columns.skill] ?? "");
  return entry(
    cells[columns.name] ?? "",
    tokenGender(genderCell, true) ?? "U",
    periodCell || fallbackPeriod,
    parseSkill(skillCell),
  );
}

function fromFreeform(line: string, period: string): RosterEntry | null {
  if (line.includes("\t")) {
    const cells = line.split("\t").map((cell) => cell.trim());
    if (cells.length >= 2 && cells.length <= 4) {
      const gender = tokenGender(cells[1] ?? "", true);
      if (cells.length === 2 && gender) return entry(cells[0] ?? "", gender, period, null);
      if (cells.length === 2 && parseSkill(cells[1] ?? "")) {
        return entry(cells[0] ?? "", "U", period, parseSkill(cells[1] ?? ""));
      }
      if (cells.length === 3) {
        return entry(cells[0] ?? "", gender ?? "U", period, parseSkill(cells[2] ?? ""));
      }
      if (cells.length === 4) {
        return entry(cells[0] ?? "", gender ?? "U", cells[2] || period, parseSkill(cells[3] ?? ""));
      }
    }
  }

  const cells = splitCsv(line);
  const last = cells[cells.length - 1] ?? "";
  if (cells.length >= 2 && (parseSkill(last) || tokenGender(last, true))) {
    const rest = cells.slice();
    let skill: Skill | null = null;
    let gender: Gender = "U";
    if (parseSkill(rest[rest.length - 1] ?? "")) {
      skill = parseSkill(rest.pop() ?? "");
    }
    if (rest.length > 1 && tokenGender(rest[rest.length - 1] ?? "", true)) {
      gender = tokenGender(rest.pop() ?? "", true) ?? "U";
    }
    return entry(rest.join(", "), gender, period, skill);
  }

  const parts = line.split(/\s+/);
  let skill: Skill | null = null;
  let gender: Gender = "U";
  if (parts.length > 1 && parseSkill(parts[parts.length - 1] ?? "")) {
    skill = parseSkill(parts.pop() ?? "");
  }
  if (parts.length > 1 && tokenGender(parts[parts.length - 1] ?? "", false)) {
    gender = tokenGender(parts.pop() ?? "", false) ?? "U";
  }
  return entry(parts.join(" "), gender, period, skill);
}

export function parseRosterLines(text: string): RosterEntry[] {
  const players: RosterEntry[] = [];
  let period = "";
  let columns: Columns | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const headerPeriod = periodHeader(line);
    if (headerPeriod !== null) {
      period = headerPeriod;
      continue;
    }

    const tabs = line.includes("\t");
    const cells = tabs ? line.split("\t").map((cell) => cell.trim()) : splitCsv(line);
    const header = readColumns(cells, tabs);
    if (header) {
      columns = header;
      continue;
    }

    if (columns && tabs === columns.tabs && cells.length === columns.width) {
      const genderCell = columns.gender === undefined ? "" : (cells[columns.gender] ?? "");
      const skillCell = columns.skill === undefined ? "" : (cells[columns.skill] ?? "");
      const genderOk = genderCell === "" || tokenGender(genderCell, true) !== null;
      const skillOk = skillCell === "" || parseSkill(skillCell) !== null;
      if (genderOk && skillOk) {
        const parsed = fromColumns(cells, columns, period);
        if (parsed) players.push(parsed);
        continue;
      }
    }

    const parsed = fromFreeform(line, period);
    if (parsed) players.push(parsed);
  }

  return players;
}
