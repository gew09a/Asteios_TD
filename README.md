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

- Blank 20×32 channel. Creeps spawn **randomly across the full 20-wide** green edge and **bee-line** (8-direction) to the nearest opening. They cannot corner-cut between two cubes that only touch at a point.
- Towers are **2×2**. Creeps are **1 tile**. **1-tile gaps are the maze.** Click an empty tile to place the selected T1 (ghost preview). Click a cube for **Upgrade** / **Sell** only — no type switcher on the cube.
- Costs differ by type (Basic 50, Slow 125, Haste 200, Poison 300, Splash 400, Sniper 500). T2 is **+T1 cost** on that same cube (total 2C), 1.6× power, 1.1× speed. Two T1s still beat one T2 on raw DPS. Sell refunds 100% of spend. Smash-through still deletes with **no refund**.
- Types: **Basic** (maze staple, wave-1 one-shot at Basic range), **Slow** (35%, highest wins), **Haste**, **Poison** (8 DoT/s, 3s refresh, no stack), **Splash**, **Sniper** (long range — cannot delete spawn from the exit). No T3.
- Start **500g**. Wave 1 is 20 creeps at **25g / 10 HP** — a gold grant. Later waves are 12g/kill, +4 creeps, HP ×1.85. Sitting on gold dies.
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
