import type ROM from "./ROM";
import BackgroundGraphics from "./BackgroundGraphics";
import DistortionEffect from "./DistortionEffect";
import Distorter from "./Distorter";
import PaletteCycle from "./PaletteCycle";

const WIDTH = 256;
const HEIGHT = 256;

export default class BackgroundLayer {
  private graphics: BackgroundGraphics;
  private paletteCycle: PaletteCycle;
  private pixels = new Uint8Array(WIDTH * HEIGHT * 4);
  private distorter: Distorter;

  constructor(
    private rom: ROM,
    readonly entry: number,
  ) {
    const background = this.rom.getBattleBackground(this.entry);

    /* Set graphics/palette */
    this.graphics = this.rom.getBackgroundGraphics(background.graphicsIndex);
    this.paletteCycle = new PaletteCycle(
      background,
      this.rom.getBackgroundPalette(background.paletteIndex),
    );

    const animation = background.animation;
    const e1 = (animation >> 24) & 0xff;
    const e2 = (animation >> 16) & 0xff;

    this.distorter = new Distorter(
      new DistortionEffect(this.rom, e2 || e1),
      this.pixels,
    );
  }

  /**
   * Renders a frame of the background animation into the specified Bitmap
   *
   * @param dst - Bitmap object into which to render
   * @param letterbox - Size in pixels of black borders at top and bottom of image
   * @param ticks - Time value of the frame to compute
   * @param alpha - Blending opacity
   * @param erase - Whether or not to clear the destination bitmap before rendering
   */
  overlayFrame(
    bitmap: Uint8Array,
    letterbox: number,
    ticks: number,
    alpha: number,
    erase: boolean,
  ) {
    if (this.paletteCycle !== null) {
      this.paletteCycle.cycle();
      this.graphics.draw(this.pixels, this.paletteCycle);
    }
    return this.distorter.overlayFrame(bitmap, letterbox, ticks, alpha, erase);
  }
}
