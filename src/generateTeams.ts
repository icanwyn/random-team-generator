export type Gender = "M" | "F" | "U";

export type Skill = 1 | 2 | 3 | 4 | 5;

export type SplitMode = "teams" | "perTeam";

export type Player = {
  id: string;
  name: string;
  gender: Gender;
  period: string;
  skill: Skill | null;
};

export type DrawOptions = {
  gender: boolean;
  skill: boolean;
};

export type SplitPlan =
  | { ok: true; teamCount: number; minSize: number; maxSize: number }
  | { ok: false; error: string };

export function planSplit(playerCount: number, mode: SplitMode, count: number): SplitPlan {
  if (playerCount < 2) {
    return { ok: false, error: "Add at least 2 players." };
  }
  if (!Number.isInteger(count)) {
    return { ok: false, error: "Use a whole number." };
  }

  let teamCount: number;
  if (mode === "teams") {
    if (count < 2) return { ok: false, error: "Enter at least 2 teams." };
    if (count > playerCount) {
      return { ok: false, error: "You can't have more teams than players." };
    }
    teamCount = count;
  } else {
    if (count < 2) {
      return { ok: false, error: "Enter at least 2 players on each team." };
    }
    if (count >= playerCount) {
      return {
        ok: false,
        error: "Players per team has to be smaller than the roster so you get at least 2 teams.",
      };
    }
    teamCount = Math.ceil(playerCount / count);
  }

  return {
    ok: true,
    teamCount,
    minSize: Math.floor(playerCount / teamCount),
    maxSize: Math.ceil(playerCount / teamCount),
  };
}

export function describePlan(playerCount: number, plan: SplitPlan): string {
  if (!plan.ok) return plan.error;
  const teams = plan.teamCount === 1 ? "1 team" : `${plan.teamCount} teams`;
  if (plan.minSize === plan.maxSize) {
    const each = plan.maxSize === 1 ? "1 player" : `${plan.maxSize} players`;
    return `${playerCount} players will be split into ${teams} of ${each}.`;
  }
  return `${playerCount} players will be split into ${teams} of ${plan.maxSize} or ${plan.minSize}.`;
}

export function tally(players: readonly Player[]) {
  let boys = 0;
  let girls = 0;
  let unspecified = 0;
  for (const player of players) {
    if (player.gender === "M") boys += 1;
    else if (player.gender === "F") girls += 1;
    else unspecified += 1;
  }
  return { total: players.length, boys, girls, unspecified };
}

export function genderSummary(players: readonly Player[]): string {
  const counts = tally(players);
  const parts: string[] = [];
  if (counts.boys) parts.push(`${counts.boys} ${counts.boys === 1 ? "boy" : "boys"}`);
  if (counts.girls) parts.push(`${counts.girls} ${counts.girls === 1 ? "girl" : "girls"}`);
  if (counts.unspecified) parts.push(`${counts.unspecified} not specified`);
  return parts.join(", ");
}

export function skillSummary(players: readonly Player[]): string {
  const rated = players.filter((player) => player.skill !== null);
  if (rated.length === 0) return "";
  const average = rated.reduce((sum, player) => sum + (player.skill ?? 0), 0) / rated.length;
  const text = Number.isInteger(average) ? String(average) : average.toFixed(1);
  return `skill avg ${text}`;
}

export function teamSummary(players: readonly Player[]): string {
  return [genderSummary(players), skillSummary(players)].filter(Boolean).join(" · ");
}

export function parseTeamNames(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function groupByPeriod(players: readonly Player[]): { period: string; players: Player[] }[] {
  const buckets = new Map<string, Player[]>();
  for (const player of players) {
    const period = player.period.trim();
    const list = buckets.get(period) ?? [];
    list.push(player);
    buckets.set(period, list);
  }
  return [...buckets.keys()]
    .sort((a, b) => {
      if (a === "") return 1;
      if (b === "") return -1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    })
    .map((period) => ({ period, players: buckets.get(period) ?? [] }));
}

function formatPlayer(player: Player): string {
  const marks: string[] = [];
  if (player.gender !== "U") marks.push(player.gender);
  if (player.skill !== null) marks.push(`skill ${player.skill}`);
  const suffix = marks.length > 0 ? ` (${marks.join(", ")})` : "";
  return `- ${player.name}${suffix}`;
}

export function formatTeams(teams: readonly { name: string; players: readonly Player[] }[]): string {
  return teams
    .map((team) => {
      const lines = team.players.map(formatPlayer);
      return [team.name, ...lines, teamSummary(team.players)].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

export function formatDraw(
  blocks: readonly { period: string; teams: readonly { name: string; players: readonly Player[] }[] }[],
): string {
  return blocks
    .map((block) => {
      const body = formatTeams(block.teams);
      return block.period ? `Period ${block.period}\n\n${body}` : body;
    })
    .filter(Boolean)
    .join("\n\n");
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const next = items.slice();
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(index, Math.floor(random() * (index + 1)));
    const current = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = current;
  }
  return next;
}

function quotas(count: number, teamCount: number, fromEnd: boolean): number[] {
  const base = Math.floor(count / teamCount);
  let extra = count % teamCount;
  const amounts = Array.from({ length: teamCount }, () => base);
  const order = fromEnd
    ? Array.from({ length: teamCount }, (_, index) => teamCount - 1 - index)
    : Array.from({ length: teamCount }, (_, index) => index);
  for (const index of order) {
    if (extra === 0) break;
    amounts[index] += 1;
    extra -= 1;
  }
  return amounts;
}

function sortBySkill(players: readonly Player[], random: () => number): Player[] {
  return shuffle(players, random).sort((a, b) => (b.skill ?? 3) - (a.skill ?? 3));
}

/** Snake visits repeat the end of each pass: 0,1,2,3 then 3,2,1,0. */
function visitTeams(teamCount: number, fromEnd: boolean): () => number {
  let forward = !fromEnd;
  let row = forward
    ? Array.from({ length: teamCount }, (_, index) => index)
    : Array.from({ length: teamCount }, (_, index) => teamCount - 1 - index);
  let cursor = 0;
  return () => {
    const team = row[cursor] ?? 0;
    cursor += 1;
    if (cursor >= row.length) {
      forward = !forward;
      row = forward
        ? Array.from({ length: teamCount }, (_, index) => index)
        : Array.from({ length: teamCount }, (_, index) => teamCount - 1 - index);
      cursor = 0;
    }
    return team;
  };
}

function dealGroup(
  players: readonly Player[],
  teams: Player[][],
  fromEnd: boolean,
  bySkill: boolean,
  random: () => number,
) {
  if (players.length === 0 || teams.length === 0) return;
  const limits = quotas(players.length, teams.length, fromEnd);
  const ordered = bySkill ? sortBySkill(players, random) : shuffle(players, random);
  const filled = Array.from({ length: teams.length }, () => 0);
  const visit = visitTeams(teams.length, fromEnd);
  let placed = 0;
  let guard = 0;
  while (placed < ordered.length && guard < ordered.length * teams.length * 2 + 4) {
    guard += 1;
    const teamIndex = visit();
    if (filled[teamIndex] < limits[teamIndex]) {
      teams[teamIndex].push(ordered[placed]);
      filled[teamIndex] += 1;
      placed += 1;
    }
  }
  if (placed !== ordered.length) {
    throw new Error("Could not place every player.");
  }
}

function skillTotal(players: readonly Player[]): number {
  return players.reduce((sum, player) => sum + (player.skill ?? 3), 0);
}

function placeBySize(players: readonly Player[], teams: Player[][], bySkill: boolean, random: () => number) {
  const ordered = bySkill ? sortBySkill(players, random) : shuffle(players, random);
  let cursor = 0;
  for (const player of ordered) {
    let target = cursor % teams.length;
    for (let step = 1; step < teams.length; step += 1) {
      const index = (cursor + step) % teams.length;
      const smaller = teams[index].length < teams[target].length;
      const sameSize = teams[index].length === teams[target].length;
      const lowerSkill = skillTotal(teams[index]) < skillTotal(teams[target]);
      if (smaller || (bySkill && sameSize && lowerSkill)) target = index;
    }
    teams[target].push(player);
    cursor = target + 1;
  }
}

function byName(a: Player, b: Player) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function drawTeams(
  players: readonly Player[],
  teamCount: number,
  options: DrawOptions,
  random: () => number = Math.random,
): Player[][] {
  if (teamCount < 1 || teamCount > players.length) {
    throw new Error("Team count is out of range.");
  }

  const teams: Player[][] = Array.from({ length: teamCount }, () => []);

  if (!options.gender && !options.skill) {
    shuffle(players, random).forEach((player, index) => {
      teams[index % teamCount].push(player);
    });
  } else if (!options.gender) {
    dealGroup(players, teams, false, true, random);
  } else {
    dealGroup(
      players.filter((player) => player.gender === "M"),
      teams,
      false,
      options.skill,
      random,
    );
    dealGroup(
      players.filter((player) => player.gender === "F"),
      teams,
      true,
      options.skill,
      random,
    );
    placeBySize(
      players.filter((player) => player.gender === "U"),
      teams,
      options.skill,
      random,
    );
  }

  return teams.map((team) => team.slice().sort(byName));
}
