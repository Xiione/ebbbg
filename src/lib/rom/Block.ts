import ROM from "./ROM";

/**
 * Represents a chunk of the ROM's data requested by an object for reading
 * or writing. A requested block should always correspond exactly to an area
 * of strictly contiguous data within an object.
 */
export default class Block {
  constructor(
    private rom: ROM,
    private location: number,
  ) {}

  /**
   * Decompresses data from the block's current position. Note that this
   * method first measures the compressed data's size before allocating the
   * destination array, which incurs a slight additional overhead.
   *
   * @returns An array containing the decompressed data.
   */
  decompress() {
    const size = this.rom.getCompressedSize(this.location);
    if (size < 1) {
      throw new Error(`Invalid compressed data: ${size}`);
    }
    const blockOutput = this.rom.decompress(this.location, size);
    if (blockOutput === null) {
      throw new Error("Computed and actual decompressed sizes do not match.");
    }
    return blockOutput;
  }
  /**
   * Reads a 8-bit integer from the block's current position and advances the
   * current position by 1 byte.
   *
   * @returns The 8-bit value at the current position.
   */
  readInt8() {
    return this.rom.data[this.location++];
  }

  /* Reads a 32-bit integer from the block's current position and advances the current position by 4 bytes. */
  readInt32() {
    return (
      this.readInt8() +
      (this.readInt8() << 8) +
      (this.readInt8() << 16) +
      (this.readInt8() << 24)
    );
  }

  readInt16() {
    return this.readInt8() + (this.readInt8() << 8);
  }
}
