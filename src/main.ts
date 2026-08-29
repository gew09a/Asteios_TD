import { Game } from "./game/game";
import { BoardRenderer } from "./render/renderer";
import { bindKeys, mountHud, renderBanners, renderHud } from "./ui/hud";
import "./style.css";

const hud = document.querySelector<HTMLElement>("#hud")!;
const canvas = document.querySelector<HTMLCanvasElement>("#board")!;
const banner = document.querySelector<HTMLElement>("#banner")!;
const overlay = document.querySelector<HTMLElement>("#overlay")!;

const game = new Game();
(window as Window & { __asteios?: Game }).__asteios = game;
const view = new BoardRenderer(canvas);

mountHud(hud, game);
bindKeys(game);

canvas.addEventListener("pointermove", (e) => {
  const tile = view.pickTile(e.clientX, e.clientY);
  if (!tile) {
    view.hideHover();
    return;
  }
  view.setHover(tile.col, tile.row, game.canPlaceAt(tile.col, tile.row) && game.canAfford(game.selectedCost));
});

canvas.addEventListener("pointerleave", () => view.hideHover());

canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  const tile = view.pickTile(e.clientX, e.clientY);
  if (!tile) return;
  game.tryPlace(tile.col, tile.row);
});

window.addEventListener("resize", () => view.resize());

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.tick(dt);
  const snap = game.snapshot();
  renderHud(hud, snap);
  renderBanners(banner, overlay, snap, () => game.restart());
  view.sync(snap);
  view.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
