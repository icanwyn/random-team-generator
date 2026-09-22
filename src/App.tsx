import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import {
  describePlan,
  drawTeams,
  formatTeams,
  genderSummary,
  parseTeamNames,
  planSplit,
  tally,
  type Gender,
  type Player,
  type SplitMode,
} from "./generateTeams.ts";
import { parseRosterLines } from "./parseRoster.ts";
import { SAMPLE_ROSTER } from "./sampleRoster.ts";

const STORAGE_KEY = "team-generator-v1";

type Draw = {
  id: number;
  groups: Player[][];
  balanced: boolean;
};

type Persisted = {
  players: Player[];
  mode: SplitMode;
  countText: string;
  balance: boolean;
  teamNames: string;
  draw: Draw | null;
};

const GENDER_OPTIONS: { value: Gender; label: string; short: string }[] = [
  { value: "M", label: "Boy", short: "M" },
  { value: "F", label: "Girl", short: "F" },
  { value: "U", label: "Unspecified", short: "—" },
];

function isPlayer(value: unknown): value is Player {
  if (!value || typeof value !== "object") return false;
  const player = value as Player;
  return (
    typeof player.id === "string" &&
    typeof player.name === "string" &&
    (player.gender === "M" || player.gender === "F" || player.gender === "U")
  );
}

function readDraw(value: unknown, players: Player[]): Draw | null {
  if (!value || typeof value !== "object") return null;
  const draw = value as Draw;
  if (typeof draw.id !== "number" || typeof draw.balanced !== "boolean" || !Array.isArray(draw.groups)) {
    return null;
  }
  const groups: Player[][] = [];
  for (const group of draw.groups) {
    if (!Array.isArray(group) || !group.every(isPlayer)) return null;
    groups.push(group);
  }
  const placed = groups.flat();
  const ids = new Set(players.map((player) => player.id));
  if (placed.length !== players.length || placed.some((player) => !ids.has(player.id))) return null;
  return { id: draw.id, balanced: draw.balanced, groups };
}

function loadState(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Persisted>;
    if (!Array.isArray(data.players)) return null;
    const players = data.players.filter(isPlayer);
    return {
      players,
      mode: data.mode === "perTeam" ? "perTeam" : "teams",
      countText: typeof data.countText === "string" ? data.countText : "4",
      balance: data.balance !== false,
      teamNames: typeof data.teamNames === "string" ? data.teamNames : "",
      draw: readDraw(data.draw, players),
    };
  } catch {
    return null;
  }
}

function rosterLine(counts: ReturnType<typeof tally>): string {
  const parts = [`${counts.total} ${counts.total === 1 ? "player" : "players"}`];
  if (counts.boys) parts.push(`${counts.boys} ${counts.boys === 1 ? "boy" : "boys"}`);
  if (counts.girls) parts.push(`${counts.girls} ${counts.girls === 1 ? "girl" : "girls"}`);
  if (counts.unspecified) parts.push(`${counts.unspecified} not specified`);
  return parts.join(" · ");
}

function resultNote(draw: Draw): string {
  const counts = tally(draw.groups.flat());
  if (!draw.balanced) return "Shuffled without balancing gender.";
  if (counts.boys === 0 || counts.girls === 0) {
    return "Team sizes are even. Mark both boys and girls if you want the mix balanced.";
  }
  return "Boys and girls are spread as evenly as this roster allows.";
}

function sizeNote(groups: Player[][]): string {
  const sizes = groups.map((group) => group.length);
  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  const teams = groups.length === 1 ? "1 team" : `${groups.length} teams`;
  if (min === max) return `${teams} of ${max}.`;
  return `${teams} of ${max} or ${min}.`;
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

export default function App() {
  const saved = useRef(loadState());
  const [players, setPlayers] = useState<Player[]>(saved.current?.players ?? []);
  const [mode, setMode] = useState<SplitMode>(saved.current?.mode ?? "teams");
  const [countText, setCountText] = useState(saved.current?.countText ?? "4");
  const [balance, setBalance] = useState(saved.current?.balance ?? true);
  const [teamNames, setTeamNames] = useState(saved.current?.teamNames ?? "");
  const [nameInput, setNameInput] = useState("");
  const [gender, setGender] = useState<Gender>("U");
  const [paste, setPaste] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState("");
  const manualCopyRef = useRef<HTMLTextAreaElement>(null);
  const [draw, setDraw] = useState<Draw | null>(saved.current?.draw ?? null);
  const nameRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const skipFirstScroll = useRef(true);

  useEffect(() => {
    const payload: Persisted = { players, mode, countText, balance, teamNames, draw };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [players, mode, countText, balance, teamNames, draw]);

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

  const counts = useMemo(() => tally(players), [players]);
  const plan = useMemo(() => {
    if (countText.trim() === "") return { ok: false as const, error: "Enter a number." };
    return planSplit(players.length, mode, Number(countText));
  }, [players.length, mode, countText]);

  const names = useMemo(() => parseTeamNames(teamNames), [teamNames]);
  const namedTeams = draw
    ? draw.groups.map((group, index) => ({
        name: names[index] || `Team ${index + 1}`,
        players: group,
      }))
    : [];

  function changeRoster(next: Player[]) {
    setPlayers(next);
    setDraw(null);
    setCopied(false);
    setManualCopy("");
  }

  function addPlayer(event: FormEvent) {
    event.preventDefault();
    const name = nameInput.trim().replace(/\s+/g, " ");
    if (!name) {
      setNote("Enter a name.");
      return;
    }
    changeRoster([...players, { id: crypto.randomUUID(), name: name.slice(0, 80), gender }]);
    setNameInput("");
    setNote("");
    nameRef.current?.focus();
  }

  function addPasted() {
    const parsed = parseRosterLines(paste);
    if (parsed.length === 0) {
      setNote("No names found. Put one player on each line.");
      return;
    }
    changeRoster([
      ...players,
      ...parsed.map((player) => ({ ...player, id: crypto.randomUUID() })),
    ]);
    setPaste("");
    setNote(`Added ${parsed.length} ${parsed.length === 1 ? "player" : "players"}.`);
  }

  function loadSample() {
    changeRoster(SAMPLE_ROSTER.map((player) => ({ ...player, id: crypto.randomUUID() })));
    setNote("Sample class loaded. Draw teams, or clear it and paste your own roster.");
  }

  function drawNow() {
    if (!plan.ok) return;
    const groups = drawTeams(players, plan.teamCount, balance);
    setDraw({ id: (draw?.id ?? 0) + 1, groups, balanced: balance });
    setCopied(false);
    setManualCopy("");
    setNote("");
  }

  async function copyTeams() {
    const text = formatTeams(namedTeams);
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

  const balanceHint =
    counts.boys === 0 && counts.girls === 0
      ? "No one is marked boy or girl yet, so this draw stays a plain shuffle."
      : counts.boys === 0 || counts.girls === 0
        ? "Add both boys and girls for the mix to change. Team sizes still come out even."
        : "Each team gets as close to the same number of boys and the same number of girls as the roster allows.";

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
            Paste a roster, choose how many teams or how many players on each team, and draw a
            random split. Balance boys and girls when every team should have a fair mix.
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
            <p className="section-help">Add players one at a time, or paste a class list.</p>
            {note ? (
              <p className="note" role="status">
                {note}
              </p>
            ) : null}

            <form className="add-form" onSubmit={addPlayer}>
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
              <div>
                <span className="label">Gender</span>
                <GenderField value={gender} onChange={setGender} legend="Gender for the new player" />
              </div>
              <button className="primary add-button" type="submit" data-testid="add-player">
                Add
              </button>
            </form>

            <label className="paste-label" htmlFor="paste-roster">
              Paste a list
            </label>
            <textarea
              id="paste-roster"
              className="paste"
              data-testid="paste-roster"
              value={paste}
              onChange={(event) => setPaste(event.target.value)}
              spellCheck={false}
              placeholder={"One player per line. Gender is optional.\nAvery Chen F\nJordan Patel, M\nSam Rivera"}
            />
            <div className="row-actions">
              <button type="button" className="ghost" data-testid="paste-add" onClick={addPasted}>
                Add pasted players
              </button>
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
              {rosterLine(counts)}
            </p>
            {players.length === 0 ? (
              <p className="empty">Players you add will show up here.</p>
            ) : (
              <ul className="player-list">
                {players.map((player) => (
                  <li key={player.id} className="player" data-testid="player-row">
                    <span className="player-name">{player.name}</span>
                    <GenderField
                      compact
                      value={player.gender}
                      legend={`Gender for ${player.name}`}
                      onChange={(next) =>
                        changeRoster(
                          players.map((item) => (item.id === player.id ? { ...item, gender: next } : item)),
                        )
                      }
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
            )}
          </section>

          <section className="panel no-print" aria-labelledby="draw-heading">
            <h2 id="draw-heading" className="section-title">
              Draw
            </h2>
            <p className="section-help">Everyone is placed. Team sizes stay within one player.</p>

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

            <p className={plan.ok ? "plan" : "plan bad"} data-testid="plan" role={plan.ok ? undefined : "alert"}>
              {describePlan(players.length, plan)}
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
                <small>{balanceHint}</small>
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
            <p className="hint">Separate names with commas or new lines. Extra teams are numbered.</p>

            <button
              type="button"
              className="primary draw-button"
              data-testid="draw"
              disabled={!plan.ok}
              onClick={drawNow}
            >
              {draw ? "Draw again" : "Draw teams"}
            </button>
          </section>
        </div>

        <section className="results" ref={resultsRef} aria-live="polite">
          <div className="results-head">
            <div>
              <h2 className="section-title">Teams</h2>
              {draw ? (
                <p className="section-help" data-testid="result-note">
                  {sizeNote(draw.groups)} {resultNote(draw)} Names on a team are listed A to Z.
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

          {draw ? (
            <div className="team-grid">
              {namedTeams.map((team, index) => (
                <article key={`${draw.id}-${index}`} className="team-card" data-testid="team-card">
                  <h3>{team.name}</h3>
                  <p className="team-meta" data-testid="team-summary">
                    {genderSummary(team.players)}
                  </p>
                  <ol>
                    {team.players.map((player) => (
                      <li key={player.id} className="person">
                        <span>{player.name}</span>
                        {player.gender === "U" ? null : (
                          <span className={player.gender === "M" ? "tag m" : "tag f"}>{player.gender}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}
