# Asteios TD

Wintermaul-style maze tower defense. First playable: one 20×32 channel, three T1/T2 types, smash-through if you wall off.

## Windows (Command Prompt)

PowerShell’s execution policy often blocks `npm` scripts. Use **Command Prompt** (`cmd.exe`), not PowerShell.

```bat
git pull
npm.cmd install
npm.cmd run dev
```

Then open http://localhost:5173

(`npm install` / `npm run dev` also work in Command Prompt. Prefer `npm.cmd` if your environment still hits an execution-policy error.)

## Play

- Blank 20×32 channel. Creeps spawn on the green short edge and exit on the red one. Default path is a straight shot.
- Towers are **2×2**. Creeps are **1 tile**. **1-tile gaps are the maze.** Towers cannot overlap.
- You may close the last path. Creeps then smash in a straight line to the exit and **delete every tower they walk through** (no gold refund). After a hole is punched, remaining creeps use the opened path.
- Start **500g**. T1 **50g / 4s**. T2 **150g / 10s**, about **2×** T1 power. No T3.
- Types: **Bolt** (raw DPS), **Frost** (slow, low damage), **Venom** (DoT — wants a long path). Builds run in parallel and do not shoot until finished.
- 15s prep before wave 1. Wave 1 is 20 creeps at 12g each — a crude 10 T1 maze should hold; lining the walls should leak.
- **10 lives**. A leak costs 1. 0 lives ends the run. Restart is a fresh run (no meta persist).
- **DEV cheat** is a labeled toggle and is **OFF by default**. Turn it on only for pathing / smash tests: infinite gold and instant builds. Normal play uses the real economy and real build times.

Keys: `1` Bolt, `2` Frost, `3` Venom, `Q` T1, `W` T2, `R` restart.

## Scripts (any OS)

```
npm install
npm run dev
npm test
```
