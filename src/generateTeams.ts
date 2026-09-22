export type Gender = "M" | "F" | "U";

export type SplitMode = "teams" | "perTeam";

export type Player = {
  id: string;
  name: string;
  gender: Gender;
};

export type SplitPlan =
  | { ok: true; teamCount: number; minSize: number; maxSize: number }
  | { ok: false; error: string };

export function planSplit(
  playerCount: number,
  mode: SplitMode,
  count: number,
): SplitPlan {
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
  if (counts.unspecified) {
    parts.push(`${counts.unspecified} not specified`);
  }
  return parts.join(", ");
}

export function parseTeamNames(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatTeams(
  teams: readonly { name: string; players: readonly Player[] }[],
): string {
  return teams
    .map((team) => {
      const lines = team.players.map((player) => {
        const mark = player.gender === "U" ? "" : ` (${player.gender})`;
        return `- ${player.name}${mark}`;
      });
      return [team.name, ...lines, genderSummary(team.players)].filter(Boolean).join("\n");
    })
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

/** Extras go to the front, or the back, so two groups don't stack their remainders on the same team. */
function placeEvenly(players: Player[], teams: Player[][], fromEnd: boolean) {
  const teamCount = teams.length;
  if (players.length === 0 || teamCount === 0) return;
  const base = Math.floor(players.length / teamCount);
  let extra = players.length % teamCount;
  let cursor = 0;
  const order = fromEnd
    ? Array.from({ length: teamCount }, (_, index) => teamCount - 1 - index)
    : Array.from({ length: teamCount }, (_, index) => index);

  for (const teamIndex of order) {
    const take = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    for (let step = 0; step < take; step += 1) {
      teams[teamIndex].push(players[cursor]);
      cursor += 1;
    }
  }
}

function placeBySize(players: Player[], teams: Player[][]) {
  let cursor = 0;
  for (const player of players) {
    let target = cursor % teams.length;
    for (let step = 1; step < teams.length; step += 1) {
      const index = (cursor + step) % teams.length;
      if (teams[index].length < teams[target].length) target = index;
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
  balance: boolean,
  random: () => number = Math.random,
): Player[][] {
  if (teamCount < 1 || teamCount > players.length) {
    throw new Error("Team count is out of range.");
  }

  const teams: Player[][] = Array.from({ length: teamCount }, () => []);

  if (!balance) {
    shuffle(players, random).forEach((player, index) => {
      teams[index % teamCount].push(player);
    });
  } else {
    placeEvenly(shuffle(players.filter((player) => player.gender === "M"), random), teams, false);
    placeEvenly(shuffle(players.filter((player) => player.gender === "F"), random), teams, true);
    placeBySize(shuffle(players.filter((player) => player.gender === "U"), random), teams);
  }

  return teams.map((team) => team.slice().sort(byName));
}
