import * as THREE from "three";
import { COLS, ROWS, TOWER_SIZE, TYPE_COLOR } from "../game/config";
import { inBounds, snapPlaceOrigin } from "../game/pathfinding";
import type { Snapshot } from "../game/types";

export class BoardRenderer {
  readonly camera: THREE.OrthographicCamera;
  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly hitPoint = new THREE.Vector3();
  private readonly resizeObserver: ResizeObserver;
  private readonly ground: THREE.Mesh;
  private readonly hover: THREE.Mesh;
  private readonly pathLine: THREE.Line;
  private readonly towerMeshes = new Map<number, THREE.Mesh>();
  private readonly creepMeshes = new Map<number, THREE.Group>();
  private readonly shotMeshes = new Map<number, THREE.Mesh>();
  private readonly towerGroup = new THREE.Group();
  private readonly creepGroup = new THREE.Group();
  private readonly shotGroup = new THREE.Group();

  hoverCol = 0;
  hoverRow = 0;
  hoverValid = false;

  constructor(canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color(0x1c2438);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene.add(new THREE.AmbientLight(0x9aa8c8, 0.85));
    const sun = new THREE.DirectionalLight(0xfff4d6, 0.95);
    sun.position.set(8, 22, 6);
    this.scene.add(sun);

    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x4a628c,
      roughness: 0.82,
      metalness: 0.05,
    });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(COLS, ROWS), groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.set(COLS / 2, 0, ROWS / 2);
    this.scene.add(this.ground);

    this.scene.add(this.makeTileGrid());

    this.addEdgeStrip(0, 0x3dcc74);
    this.addEdgeStrip(ROWS - 1, 0xe25b5b);

    this.hover = new THREE.Mesh(
      new THREE.PlaneGeometry(TOWER_SIZE, TOWER_SIZE),
      new THREE.MeshBasicMaterial({ color: 0x6fca8a, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    this.hover.rotation.x = -Math.PI / 2;
    this.hover.position.y = 0.03;
    this.hover.visible = false;
    this.scene.add(this.hover);

    this.pathLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x8fa3c8, transparent: true, opacity: 0.55 }),
    );
    this.scene.add(this.pathLine);

    this.scene.add(this.towerGroup, this.creepGroup, this.shotGroup);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  resize(): void {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    const viewH = ROWS + 2.4;
    const viewW = viewH * aspect;
    this.camera.left = -viewW / 2;
    this.camera.right = viewW / 2;
    this.camera.top = viewH / 2;
    this.camera.bottom = -viewH / 2;
    this.camera.position.set(COLS / 2, 42, ROWS / 2 + 10);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(COLS / 2, 0, ROWS / 2);
    this.camera.updateProjectionMatrix();
  }

  pickCell(clientX: number, clientY: number): { col: number; row: number } | null {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.boardPlane, this.hitPoint)) return null;
    const col = Math.floor(this.hitPoint.x);
    const row = Math.floor(this.hitPoint.z);
    if (!inBounds(col, row)) return null;
    return { col, row };
  }

  pickTile(clientX: number, clientY: number): { col: number; row: number } | null {
    const cell = this.pickCell(clientX, clientY);
    if (!cell) return null;
    return snapPlaceOrigin(cell.col, cell.row);
  }

  worldToStage(col: number, row: number, stage: HTMLElement): { x: number; y: number } | null {
    const canvas = this.renderer.domElement;
    const canvasRect = canvas.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    if (canvasRect.width < 1 || canvasRect.height < 1) return null;
    const v = new THREE.Vector3(col + 1, 1.4, row + 1);
    v.project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * canvasRect.width + (canvasRect.left - stageRect.left),
      y: (-v.y * 0.5 + 0.5) * canvasRect.height + (canvasRect.top - stageRect.top),
    };
  }

  setHover(col: number, row: number, valid: boolean): void {
    this.hoverCol = col;
    this.hoverRow = row;
    this.hoverValid = valid;
    this.hover.visible = true;
    this.hover.position.set(col + TOWER_SIZE / 2, 0.03, row + TOWER_SIZE / 2);
    const mat = this.hover.material as THREE.MeshBasicMaterial;
    mat.color.setHex(valid ? 0x6fca8a : 0xe25b5b);
  }

  hideHover(): void {
    this.hover.visible = false;
  }

  sync(snap: Snapshot): void {
    this.syncPath(snap);
    this.syncTowers(snap);
    this.syncCreeps(snap);
    this.syncShots(snap);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private makeTileGrid(): THREE.LineSegments {
    const pts: number[] = [];
    for (let c = 0; c <= COLS; c++) {
      pts.push(c, 0.015, 0, c, 0.015, ROWS);
    }
    for (let r = 0; r <= ROWS; r++) {
      pts.push(0, 0.015, r, COLS, 0.015, r);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xc5d4ee }));
  }

  private addEdgeStrip(row: number, color: number): void {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(COLS, 1),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(COLS / 2, 0.02, row + 0.5);
    this.scene.add(mesh);
  }

  private syncPath(snap: Snapshot): void {
    const pts = snap.pathPreview.map((t) => new THREE.Vector3(t.col + 0.5, 0.06, t.row + 0.5));
    this.pathLine.geometry.dispose();
    this.pathLine.geometry = new THREE.BufferGeometry().setFromPoints(
      pts.length > 1 ? pts : [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)],
    );
    this.pathLine.visible = pts.length > 1 && !snap.pathBlocked;
  }

  private syncTowers(snap: Snapshot): void {
    const seen = new Set<number>();
    for (const t of snap.towers) {
      seen.add(t.id);
      let mesh = this.towerMeshes.get(t.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.85, 1, 1.85),
          new THREE.MeshStandardMaterial({ color: TYPE_COLOR[t.type], roughness: 0.45 }),
        );
        this.towerMeshes.set(t.id, mesh);
        this.towerGroup.add(mesh);
      }
      const progress = t.buildTotal <= 0 ? 1 : 1 - t.buildRemaining / t.buildTotal;
      const built = t.buildRemaining <= 0;
      const height = (built ? 1.15 : 0.35 + progress * 0.8) * (t.tier === 2 ? 1.25 : 1);
      mesh.scale.set(1, height, 1);
      mesh.position.set(t.col + 1, height / 2, t.row + 1);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(TYPE_COLOR[t.type]);
      mat.opacity = built ? 1 : 0.45 + progress * 0.55;
      mat.transparent = !built;
      const selected = snap.inspectId === t.id;
      mat.emissive.setHex(selected ? 0xffffff : built ? TYPE_COLOR[t.type] : 0x333333);
      mat.emissiveIntensity = selected ? 0.45 : built ? 0.18 : 0.05;
      this.drawBuildRing(mesh, progress, built);
    }
    for (const [id, mesh] of this.towerMeshes) {
      if (seen.has(id)) continue;
      this.towerGroup.remove(mesh);
      mesh.geometry.dispose();
      this.towerMeshes.delete(id);
    }
  }

  private drawBuildRing(mesh: THREE.Mesh, progress: number, built: boolean): void {
    const flag = mesh.userData.ring as THREE.Mesh | undefined;
    if (built) {
      if (flag) {
        mesh.remove(flag);
        flag.geometry.dispose();
        mesh.userData.ring = undefined;
      }
      return;
    }
    let ring = flag;
    if (!ring) {
      ring = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      ring.rotation.x = -Math.PI / 2;
      mesh.add(ring);
      mesh.userData.ring = ring;
    }
    ring.position.set(0, 0.56, 0);
    ring.scale.set(Math.max(0.08, progress), 1, 1);
  }

  private syncCreeps(snap: Snapshot): void {
    const seen = new Set<number>();
    for (const c of snap.creeps) {
      seen.add(c.id);
      let group = this.creepMeshes.get(c.id);
      if (!group) {
        group = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(0.62, 0.62, 0.62),
          new THREE.MeshStandardMaterial({ color: 0xc45c5c, roughness: 0.4 }),
        );
        body.position.y = 0.31;
        const barBg = new THREE.Mesh(
          new THREE.PlaneGeometry(0.7, 0.08),
          new THREE.MeshBasicMaterial({ color: 0x2a1010 }),
        );
        const bar = new THREE.Mesh(
          new THREE.PlaneGeometry(0.7, 0.08),
          new THREE.MeshBasicMaterial({ color: 0x6fca8a }),
        );
        barBg.rotation.x = -Math.PI / 2;
        bar.rotation.x = -Math.PI / 2;
        barBg.position.set(0, 0.78, 0);
        bar.position.set(0, 0.79, 0);
        group.add(body, barBg, bar);
        group.userData = { body, bar };
        this.creepMeshes.set(c.id, group);
        this.creepGroup.add(group);
      }
      group.position.set(c.x, 0, c.y);
      const body = group.userData.body as THREE.Mesh;
      (body.material as THREE.MeshStandardMaterial).color.setHex(c.smashing ? 0xff3333 : 0xc45c5c);
      const bar = group.userData.bar as THREE.Mesh;
      const ratio = Math.max(0, c.hp / c.maxHp);
      bar.scale.x = Math.max(0.04, ratio);
      bar.position.x = (ratio - 1) * 0.35;
    }
    for (const [id, group] of this.creepMeshes) {
      if (seen.has(id)) continue;
      this.creepGroup.remove(group);
      this.creepMeshes.delete(id);
    }
  }

  private syncShots(snap: Snapshot): void {
    const seen = new Set<number>();
    for (const s of snap.shots) {
      seen.add(s.id);
      let mesh = this.shotMeshes.get(s.id);
      const dx = s.x1 - s.x0;
      const dz = s.y1 - s.y0;
      const len = Math.hypot(dx, dz);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1, 0.06, 0.06),
          new THREE.MeshBasicMaterial({ color: s.color }),
        );
        this.shotMeshes.set(s.id, mesh);
        this.shotGroup.add(mesh);
      }
      mesh.position.set((s.x0 + s.x1) / 2, 0.7, (s.y0 + s.y1) / 2);
      mesh.scale.set(Math.max(0.1, len), 1, 1);
      mesh.rotation.y = -Math.atan2(dz, dx);
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(s.color);
    }
    for (const [id, mesh] of this.shotMeshes) {
      if (seen.has(id)) continue;
      this.shotGroup.remove(mesh);
      mesh.geometry.dispose();
      this.shotMeshes.delete(id);
    }
  }
}
