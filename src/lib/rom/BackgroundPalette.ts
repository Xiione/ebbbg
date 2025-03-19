import ROM from './ROM'
import type Block from './Block';

export default class BackgroundPalette {
  private colors: number[][] = [];
  private address: number;

  constructor (private rom: ROM, index: number, private bitsPerPixel: number) {
    const pointer = this.rom.readBlock(0xDAD9 + index * 4)

    this.address = ROM.snesToHex(pointer.readInt32())

    const data = this.rom.readBlock(this.address)
    this.readPalette(data, 1)
  }

  /**
  * Gets an array of colors representing one of this palette's subpalettes.
  *
  * @param palette - The index of the subpalette to retrieve.
  *
  * @returns An array containing the colors of the specified subpalette.
  */
  getColors (palette: number) {
    return this.colors[palette]
  }
  getColorMatrix () {
    return this.colors
  }

  /**
  * Internal function - reads palette data from the given block into this
  * palette's colors array.
  *
  * @param block - Block to read palette data from.
  * @param count - Number of subpalettes to read.
  */
  readPalette (block: Block, count: number) {
    if (this.bitsPerPixel !== 2 && this.bitsPerPixel !== 4) {
      throw new Error('Palette error: Incorrect color depth specified.')
    }
    if (count < 1) {
      throw new Error('Palette error: Must specify positive number of subpalettes.')
    }
    this.colors = new Array<Array<number>>(count)
    const power = 2 ** this.bitsPerPixel
    for (let palette = 0; palette < count; ++palette) {
      this.colors[palette] = new Array(power)
      for (let i = 0; i < power; i++) {
        const clr16 = block.readInt16()
        const b = ((clr16 >> 10) & 31) * 8
        const g = ((clr16 >> 5) & 31) * 8
        const r = (clr16 & 31) * 8
        // convert RGB to color int
        // this code is straight out of Android: http://git.io/F1lZtw
        this.colors[palette][i] = (0xFF << 24) | (r << 16) | (g << 8) | b
      }
    }
  }
}
