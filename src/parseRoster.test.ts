import { describe, expect, it } from "vitest";
import { parseRosterLines } from "./parseRoster.ts";

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
      { name: "Avery Chen", gender: "F" },
      { name: "Jordan Patel", gender: "M" },
      { name: "Chen, Avery", gender: "U" },
      { name: "Sam Rivera", gender: "U" },
      { name: "Riley", gender: "M" },
      { name: "Noah Kim", gender: "M" },
      { name: "Maya Thompson", gender: "F" },
      { name: "Ann B", gender: "U" },
    ]);
  });
});
