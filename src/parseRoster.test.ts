import { describe, expect, it } from "vitest";
import { parseRosterLines } from "./parseRoster.ts";

const blank = { period: "", skill: null };

describe("parseRosterLines", () => {
  it("reads names with M/F from lines, commas, and spreadsheet columns", () => {
    const parsed = parseRosterLines(`
      Name, Gender
      Avery Chen F
      Jordan Patel, M
      Chen, Avery
      Sam Rivera
      Riley boy
      "Noah Kim", male
      Maya Thompson\tF
      Ann B
      male
      # comment
    `);

    expect(parsed).toEqual([
      { name: "Avery Chen", gender: "F", ...blank },
      { name: "Jordan Patel", gender: "M", ...blank },
      { name: "Chen, Avery", gender: "U", ...blank },
      { name: "Sam Rivera", gender: "U", ...blank },
      { name: "Riley", gender: "M", ...blank },
      { name: "Noah Kim", gender: "M", ...blank },
      { name: "Maya Thompson", gender: "F", ...blank },
      { name: "Ann B", gender: "U", ...blank },
    ]);
  });

  it("reads a whole class separated by period, with skills", () => {
    const parsed = parseRosterLines(`
      Period 1
      Avery Chen F 4
      Jordan Patel, M, 2
      Sam Rivera

      2nd period
      Riley Quinn 3
      Chen, Avery

      Period 3
      Name,Gender,Period,Skill
      Maya Thompson,F,3,5
      Sam Rivera,U,3,2
      "Cruz, Ana",G,3,advanced
      Noah Kim\tM\t3\t1
    `);

    expect(parsed).toEqual([
      { name: "Avery Chen", gender: "F", period: "1", skill: 4 },
      { name: "Jordan Patel", gender: "M", period: "1", skill: 2 },
      { name: "Sam Rivera", gender: "U", period: "1", skill: null },
      { name: "Riley Quinn", gender: "U", period: "2", skill: 3 },
      { name: "Chen, Avery", gender: "U", period: "2", skill: null },
      { name: "Maya Thompson", gender: "F", period: "3", skill: 5 },
      { name: "Sam Rivera", gender: "U", period: "3", skill: 2 },
      { name: "Cruz, Ana", gender: "F", period: "3", skill: 10 },
      { name: "Noah Kim", gender: "M", period: "3", skill: 1 },
    ]);
  });

  it("reads first, last, period, gender, and skill from 1 to 10", () => {
    const parsed = parseRosterLines(`
      first,last,period,gender,skill
      Avery,Chen,1,F,8
      Jordan,Patel,1,M,3
      Sam,Rivera,2,,10
      Riley,Quinn,2,girl,1
    `);

    expect(parsed).toEqual([
      { name: "Avery Chen", gender: "F", period: "1", skill: 8 },
      { name: "Jordan Patel", gender: "M", period: "1", skill: 3 },
      { name: "Sam Rivera", gender: "U", period: "2", skill: 10 },
      { name: "Riley Quinn", gender: "F", period: "2", skill: 1 },
    ]);
  });
});
