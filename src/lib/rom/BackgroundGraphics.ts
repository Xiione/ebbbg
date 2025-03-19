import ROM from "./ROM";
import ROMGraphics from "./ROMGraphics";
import PaletteCycle from "./PaletteCycle";

export default class BackgroundGraphics {
  private arrayROMGraphics: Uint8Array;
  private romGraphics: ROMGraphics;

  constructor(rom: ROM, index: number, bitsPerPixel: number) {
    this.romGraphics = new ROMGraphics(bitsPerPixel);

    /* Graphics pointer table entry */
    const graphicsPointerBlock = rom.readBlock(0xd7a1 + index * 4);

    /* Read graphics */
    this.romGraphics.loadGraphics(
      rom.readBlock(ROM.snesToHex(graphicsPointerBlock.readInt32())),
    );

    /* Arrangement pointer table entry */
    const arrayPointerBlock = rom.readBlock(0xd93d + index * 4);
    const arrayPointer = ROM.snesToHex(arrayPointerBlock.readInt32());

    /* Read and decompress arrangement */
    const arrayBlock = rom.readBlock(arrayPointer);
    this.arrayROMGraphics = arrayBlock.decompress();
  }

  draw(bitmap: Uint8Array, palette: PaletteCycle) {
    return this.romGraphics.draw(bitmap, palette, this.arrayROMGraphics);
  }
}
