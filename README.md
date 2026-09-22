# Team Generator

A small app for coaches and teachers. Enter a roster, choose the number of teams or how many players go on each team, and draw a random split. Turn on **Balance boys and girls** when every team should get a fair mix.

Rosters stay in the browser. Nothing is uploaded.

## How a draw works

- Everyone is placed. Team sizes differ by at most one player.
- With balance on, boys are dealt evenly and girls are dealt evenly from the other end, so one team does not absorb both leftovers. Players without a gender fill the smaller teams.
- With balance off, the whole roster is shuffled and dealt around the teams.
- Names inside a team are listed A to Z. The grouping is the random part. Draw again for a new split.

Paste one player per line. A gender can sit at the end (`Avery Chen F`), after a comma (`Jordan Patel, M`), or in a second spreadsheet column. `M`, `F`, `boy`, `girl`, `male`, and `female` are recognized. A line like `Chen, Avery` stays one name.

## Local development

```bash
npm install
npm test
npm run dev
```

`npm run build` writes the static site to `dist/`.
