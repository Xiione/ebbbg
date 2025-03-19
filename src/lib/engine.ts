import type BackgroundLayer from "$lib/rom/BackgroundLayer";
import { SNES_WIDTH, SNES_HEIGHT } from "$lib/constants";

export interface EngineOptions {
  fps: number;
  aspectRatio: number;
  frameSkip: number;
  alpha: number[];
  canvas: HTMLCanvasElement;
}

export default class Engine {
  private fps: number;
  private aspectRatio: number;
  private frameSkip: number;
  private alpha: number[];
  private canvas: HTMLCanvasElement;
  private tick: number = 0;

  constructor(
    public layers: BackgroundLayer[] = [],
    opts: EngineOptions,
  ) {
    this.layers = layers;
    this.fps = opts.fps;
    this.aspectRatio = opts.aspectRatio;
    this.frameSkip = opts.frameSkip;
    this.alpha = opts.alpha;
    this.canvas = opts.canvas;
  }

  animate(debug: boolean = false): () => void {
    let frameID = -1;
    let then = Date.now();
    let elapsed: number;
    const fpsInterval = 1000 / this.fps;
    let bitmap: Uint8Array;
    const canvas = this.canvas;
    const context = canvas.getContext("2d")!;

    if (this.layers[0].entry && !this.layers[1].entry) {
      this.alpha[0] = 1;
      this.alpha[1] = 0;
    }
    if (!this.layers[0].entry && this.layers[1].entry) {
      this.alpha[0] = 0;
      this.alpha[1] = 1;
    }

    context.imageSmoothingEnabled = false;
    canvas.width = SNES_WIDTH;
    canvas.height = SNES_HEIGHT;
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;

    const drawFrame = () => {
      frameID = requestAnimationFrame(drawFrame);
      const now = Date.now();
      elapsed = now - then;

      if (elapsed > fpsInterval) {
        then = now - (elapsed % fpsInterval);

        for (let i = 0; i < this.layers.length; ++i) {
          if (debug) {
            console.log(canvas.toDataURL());
          }
          bitmap = this.layers[i].overlayFrame(
            new Uint8Array(data.buffer, data.byteOffset, data.length),
            this.aspectRatio,
            this.tick,
            this.alpha[i],
            i === 0,
          );
        }

        this.tick += this.frameSkip;
        data.set(bitmap);
        context.putImageData(image, 0, 0);
      }
    };

    if (frameID > 0) {
      cancelAnimationFrame(frameID);
    }

    drawFrame();

    // Return cleanup function
    return () => {
      if (frameID > 0) {
        cancelAnimationFrame(frameID);
      }
    };
  }
}
