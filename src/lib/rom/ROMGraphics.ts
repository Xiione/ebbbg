import Block from "./Block";
import PaletteCycle from "./PaletteCycle"

/**
 * Handles graphics tile rendering from ROM data
 * Used primarily for background graphics rendering
 */
export default class ROMGraphics {
  private bitsPerPixel: number;
  private gfxROMGraphics: Uint8Array;
  private tiles: number[][][];

  constructor(bitsPerPixel: number) {
    this.bitsPerPixel = bitsPerPixel;
    this.gfxROMGraphics = new Uint8Array();
    this.tiles = [];
  }

  /**
   * Loads graphics data from the provided block and builds the tileset
   *
   * @param block - The block containing compressed graphics data
   */
  public loadGraphics(block: Block): void {
    this.gfxROMGraphics = block.decompress();
    this.buildTiles();
  }

  /**
   * Internal method - builds tile data from graphics buffer
   */
  private buildTiles(): void {
    const tileCount = this.gfxROMGraphics.length / (8 * this.bitsPerPixel);
    this.tiles = [];

    for (let tileIndex = 0; tileIndex < tileCount; tileIndex++) {
      this.tiles.push(
        Array(8)
          .fill(null)
          .map(() => Array(8).fill(0)),
      );
      const offset = tileIndex * 8 * this.bitsPerPixel;

      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
          let colorIndex = 0;

          for (let bitPlane = 0; bitPlane < this.bitsPerPixel; bitPlane++) {
            const halfBp = Math.floor(bitPlane / 2);
            const gfx =
              this.gfxROMGraphics[
                offset + y * 2 + (halfBp * 16 + (bitPlane & 1))
              ];
            const bit = (gfx & (1 << (7 - x))) >> (7 - x);
            colorIndex += bit << bitPlane;
          }

          this.tiles[tileIndex][x][y] = colorIndex;
        }
      }
    }
  }

  /**
   * Draws the graphics to the provided bitmap using the palette and arrangement data
   *
   * @param bitmap - Destination bitmap data array (RGBA format)
   * @param palette - Color palette to use for rendering
   * @param arrayROMGraphics - Tile arrangement data
   * @returns The rendered bitmap data
   */
  public draw(
    bitmap: Uint8Array,
    palette: PaletteCycle,
    arrayROMGraphics: Uint8Array,
  ): Uint8Array {
    const stride = 1024;

    // For each tile in the 32×32 grid (256×256 pixel display)
    for (let j = 0; j < 32; j++) {
      for (let i = 0; i < 32; i++) {
        const index = j * 32 + i;
        const tileData =
          arrayROMGraphics[index * 2] + (arrayROMGraphics[index * 2 + 1] << 8);

        const tile = tileData & 0x3ff;
        const verticalFlip = (tileData & 0x8000) !== 0;
        const horizontalFlip = (tileData & 0x4000) !== 0;
        const subPalette = (tileData >> 10) & 7;

        this.drawTile(
          bitmap,
          stride,
          i * 8,
          j * 8,
          palette,
          tile,
          subPalette,
          verticalFlip,
          horizontalFlip,
        );
      }
    }

    return bitmap;
  }

  /**
   * Draws a single tile to the bitmap
   */
  private drawTile(
    pixels: Uint8Array,
    stride: number,
    x: number,
    y: number,
    palette: PaletteCycle,
    tileIndex: number,
    subPalette: number,
    verticalFlip: boolean,
    horizontalFlip: boolean,
  ): void {
    const colors = palette.getColors(subPalette);

    for (let i = 0; i < 8; i++) {
      const px = horizontalFlip ? x + 7 - i : x + i;

      for (let j = 0; j < 8; j++) {
        const colorIndex = this.tiles[tileIndex][i][j];
        const rgbColor = colors[colorIndex];
        const py = verticalFlip ? y + 7 - j : y + j;
        const pos = 4 * px + stride * py;

        pixels[pos + 0] = (rgbColor >> 16) & 0xff; // R
        pixels[pos + 1] = (rgbColor >> 8) & 0xff; // G
        pixels[pos + 2] = rgbColor & 0xff; // B
      }
    }
  }
}
