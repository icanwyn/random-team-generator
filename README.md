# Team Generator

Live app: https://random-team-generator-eight.vercel.app

A small app for coaches and teachers. Load a whole class roster separated by period, choose the number of teams or how many players go on each team, and draw a random split. Turn on **Balance boys and girls** or **Balance skills** when every team should get a fair mix.

Rosters stay in the browser. Nothing is uploaded.

## How a draw works

- Everyone is placed. Team sizes differ by at most one player.
- Periods are drawn separately. All periods uses the same team count for each class, and one period draws only that class.
- With gender balance on, boys are dealt evenly and girls are dealt evenly from the other end, so one team does not absorb both leftovers. Players without a gender fill the smaller teams.
- With skill balance on, players are ordered from highest skill to lowest and snaked across the teams. Skills are 1 to 5. A blank skill is treated as a 3 while sorting.
- With both balances off, the roster is shuffled and dealt around the teams.
- Names inside a team are listed A to Z. The grouping is the random part. Draw again for a new split.

Paste one player per line, with a period heading between classes:

```
Period 1
Avery Chen F 4
Jordan Patel, M, 2

Period 2
Sam Rivera 3
```

A spreadsheet with `Name`, `Gender`, `Period`, and `Skill` columns works too, including a `.csv` or `.txt` file. `M`, `F`, `boy`, `girl`, `male`, and `female` are recognized. `beginner` is skill 1, `average` is 3, and `advanced` is 5. A line like `Chen, Avery` stays one name.

## Local development

```bash
npm install
npm test
npm run dev
```

`npm run build` writes the static site to `dist/`.
