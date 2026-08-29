# Asteios TD

Wintermaul-style maze tower defense. One 20×32 channel, six T1 types, T2 as an upgrade, smash-through if you wall off.

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

- Blank 20×32 channel. Creeps spawn across the **full 20-wide** green edge and exit on the red one.
- Towers are **2×2**. Creeps are **1 tile**. **1-tile gaps are the maze.** Click an empty tile to place the selected T1 (ghost preview). Click a cube for **Upgrade** / **Sell** only — no type switcher on the cube.
- T1 is **50g / 4s**. T2 is a **+100g / 10s** upgrade of that same cube (150g total). Sell refunds 100% of spend (50 or 150). Smash-through still deletes with **no refund**.
- Types: **Basic** (generalist, wave-1 one-shot at Basic range), **Sniper** (long range — cannot delete spawn from the exit), **Slow**, **Poison** (DoT), **Splash** (maze clumps), **Haste** (fast, lighter hits). No T3.
- Start **500g**. Wave 1 is 20 creeps at **25g** — a gold grant for the maze, not the real fight. Later waves ramp faster than gold.
- Closing the last path is allowed. Creeps smash straight to the exit and delete every tower they walk through.
- **10 lives**. Restart is a fresh run (no meta persist).
- HUD sits **beside** the channel. **DEV cheat** is labeled and **OFF by default**. ON = infinite gold + instant builds. While ON, `B` seals a mid-channel wall.

Keys: `1`–`6` type shortcuts, `R` restart. Cheat on: `B` wall-off.

## Scripts (any OS)

```
npm install
npm run dev
npm test
```
