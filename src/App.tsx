import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import {
  describePlan,
  drawTeams,
  formatDraw,
  genderSummary,
  groupByPeriod,
  parseTeamNames,
  planSplit,
  skillSummary,
  tally,
  type Gender,
  type Player,
  type Skill,
  type SplitMode,
} from "./generateTeams.ts";
import { parseRosterLines } from "./parseRoster.ts";
import { SAMPLE_ROSTER } from "./sampleRoster.ts";

const STORAGE_KEY = "team-generator-v1";

type PeriodBlock = {
  period: string;
  groups: Player[][];
};

type Draw = {
  id: number;
  periods: PeriodBlock[];
  skipped: string[];
  balancedGender: boolean;
  balancedSkill: boolean;
};

type Persisted = {
  players: Player[];
  mode: SplitMode;
  countText: string;
  balance: boolean;
  balanceSkill: boolean;
  periodChoice: string;
  teamNames: string;
  draw: Draw | null;
};

const GENDER_OPTIONS: { value: Gender; label: string; short: string }[] = [
  { value: "M", label: "Boy", short: "M" },
  { value: "F", label: "Girl", short: "F" },
  { value: "U", label: "Unspecified", short: "—" },
];

function normalizePlayer(value: unknown): Player | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<Player>;
  if (typeof record.id !== "string" || typeof record.name !== "string") return null;
  if (record.gender !== "M" && record.gender !== "F" && record.gender !== "U") return null;
  const skill = record.skill;
  const validSkill = skill === 1 || skill === 2 || skill === 3 || skill === 4 || skill === 5 ? skill : null;
  return {
    id: record.id,
    name: record.name,
    gender: record.gender,
    period: typeof record.period === "string" ? record.period : "",
    skill: validSkill,
  };
}

function readDraw(value: unknown, players: Player[]): Draw | null {
  if (!value || typeof value !== "object") return null;
  const record = value as {
    id?: unknown;
    balanced?: unknown;
    balancedGender?: unknown;
    balancedSkill?: unknown;
    groups?: unknown;
    periods?: unknown;
    skipped?: unknown;
  };
  if (typeof record.id !== "number") return null;
  const byId = new Map(players.map((player) => [player.id, player]));

  const hydrate = (groups: unknown): Player[][] | null => {
    if (!Array.isArray(groups)) return null;
    const next: Player[][] = [];
    for (const group of groups) {
      if (!Array.isArray(group)) return null;
      const team: Player[] = [];
      for (const item of group) {
        const stored = normalizePlayer(item);
        if (!stored) return null;
        const current = byId.get(stored.id);
        if (!current) return null;
        team.push(current);
      }
      next.push(team);
    }
    return next;
  };

  let periods: PeriodBlock[] | null = null;
  if (Array.isArray(record.periods)) {
    periods = [];
    for (const block of record.periods) {
      if (!block || typeof block !== "object") return null;
      const periodValue = (block as { period?: unknown }).period;
      const groups = hydrate((block as { groups?: unknown }).groups);
      if (!groups) return null;
      periods.push({ period: typeof periodValue === "string" ? periodValue : "", groups });
    }
  } else if (record.groups) {
    const groups = hydrate(record.groups);
    if (!groups) return null;
    periods = [{ period: "", groups }];
  }
  if (!periods || periods.length === 0) return null;

  return {
    id: record.id,
    periods,
    skipped: Array.isArray(record.skipped) ? record.skipped.filter((item) => typeof item === "string") : [],
    balancedGender: typeof record.balancedGender === "boolean" ? record.balancedGender : record.balanced !== false,
    balancedSkill: record.balancedSkill === true,
  };
}

function loadState(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Persisted>;
    if (!Array.isArray(data.players)) return null;
    const players = data.players
      .map(normalizePlayer)
      .filter((player): player is Player => player !== null);
    return {
      players,
      mode: data.mode === "perTeam" ? "perTeam" : "teams",
      countText: typeof data.countText === "string" ? data.countText : "4",
      balance: data.balance !== false,
      balanceSkill: data.balanceSkill === true,
      periodChoice: typeof data.periodChoice === "string" ? data.periodChoice : "all",
      teamNames: typeof data.teamNames === "string" ? data.teamNames : "",
      draw: readDraw(data.draw, players),
    };
  } catch {
    return null;
  }
}

function rosterLine(counts: ReturnType<typeof tally>, periods: number): string {
  const parts = [`${counts.total} ${counts.total === 1 ? "player" : "players"}`];
  if (periods > 1) parts.push(`${periods} periods`);
  if (counts.boys) parts.push(`${counts.boys} ${counts.boys === 1 ? "boy" : "boys"}`);
  if (counts.girls) parts.push(`${counts.girls} ${counts.girls === 1 ? "girl" : "girls"}`);
  if (counts.unspecified) parts.push(`${counts.unspecified} not specified`);
  return parts.join(" · ");
}

function addedMessage(count: number, periods: number, replaced: boolean): string {
  const verb = replaced ? "Loaded" : "Added";
  const people = `${count} ${count === 1 ? "player" : "players"}`;
  if (periods > 1) return `${verb} ${people} across ${periods} periods.`;
  return `${verb} ${people}.`;
}

function resultNote(draw: Draw): string {
  const players = draw.periods.flatMap((block) => block.groups.flat());
  const counts = tally(players);
  const parts: string[] = [];
  if (draw.periods.length > 1) parts.push("Each period was drawn on its own.");
  if (!draw.balancedGender) parts.push("Shuffled without balancing gender.");
  else if (counts.boys === 0 || counts.girls === 0) parts.push("Mark both boys and girls if you want the mix balanced.");
  else parts.push("Boys and girls are spread across the teams.");
  if (draw.balancedSkill) {
    parts.push(
      players.some((player) => player.skill !== null)
        ? "Skills were snaked so the team totals stay close."
        : "No skill ratings were set, so skill balance did not change the draw.",
    );
  }
  if (draw.skipped.length > 0) parts.push(draw.skipped.join(" "));
  parts.push("Names on a team are listed A to Z.");
  return parts.join(" ");
}

function sizeNote(groups: Player[][]): string {
  const sizes = groups.map((group) => group.length);
  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  const teams = groups.length === 1 ? "1 team" : `${groups.length} teams`;
  if (min === max) return `${teams} of ${max}.`;
  return `${teams} of ${max} or ${min}.`;
}

function asSkill(value: string): Skill | null {
  const number = Number(value);
  if (number === 1 || number === 2 || number === 3 || number === 4 || number === 5) return number;
  return null;
}

function GenderField({
  value,
  onChange,
  legend,
  compact = false,
}: {
  value: Gender;
  onChange: (gender: Gender) => void;
  legend: string;
  compact?: boolean;
}) {
  const group = useId();
  return (
    <div className={compact ? "choices compact" : "choices"} role="radiogroup" aria-label={legend}>
      {GENDER_OPTIONS.map((option) => (
        <label key={option.value} className={value === option.value ? "choice on" : "choice"}>
          <input
            type="radio"
            name={group}
            value={option.value}
            checked={value === option.value}
            aria-label={option.label}
            onChange={() => onChange(option.value)}
          />
          <span aria-hidden="true">{compact ? option.short : option.label}</span>
        </label>
      ))}
    </div>
  );
}

function SkillSelect({
  value,
  onChange,
  label,
  compact = false,
}: {
  value: Skill | null;
  onChange: (skill: Skill | null) => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <select
      className={compact ? "text-input skill-select compact" : "text-input skill-select"}
      aria-label={label}
      value={value ?? ""}
      onChange={(event) => onChange(asSkill(event.target.value))}
    >
      <option value="">{compact ? "—" : "Skill"}</option>
      <option value="1">1</option>
      <option value="2">2</option>
      <option value="3">3</option>
      <option value="4">4</option>
      <option value="5">5</option>
    </select>
  );
}

export default function App() {
  const saved = useRef(loadState());
  const [players, setPlayers] = useState<Player[]>(saved.current?.players ?? []);
  const [mode, setMode] = useState<SplitMode>(saved.current?.mode ?? "teams");
  const [countText, setCountText] = useState(saved.current?.countText ?? "4");
  const [balance, setBalance] = useState(saved.current?.balance ?? true);
  const [balanceSkill, setBalanceSkill] = useState(saved.current?.balanceSkill ?? false);
  const [periodChoice, setPeriodChoice] = useState(saved.current?.periodChoice ?? "all");
  const [teamNames, setTeamNames] = useState(saved.current?.teamNames ?? "");
  const [nameInput, setNameInput] = useState("");
  const [gender, setGender] = useState<Gender>("U");
  const [periodInput, setPeriodInput] = useState("");
  const [skillInput, setSkillInput] = useState<Skill | null>(null);
  const [paste, setPaste] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState("");
  const manualCopyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [draw, setDraw] = useState<Draw | null>(saved.current?.draw ?? null);
  const nameRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const skipFirstScroll = useRef(true);

  useEffect(() => {
    const payload: Persisted = {
      players,
      mode,
      countText,
      balance,
      balanceSkill,
      periodChoice,
      teamNames,
      draw,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [players, mode, countText, balance, balanceSkill, periodChoice, teamNames, draw]);

  useEffect(() => {
    if (skipFirstScroll.current) {
      skipFirstScroll.current = false;
      return;
    }
    if (!draw) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [draw]);

  useEffect(() => {
    if (!manualCopy) return;
    manualCopyRef.current?.focus();
    manualCopyRef.current?.select();
  }, [manualCopy]);

  const groups = useMemo(() => groupByPeriod(players), [players]);
  const hasPeriods = groups.some((group) => group.period !== "");
  const activePeriod =
    periodChoice === "all" || groups.some((group) => group.period === periodChoice) ? periodChoice : "all";
  const drawGroups = useMemo(() => {
    if (!hasPeriods || activePeriod === "all") return groups;
    return groups.filter((group) => group.period === activePeriod);
  }, [groups, hasPeriods, activePeriod]);

  const rosterCounts = useMemo(() => tally(players), [players]);
  const activePlayers = useMemo(() => drawGroups.flatMap((group) => group.players), [drawGroups]);
  const activeCounts = useMemo(() => tally(activePlayers), [activePlayers]);

  const selection = useMemo(() => {
    if (players.length === 0) return { ok: false, text: "Add at least 2 players." };
    if (countText.trim() === "") return { ok: false, text: "Enter a number." };
    const count = Number(countText);
    if (drawGroups.length === 1 && !hasPeriods) {
      const plan = planSplit(drawGroups[0].players.length, mode, count);
      return { ok: plan.ok, text: describePlan(drawGroups[0].players.length, plan) };
    }
    const lines = drawGroups.map((group) => {
      const label = group.period ? `Period ${group.period}` : "No period";
      const plan = planSplit(group.players.length, mode, count);
      return plan.ok ? `${label}: ${describePlan(group.players.length, plan)}` : `${label}: ${plan.error}`;
    });
    const ok = drawGroups.some((group) => planSplit(group.players.length, mode, count).ok);
    const lead = drawGroups.length > 1 ? "Each period is drawn on its own." : "";
    return { ok, text: [lead, ...lines].filter(Boolean).join("\n") };
  }, [players.length, countText, drawGroups, hasPeriods, mode]);

  const names = useMemo(() => parseTeamNames(teamNames), [teamNames]);
  const namedBlocks = draw
    ? draw.periods.map((block) => ({
        period: block.period,
        teams: block.groups.map((group, index) => ({
          name: names[index] || `Team ${index + 1}`,
          players: group,
        })),
      }))
    : [];

  function changeRoster(next: Player[]) {
    setPlayers(next);
    setDraw(null);
    setCopied(false);
    setManualCopy("");
  }

  function updatePlayer(id: string, patch: Partial<Player>) {
    changeRoster(players.map((player) => (player.id === id ? { ...player, ...patch } : player)));
  }

  function addPlayer(event: FormEvent) {
    event.preventDefault();
    const name = nameInput.trim().replace(/\s+/g, " ");
    if (!name) {
      setNote("Enter a name.");
      return;
    }
    changeRoster([
      ...players,
      {
        id: crypto.randomUUID(),
        name: name.slice(0, 80),
        gender,
        period: periodInput.trim().slice(0, 20),
        skill: skillInput,
      },
    ]);
    setNameInput("");
    setNote("");
    nameRef.current?.focus();
  }

  function addPasted() {
    const parsed = parseRosterLines(paste);
    if (parsed.length === 0) {
      setNote("No players found. Put one player on each line, with a Period heading between classes.");
      return;
    }
    const periods = new Set(parsed.map((player) => player.period).filter(Boolean));
    changeRoster([...players, ...parsed.map((player) => ({ ...player, id: crypto.randomUUID() }))]);
    setPaste("");
    setNote(addedMessage(parsed.length, periods.size, false));
  }

  async function loadFile(file: File) {
    const text = await file.text();
    const parsed = parseRosterLines(text);
    if (parsed.length === 0) {
      setNote("No players found in that file.");
      return;
    }
    const periods = new Set(parsed.map((player) => player.period).filter(Boolean));
    changeRoster(parsed.map((player) => ({ ...player, id: crypto.randomUUID() })));
    setPeriodChoice("all");
    setNote(addedMessage(parsed.length, periods.size, true));
  }

  function loadSample() {
    changeRoster(SAMPLE_ROSTER.map((player) => ({ ...player, id: crypto.randomUUID() })));
    setPeriodChoice("all");
    setNote("Sample class loaded, with period 1 and period 2 plus skill ratings.");
  }

  function drawNow() {
    if (!selection.ok || countText.trim() === "") return;
    const count = Number(countText);
    const blocks: PeriodBlock[] = [];
    const skipped: string[] = [];
    for (const group of drawGroups) {
      const plan = planSplit(group.players.length, mode, count);
      const label = group.period ? `Period ${group.period}` : "This roster";
      if (!plan.ok) {
        if (drawGroups.length > 1) skipped.push(`${label} was skipped. ${plan.error}`);
        continue;
      }
      blocks.push({
        period: group.period,
        groups: drawTeams(group.players, plan.teamCount, { gender: balance, skill: balanceSkill }),
      });
    }
    if (blocks.length === 0) return;
    setDraw({
      id: (draw?.id ?? 0) + 1,
      periods: blocks,
      skipped,
      balancedGender: balance,
      balancedSkill: balanceSkill,
    });
    setCopied(false);
    setManualCopy("");
    setNote("");
  }

  async function copyTeams() {
    const text = formatDraw(namedBlocks);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setManualCopy("");
      return;
    } catch {
      // Some school browsers block the clipboard API. The box below is the fallback.
    }
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.focus();
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (ok) {
        setCopied(true);
        setManualCopy("");
        return;
      }
    } catch {
      // Show the text for a manual copy.
    }
    setCopied(false);
    setManualCopy(text);
  }

  const genderHint =
    activeCounts.boys === 0 && activeCounts.girls === 0
      ? "No one is marked boy or girl yet, so this stays a plain shuffle."
      : activeCounts.boys === 0 || activeCounts.girls === 0
        ? "Add both boys and girls for the mix to change. Team sizes still come out even."
        : "Each team gets as close to the same number of boys and the same number of girls as the period allows.";

  const skillHint = activePlayers.some((player) => player.skill !== null)
    ? "Higher and lower skills are snaked onto every team. 1 is developing, 5 is advanced."
    : "Add a skill from 1 to 5 for this to change the draw.";

  const drawLabel = draw
    ? "Draw again"
    : hasPeriods && activePeriod === "all" && drawGroups.length > 1
      ? "Draw every period"
      : "Draw teams";

  return (
    <>
      <header className="hero">
        <div className="hero-inner">
          <p className="kicker">For coaches and teachers</p>
          <div className="hero-title">
            <svg className="mark" viewBox="0 0 48 48" aria-hidden="true">
              <rect width="48" height="48" rx="12" fill="#1d5c49" />
              <circle cx="16" cy="18" r="4" fill="#f4f7f2" />
              <circle cx="32" cy="18" r="4" fill="#f6d7a8" />
              <circle cx="16" cy="32" r="4" fill="#f6d7a8" />
              <circle cx="32" cy="32" r="4" fill="#f4f7f2" />
            </svg>
            <h1>Team Generator</h1>
          </div>
          <p className="lede">
            Load a whole class roster separated by period. Draw teams for one period or every period,
            and balance boys and girls or skill so the sides come out even.
          </p>
          <p className="privacy">Rosters stay in this browser. Nothing is sent to a server.</p>
        </div>
      </header>

      <main className="wrap">
        <div className="layout">
          <section className="panel no-print" aria-labelledby="roster-heading">
            <h2 id="roster-heading" className="section-title">
              Roster
            </h2>
            <p className="section-help">Add players, paste a list, or load a roster file for every period.</p>
            {note ? (
              <p className="note" role="status">
                {note}
              </p>
            ) : null}

            <form onSubmit={addPlayer}>
              <div className="add-form">
                <label className="grow">
                  <span className="label">Name</span>
                  <input
                    ref={nameRef}
                    className="text-input"
                    value={nameInput}
                    onChange={(event) => setNameInput(event.target.value)}
                    placeholder="Alex Rivera"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Player name"
                  />
                </label>
                <label>
                  <span className="label">Period</span>
                  <input
                    className="text-input period-input"
                    value={periodInput}
                    onChange={(event) => setPeriodInput(event.target.value.slice(0, 20))}
                    placeholder="1"
                    aria-label="Period"
                    spellCheck={false}
                  />
                </label>
                <label>
                  <span className="label">Skill</span>
                  <SkillSelect value={skillInput} onChange={setSkillInput} label="Skill for the new player" />
                </label>
              </div>
              <div className="add-row">
                <GenderField value={gender} onChange={setGender} legend="Gender for the new player" />
                <button className="primary add-button" type="submit" data-testid="add-player">
                  Add
                </button>
              </div>
            </form>

            <label className="paste-label" htmlFor="paste-roster">
              Paste a whole class
            </label>
            <textarea
              id="paste-roster"
              className="paste"
              data-testid="paste-roster"
              value={paste}
              onChange={(event) => setPaste(event.target.value)}
              spellCheck={false}
              placeholder={"Period 1\nAvery Chen F 4\nJordan Patel, M, 2\n\nPeriod 2\nSam Rivera 3"}
            />
            <div className="row-actions">
              <button type="button" className="ghost" data-testid="paste-add" onClick={addPasted}>
                Add pasted players
              </button>
              <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
                {players.length === 0 ? "Load roster file" : "Replace from file"}
              </button>
              <input
                ref={fileRef}
                className="file-input"
                type="file"
                accept=".csv,.txt,.tsv,text/csv,text/plain"
                data-testid="roster-file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void loadFile(file);
                  event.target.value = "";
                }}
              />
              {players.length === 0 ? (
                <button type="button" className="ghost" data-testid="sample" onClick={loadSample}>
                  Load a sample class
                </button>
              ) : (
                <button type="button" className="ghost" onClick={() => changeRoster([])}>
                  Clear roster
                </button>
              )}
            </div>

            <p className="roster-summary" data-testid="roster-summary">
              {rosterLine(rosterCounts, groups.filter((group) => group.period).length)}
            </p>
            {players.length === 0 ? (
              <p className="empty">
                Players you add will show up here. A file can be a spreadsheet with Name, Gender, Period, and Skill
                columns, or a list with a Period heading before each class.
              </p>
            ) : (
              <div className="player-list">
                {groups.map((group) => (
                  <div key={group.period || "none"}>
                    {hasPeriods ? (
                      <h3 className="period-label">
                        {group.period ? `Period ${group.period}` : "No period"} · {group.players.length}
                      </h3>
                    ) : null}
                    <ul>
                      {group.players.map((player) => (
                        <li key={player.id} className="player" data-testid="player-row">
                          <span className="player-name">{player.name}</span>
                          {hasPeriods ? (
                            <input
                              className="text-input period-edit"
                              aria-label={`Period for ${player.name}`}
                              value={player.period}
                              onChange={(event) => updatePlayer(player.id, { period: event.target.value.slice(0, 20) })}
                            />
                          ) : null}
                          <SkillSelect
                            compact
                            value={player.skill}
                            label={`Skill for ${player.name}`}
                            onChange={(skill) => updatePlayer(player.id, { skill })}
                          />
                          <GenderField
                            compact
                            value={player.gender}
                            legend={`Gender for ${player.name}`}
                            onChange={(next) => updatePlayer(player.id, { gender: next })}
                          />
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => changeRoster(players.filter((item) => item.id !== player.id))}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel no-print" aria-labelledby="draw-heading">
            <h2 id="draw-heading" className="section-title">
              Draw
            </h2>
            <p className="section-help">Everyone in the period is placed. Team sizes stay within one player.</p>

            {hasPeriods ? (
              <div className="chips" role="radiogroup" aria-label="Which period to draw">
                <button
                  type="button"
                  className={activePeriod === "all" ? "chip on" : "chip"}
                  data-testid="period-chip"
                  aria-pressed={activePeriod === "all"}
                  onClick={() => setPeriodChoice("all")}
                >
                  All periods
                </button>
                {groups.map((group) => (
                  <button
                    key={group.period || "none"}
                    type="button"
                    className={activePeriod === group.period ? "chip on" : "chip"}
                    data-testid="period-chip"
                    aria-pressed={activePeriod === group.period}
                    onClick={() => setPeriodChoice(group.period)}
                  >
                    {group.period ? `Period ${group.period}` : "No period"} ({group.players.length})
                  </button>
                ))}
              </div>
            ) : null}

            <div className="modes" role="radiogroup" aria-label="How to split the roster">
              <label className={mode === "teams" ? "mode on" : "mode"}>
                <input
                  type="radio"
                  name="split-mode"
                  value="teams"
                  checked={mode === "teams"}
                  onChange={() => setMode("teams")}
                />
                Number of teams
              </label>
              <label className={mode === "perTeam" ? "mode on" : "mode"}>
                <input
                  type="radio"
                  name="split-mode"
                  value="perTeam"
                  checked={mode === "perTeam"}
                  onChange={() => setMode("perTeam")}
                />
                Players on each team
              </label>
            </div>

            <label className="number-row">
              <span className="label">{mode === "teams" ? "Teams" : "Players per team"}</span>
              <input
                className="text-input number-input"
                inputMode="numeric"
                value={countText}
                data-testid="count"
                aria-label={mode === "teams" ? "Number of teams" : "Players on each team"}
                onChange={(event) => setCountText(event.target.value.replace(/[^\d]/g, "").slice(0, 4))}
              />
            </label>

            <p className={selection.ok ? "plan" : "plan bad"} data-testid="plan" role={selection.ok ? undefined : "alert"}>
              {selection.text}
            </p>

            <label className="check">
              <input
                type="checkbox"
                checked={balance}
                data-testid="balance"
                onChange={(event) => setBalance(event.target.checked)}
              />
              <span>
                <strong>Balance boys and girls</strong>
                <small>{genderHint}</small>
              </span>
            </label>

            <label className="check">
              <input
                type="checkbox"
                checked={balanceSkill}
                data-testid="skill-balance"
                onChange={(event) => setBalanceSkill(event.target.checked)}
              />
              <span>
                <strong>Balance skills</strong>
                <small>{skillHint}</small>
              </span>
            </label>

            <label className="paste-label" htmlFor="team-names">
              Team names, optional
            </label>
            <input
              id="team-names"
              className="text-input"
              value={teamNames}
              onChange={(event) => setTeamNames(event.target.value)}
              placeholder="Red, Blue, Green, Gold"
              spellCheck={false}
            />
            <p className="hint">Separate names with commas or new lines. The same names are used in every period.</p>

            <button
              type="button"
              className="primary draw-button"
              data-testid="draw"
              disabled={!selection.ok}
              onClick={drawNow}
            >
              {drawLabel}
            </button>
          </section>
        </div>

        <section className="results" ref={resultsRef} aria-live="polite">
          <div className="results-head">
            <div>
              <h2 className="section-title">Teams</h2>
              {draw ? (
                <p className="section-help" data-testid="result-note">
                  {resultNote(draw)}
                </p>
              ) : (
                <p className="section-help">Your draw will show up here.</p>
              )}
            </div>
            {draw ? (
              <div className="toolbar no-print">
                <button type="button" className="ghost" data-testid="copy" onClick={copyTeams}>
                  {copied ? "Copied" : "Copy teams"}
                </button>
                <button type="button" className="ghost" onClick={() => window.print()}>
                  Print
                </button>
              </div>
            ) : null}
          </div>
          {manualCopy ? (
            <label className="manual-copy no-print">
              This browser blocked automatic copy. The teams are selected below.
              <textarea ref={manualCopyRef} readOnly value={manualCopy} data-testid="manual-copy" />
            </label>
          ) : null}

          {namedBlocks.map((block) => (
            <div key={block.period || "roster"} className="period-block" data-testid="period-result">
              {block.period ? <h3 className="period-result-title">Period {block.period}</h3> : null}
              <p className="section-help">{sizeNote(block.teams.map((team) => team.players))}</p>
              <div className="team-grid">
                {block.teams.map((team, index) => (
                  <article key={`${draw?.id}-${block.period}-${index}`} className="team-card" data-testid="team-card">
                    <h3>{team.name}</h3>
                    <p className="team-meta" data-testid="team-summary">
                      {[genderSummary(team.players), skillSummary(team.players)].filter(Boolean).join(" · ")}
                    </p>
                    <ol>
                      {team.players.map((player) => (
                        <li key={player.id} className="person">
                          <span>{player.name}</span>
                          <span className="marks">
                            {player.gender === "U" ? null : (
                              <span className={player.gender === "M" ? "tag m" : "tag f"}>{player.gender}</span>
                            )}
                            {player.skill !== null ? <span className="tag skill">{player.skill}</span> : null}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
