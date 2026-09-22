import type { Gender, Skill } from "./generateTeams.ts";

export const SAMPLE_ROSTER: { name: string; gender: Gender; period: string; skill: Skill | null }[] = [
  { name: "Marcus Hale", gender: "M", period: "1", skill: 5 },
  { name: "Diego Alvarez", gender: "M", period: "1", skill: 2 },
  { name: "Jonah Park", gender: "M", period: "1", skill: 4 },
  { name: "Eli Brooks", gender: "M", period: "1", skill: 1 },
  { name: "Priya Shah", gender: "F", period: "1", skill: 4 },
  { name: "Maya Thompson", gender: "F", period: "1", skill: 3 },
  { name: "Elena Ruiz", gender: "F", period: "1", skill: 1 },
  { name: "Sam Rivera", gender: "U", period: "1", skill: null },
  { name: "Andre Walsh", gender: "M", period: "2", skill: 3 },
  { name: "Noah Kim", gender: "M", period: "2", skill: 5 },
  { name: "Lucas Ferreira", gender: "M", period: "2", skill: 2 },
  { name: "Hannah Cho", gender: "F", period: "2", skill: 5 },
  { name: "Sofia Bennett", gender: "F", period: "2", skill: 2 },
  { name: "Grace Okonkwo", gender: "F", period: "2", skill: 4 },
  { name: "Lily Nguyen", gender: "F", period: "2", skill: 1 },
  { name: "Riley Quinn", gender: "U", period: "2", skill: 3 },
];
