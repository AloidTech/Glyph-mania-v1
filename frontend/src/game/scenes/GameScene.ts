import Phaser from 'phaser';
import { Stroke, StrokePoint } from '../../lib/types/glyph_types';
import { useWorkShopStore } from '../../lib/store';

export class GameScene extends Phaser.Scene {
  private drawSurface!: Phaser.GameObjects.RenderTexture;
  private parchmentBg!: Phaser.GameObjects.Image;
  private lastPoint: { x: number; y: number } | null = null;
  private currentStrokePoints: StrokePoint[] = [];
  private selectedTool: string = 'pen';
  private penRadius: number = 8;
  private eraserRadius: number = 24;
  private cachedBounds: { x: number; y: number; width: number; height: number } | null = null;
  private unsubscribeStore: (() => void) | null = null;

  constructor() {
    super('GameScene');
  }

  preload() {
    this.load.atlas(
      'sigils',
      '/sigils/atlas/sigils-atlas.png',
      '/sigils/atlas/sigils-atlas.json'
    );
    this.load.image('parchment', '/assets/parchment.png');
  }

  create() {
    const bounds = this.getDrawingAreaBounds();
    this.cachedBounds = bounds;

    // 1. Parchment Background Layer
    this.parchmentBg = this.add.image(bounds.x, bounds.y, 'parchment');
    this.parchmentBg.setDisplaySize(bounds.width, bounds.height);

    // Dynamic radius proportional to canvas height
    this.penRadius = Math.max(6, Math.round(bounds.height * 0.015));
    this.eraserRadius = Math.max(20, Math.round(bounds.height * 0.045));

    // 2. Bake smooth anti-aliased brush textures
    this.createBrushTexture(this, 'penBrush', this.penRadius);
    this.createBrushTexture(this, 'eraserBrush', this.eraserRadius);

    // 3. Transparent RenderTexture layer on top
    this.drawSurface = this.add.renderTexture(bounds.x, bounds.y, bounds.width, bounds.height);

    // 4. Subscribe to Zustand store for Undo/Redo canvas sync
    this.unsubscribeStore = useWorkShopStore.subscribe((state, prevState) => {
      if (state.strokes !== prevState.strokes) {
        this.redrawStrokes(state.strokes);
      }
    });

    // 5. Initial render of existing strokes
    this.redrawStrokes(useWorkShopStore.getState().strokes);

    // 6. Window resize event listener (prevents layout thrashing in update loop)
    this.scale.on('resize', () => this.syncCanvasBounds());

    // 7. Input Handlers
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.lastPoint = { x: pointer.x, y: pointer.y };
      this.currentStrokePoints = [{ x: pointer.x, y: pointer.y }];

      this.selectedTool = useWorkShopStore.getState().selectedTool.toLowerCase();
      const isEraser = this.selectedTool === 'eraser';
      const brushKey = isEraser ? 'eraserBrush' : 'penBrush';

      this.stampPoint(this.drawSurface, brushKey, pointer.x, pointer.y, isEraser);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || !this.lastPoint) return;

      this.currentStrokePoints.push({ x: pointer.x, y: pointer.y });
      this.selectedTool = useWorkShopStore.getState().selectedTool.toLowerCase();
      const isEraser = this.selectedTool === 'eraser';
      const brushKey = isEraser ? 'eraserBrush' : 'penBrush';
      const radius = isEraser ? this.eraserRadius : this.penRadius;

      this.stampLine(this.drawSurface, brushKey, this.lastPoint, { x: pointer.x, y: pointer.y }, isEraser, radius);
      this.lastPoint = { x: pointer.x, y: pointer.y };
    });

    this.input.on('pointerup', () => {
      if (this.currentStrokePoints.length > 0) {
        const stroke: Stroke = {
          id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          points: [...this.currentStrokePoints],
          tool: this.selectedTool === 'eraser' ? 'eraser' : 'pen',
          timestamp: Date.now(),
        };
        useWorkShopStore.getState().addStroke(stroke);
        this.currentStrokePoints = [];
      }
      this.lastPoint = null;
    });

    // Cleanup subscription when scene shuts down
    this.events.once('shutdown', () => {
      if (this.unsubscribeStore) {
        this.unsubscribeStore();
      }
    });
  }

  update(_time: number, _delta: number) {
    // Zero layout thrashing: update loop is clean and fast!
  }

  // Get screen bounds of DOM .drawing-area container
  private getDrawingAreaBounds() {
    const el = document.querySelector('.drawing-area');
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
        };
      }
    }
    return { x: 400, y: 300, width: 512, height: 512 };
  }

  // Synchronize canvas dimensions only when layout shifts
  public syncCanvasBounds() {
    const bounds = this.getDrawingAreaBounds();
    this.cachedBounds = bounds;
    if (this.parchmentBg) {
      this.parchmentBg.setPosition(bounds.x, bounds.y);
      this.parchmentBg.setDisplaySize(bounds.width, bounds.height);
    }
    if (this.drawSurface) {
      this.drawSurface.setPosition(bounds.x, bounds.y);
      this.drawSurface.setSize(bounds.width, bounds.height);
    }
    this.redrawStrokes(useWorkShopStore.getState().strokes);
  }

  // Redraw strokes onto RenderTexture
  private redrawStrokes(strokes: Stroke[]) {
    if (!this.drawSurface) return;
    this.drawSurface.clear();
    strokes.forEach((stroke) => {
      const isEraser = stroke.tool === 'eraser';
      const brushKey = isEraser ? 'eraserBrush' : 'penBrush';
      const radius = isEraser ? this.eraserRadius : this.penRadius;

      if (stroke.points.length === 1) {
        this.stampPoint(this.drawSurface, brushKey, stroke.points[0].x, stroke.points[0].y, isEraser);
      } else {
        for (let i = 0; i < stroke.points.length - 1; i++) {
          this.stampLine(this.drawSurface, brushKey, stroke.points[i], stroke.points[i + 1], isEraser, radius);
        }
      }
    });
  }

  // Create smooth anti-aliased brush texture
  createBrushTexture(scene: Phaser.Scene, key: string, radius: number) {
    const size = Math.ceil(radius * 2);
    let canvasTexture: Phaser.Textures.CanvasTexture;

    if (scene.textures.exists(key)) {
      canvasTexture = scene.textures.get(key) as Phaser.Textures.CanvasTexture;
    } else {
      canvasTexture = scene.textures.createCanvas(key, size, size)!;
    }

    if (canvasTexture) {
      const ctx = canvasTexture.context;
      ctx.clearRect(0, 0, size, size);

      const grad = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.85, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(radius, radius, radius - 0.5, 0, Math.PI * 2);
      ctx.fill();

      canvasTexture.refresh();
    }
  }

  toLocal(rt: Phaser.GameObjects.RenderTexture, worldX: number, worldY: number): { x: number; y: number } {
    const topLeft = rt.getTopLeft();
    return { x: worldX - topLeft.x, y: worldY - topLeft.y };
  }

  stampPoint(
    rt: Phaser.GameObjects.RenderTexture,
    brushKey: string,
    worldX: number,
    worldY: number,
    erase: boolean
  ) {
    const local = this.toLocal(rt, worldX, worldY);
    rt.stamp(brushKey, undefined, local.x, local.y, { erase });
  }

  stampLine(
    rt: Phaser.GameObjects.RenderTexture,
    brushKey: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    erase: boolean,
    radius: number = 8
  ) {
    const dist = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const spacing = Math.max(2, Math.floor(radius * 0.2));
    const steps = Math.max(1, Math.ceil(dist / spacing));

    for (let i = 0; i <= steps; i++) {
      const x = Phaser.Math.Linear(from.x, to.x, i / steps);
      const y = Phaser.Math.Linear(from.y, to.y, i / steps);
      this.stampPoint(rt, brushKey, x, y, erase);
    }
  }
}
