# Team Generator

Live app: https://teamsters.vercel.app

A small app for coaches and teachers. Load a whole class roster separated by period, choose the number of teams or how many players go on each team, and draw a random split. Turn on **Balance boys and girls** or **Balance skills** when every team should get a fair mix.

Rosters stay in the browser. Nothing is uploaded.

## How a draw works

- Everyone is placed. Team sizes differ by at most one player.
- Periods are drawn separately. All periods uses the same team count for each class, and one period draws only that class.
- With gender balance on, boys are dealt evenly and girls are dealt evenly from the other end, so one team does not absorb both leftovers. Players without a gender fill the smaller teams.
- With skill balance on, players are ordered from highest skill to lowest and snaked across the teams. Skills are 1 to 10. A blank skill is treated as the middle of the scale.
- With both balances off, the roster is shuffled and dealt around the teams.
- Names inside a team are listed A to Z. The grouping is the random part. Draw again for a new split.

The roster file is a CSV with this header. Skill is a whole number from 1 to 10. Gender can be `M`, `F`, `boy`, or `girl`. A sample file is in the app and at `public/sample-roster.csv`.

```
first,last,period,gender,skill
Avery,Chen,1,F,8
Jordan,Patel,1,M,3
Sam,Rivera,2,F,10
```

You can still paste one player per line, with a period heading between classes. `beginner` is skill 1, `average` is 5, and `advanced` is 10. A line like `Chen, Avery` stays one name.

## Local development

```bash
npm install
npm test
npm run dev
```

`npm run build` writes the static site to `dist/`.
