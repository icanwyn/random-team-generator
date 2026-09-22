import { describe, expect, it } from "vitest";
import {
  describePlan,
  drawTeams,
  formatTeams,
  planSplit,
  tally,
  type Player,
} from "./generateTeams.ts";

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makePlayers(counts: { M?: number; F?: number; U?: number }): Player[] {
  const players: Player[] = [];
  (["M", "F", "U"] as const).forEach((gender) => {
    const total = counts[gender] ?? 0;
    for (let index = 0; index < total; index += 1) {
      players.push({ id: `${gender}${index}`, name: `${gender} ${index}`, gender });
    }
  });
  return players;
}

function genderCounts(teams: Player[][], gender: Player["gender"]) {
  return teams.map((team) => team.filter((player) => player.gender === gender).length);
}

describe("planSplit", () => {
  it("turns a roster into even team sizes", () => {
    expect(planSplit(16, "teams", 4)).toEqual({
      ok: true,
      teamCount: 4,
      minSize: 4,
      maxSize: 4,
    });
    expect(planSplit(22, "perTeam", 5)).toEqual({
      ok: true,
      teamCount: 5,
      minSize: 4,
      maxSize: 5,
    });
    expect(describePlan(22, planSplit(22, "perTeam", 5))).toBe(
      "22 players will be split into 5 teams of 5 or 4.",
    );
  });

  it("rejects splits that cannot make two teams", () => {
    expect(planSplit(1, "teams", 2).ok).toBe(false);
    expect(planSplit(10, "teams", 11).ok).toBe(false);
    expect(planSplit(10, "perTeam", 10).ok).toBe(false);
    expect(planSplit(10, "teams", 1).ok).toBe(false);
  });
});

describe("drawTeams", () => {
  it("keeps gender counts and team sizes within one player", () => {
    const cases = [
      { M: 7, F: 5, U: 0, teams: 3 },
      { M: 6, F: 2, U: 0, teams: 4 },
      { M: 5, F: 5, U: 0, teams: 4 },
      { M: 1, F: 8, U: 0, teams: 3 },
      { M: 9, F: 9, U: 2, teams: 5 },
      { M: 4, F: 0, U: 3, teams: 3 },
      { M: 0, F: 0, U: 11, teams: 3 },
      { M: 3, F: 3, U: 0, teams: 6 },
    ];

    for (const spec of cases) {
      const players = makePlayers(spec);
      for (let seed = 1; seed <= 20; seed += 1) {
        const teams = drawTeams(players, spec.teams, true, rng(seed));
        const sizes = teams.map((team) => team.length);
        expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
        expect(Math.max(...genderCounts(teams, "M")) - Math.min(...genderCounts(teams, "M"))).toBeLessThanOrEqual(1);
        expect(Math.max(...genderCounts(teams, "F")) - Math.min(...genderCounts(teams, "F"))).toBeLessThanOrEqual(1);
        expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(players.length);
        expect(new Set(teams.flat().map((player) => player.id)).size).toBe(players.length);
        expect(sizes.every((size) => size >= 1)).toBe(true);
      }
    }
  });

  it("offsets boy and girl extras so one team does not absorb both", () => {
    const teams = drawTeams(makePlayers({ M: 6, F: 2 }), 4, true, rng(1));
    expect(teams.map((team) => team.length).every((size) => size === 2)).toBe(true);
    expect(genderCounts(teams, "M").sort()).toEqual([1, 1, 2, 2]);
    expect(genderCounts(teams, "F").sort()).toEqual([0, 0, 1, 1]);
  });

  it("can leave gender uneven when balance is off", () => {
    const players: Player[] = [
      { id: "f1", name: "F1", gender: "F" },
      { id: "f2", name: "F2", gender: "F" },
      { id: "f3", name: "F3", gender: "F" },
      { id: "m1", name: "M1", gender: "M" },
      { id: "f4", name: "F4", gender: "F" },
      { id: "m2", name: "M2", gender: "M" },
    ];
    const identity = () => 0.999999;
    const unbalanced = drawTeams(players, 2, false, identity);
    const girlSpread =
      Math.max(...genderCounts(unbalanced, "F")) - Math.min(...genderCounts(unbalanced, "F"));
    expect(girlSpread).toBe(2);

    const balanced = drawTeams(players, 2, true, identity);
    expect(genderCounts(balanced, "F")).toEqual([2, 2]);
    expect(genderCounts(balanced, "M")).toEqual([1, 1]);
  });

  it("lists names alphabetically and formats a pasteable draw", () => {
    const players: Player[] = [
      { id: "1", name: "Zoe", gender: "F" },
      { id: "2", name: "adam", gender: "M" },
    ];
    const teams = drawTeams(players, 2, true, rng(2));
    const named = teams.map((group, index) => ({ name: `Team ${index + 1}`, players: group }));
    expect(teams.map((team) => team.map((player) => player.name))).toEqual([["adam"], ["Zoe"]]);
    expect(formatTeams(named)).toBe("Team 1\n- adam (M)\n1 boy\n\nTeam 2\n- Zoe (F)\n1 girl");
    expect(tally(players)).toEqual({ total: 2, boys: 1, girls: 1, unspecified: 0 });
  });
});
