import Block from "./Block";
import BattleBackground from "./BattleBackground";
import BackgroundGraphics from "./BackgroundGraphics";
import BackgroundPalette from "./BackgroundPalette";
import { MAX_LAYER_INDEX } from "$lib/constants";

// Compression types
enum CompressionType {
  UNCOMPRESSED_BLOCK = 0,
  RUN_LENGTH_ENCODED_BYTE = 1,
  RUN_LENGTH_ENCODED_SHORT = 2,
  INCREMENTAL_SEQUENCE = 3,
  REPEAT_PREVIOUS_DATA = 4,
  REVERSE_BITS = 5,
  COPY_REVERSED = 6,
  UNKNOWN = 7,
}

/**
 * Error codes for decompression:
 * -1: Negative destination position after adding length
 * -2: Negative source position (bpos2)
 * -3: Negative destination position in RLE_SHORT
 * -4: Negative source position in REPEAT_PREVIOUS_DATA
 * -5: Negative source position in REVERSE_BITS
 * -6: Negative source position in COPY_REVERSED
 * -7: Unknown compression type
 * -8: Unexpected end of data
 */

/**
 * A class that manages ROM data and provides access to game assets
 */
export default class ROM {
  private battleBackgrounds: BattleBackground[] = [];
  private backgroundPalettes: BackgroundPalette[] = [];
  private backgroundGraphics: BackgroundGraphics[] = [];
  private static reversedBytes: Uint8Array = ROM.generateReversedBytes();

  /**
   * Creates a new ROM instance from the provided data
   * @param data - The ROM data as an Uint8Array
   */
  constructor(private romData: Uint8Array) {
    this.initialize();
  }

  /**
   * Initialize ROM data structures by reading backgrounds, palettes, and graphics
   */
  private initialize(): void {
    // Track bit depths for palettes and graphics
    const paletteBits = new Int32Array(114);
    const graphicsBits = new Int32Array(103);

    // First load all backgrounds to determine bit depths
    for (let i = 0; i <= MAX_LAYER_INDEX; i++) {
      const background = new BattleBackground(this, i);
      this.battleBackgrounds.push(background);

      // Update bit depth information
      const paletteIndex = background.paletteIndex;
      const bitsPerPixel = background.bitsPerPixel;

      // console.log(`${paletteIndex}: ${paletteBits[paletteIndex]} ${bitsPerPixel}`)
      if (
        paletteBits[paletteIndex] &&
        paletteBits[paletteIndex] !== bitsPerPixel
      ) {
        throw new Error(
          `BattleBackground palette Error: Inconsistent bit depth for palette ${paletteIndex}`,
        );
      }

      paletteBits[paletteIndex] = bitsPerPixel;
      graphicsBits[background.graphicsIndex] = bitsPerPixel;
    }

    // Load palettes with correct bit depths
    for (let i = 0; i < 114; i++) {
      this.backgroundPalettes.push(
        new BackgroundPalette(this, i, paletteBits[i]),
      );
    }

    // Load graphics with correct bit depths
    for (let i = 0; i < 103; i++) {
      this.backgroundGraphics.push(
        new BackgroundGraphics(this, i, graphicsBits[i]),
      );
    }
  }

  /**
   * Get a battle background by index
   * @param index - The index of the battle background
   */
  getBattleBackground(index: number): BattleBackground {
    return this.battleBackgrounds[index];
  }

  /**
   * Get a background palette by index
   * @param index - The index of the background palette
   */
  getBackgroundPalette(index: number): BackgroundPalette {
    return this.backgroundPalettes[index];
  }

  /**
   * Get background graphics by index
   * @param index - The index of the background graphics
   */
  getBackgroundGraphics(index: number): BackgroundGraphics {
    return this.backgroundGraphics[index];
  }

  /**
   * Read a block of data from the ROM
   * @param location - The address to read from
   * @returns A new Block instance at the specified location
   */
  readBlock(location: number): Block {
    return new Block(this, location);
  }

  /**
   * Converts an SNES address to a ROM file offset
   * @param address - The SNES memory address
   * @param header - Whether the ROM has a header (default: true)
   * @returns The corresponding file offset
   */
  static snesToHex(address: number, header = true): number {
    let newAddress = address;

    if (newAddress >= 0x400000 && newAddress < 0x600000) {
      // Address already in the correct range
    } else if (newAddress >= 0xc00000 && newAddress < 0x1000000) {
      newAddress -= 0xc00000;
    } else {
      throw new Error(`SNES address out of range: ${newAddress}`);
    }

    if (header) {
      newAddress += 0x200;
    }

    return newAddress - 0xa0200;
  }

  /**
   * Converts a ROM file offset to an SNES memory address
   * @param address - The ROM file offset
   * @param header - Whether the ROM has a header (default: true)
   * @returns The corresponding SNES memory address
   */
  static hexToSnes(address: number, header = true): number {
    let newAddress = address;

    if (header) {
      newAddress -= 0x200;
    }

    if (newAddress >= 0 && newAddress < 0x400000) {
      return newAddress + 0xc00000;
    } else if (newAddress >= 0x400000 && newAddress < 0x600000) {
      return newAddress;
    } else {
      throw new Error(`File offset out of range: ${newAddress}`);
    }
  }

  /**
   * Calculates the size of compressed data
   * @param start - The starting position in the data
   * @returns The size of the decompressed data, or a negative error code
   */
  getCompressedSize(start: number): number {
    let bpos = 0;
    let pos = start;
    let bpos2 = 0;

    while (this.data[pos] !== 0xff) {
      // Data overflow before end of compressed data
      if (pos >= this.data.length) {
        return -8;
      }

      let commandType = this.data[pos] >> 5;
      let length = (this.data[pos] & 0x1f) + 1;

      if (commandType === 7) {
        commandType = (this.data[pos] & 0x1c) >> 2;
        length = ((this.data[pos] & 3) << 8) + this.data[pos + 1] + 1;
        ++pos;
      }

      if (bpos + length < 0) {
        return -1;
      }

      pos++;

      if (commandType >= 4) {
        bpos2 = (this.data[pos] << 8) + this.data[pos + 1];
        if (bpos2 < 0) {
          return -2;
        }
        pos += 2;
      }

      switch (commandType) {
        case CompressionType.UNCOMPRESSED_BLOCK:
          bpos += length;
          pos += length;
          break;
        case CompressionType.RUN_LENGTH_ENCODED_BYTE:
          bpos += length;
          ++pos;
          break;
        case CompressionType.RUN_LENGTH_ENCODED_SHORT:
          if (bpos < 0) {
            return -3;
          }
          bpos += 2 * length;
          pos += 2;
          break;
        case CompressionType.INCREMENTAL_SEQUENCE:
          bpos += length;
          ++pos;
          break;
        case CompressionType.REPEAT_PREVIOUS_DATA:
          if (bpos2 < 0) {
            return -4;
          }
          bpos += length;
          break;
        case CompressionType.REVERSE_BITS:
          if (bpos2 < 0) {
            return -5;
          }
          bpos += length;
          break;
        case CompressionType.COPY_REVERSED:
          if (bpos2 - length + 1 < 0) {
            return -6;
          }
          bpos += length;
          break;
        default:
          return -7;
      }
    }

    return bpos;
  }

  /**
   * Decompress data from the ROM
   * @param start - The starting position in the data
   * @param size - The size of decompressed data expected, in bytes
   * @returns The decompressed data, or null if decompression failed
   */
  decompress(start: number, size: number): Uint8Array | null {
    const output = new Uint8Array(size);
    let pos = start;
    let bpos = 0;
    let bpos2 = 0;
    let tmp;

    while (this.data[pos] !== 0xff) {
      // Data overflow before end of compressed data
      if (pos >= this.data.length) {
        return null;
      }

      let commandType = this.data[pos] >> 5;
      let len = (this.data[pos] & 0x1f) + 1;

      if (commandType === 7) {
        commandType = (this.data[pos] & 0x1c) >> 2;
        len = ((this.data[pos] & 3) << 8) + this.data[pos + 1] + 1;
        ++pos;
      }

      // Error: block length would overflow maxLength, or block endpos negative
      if (bpos + len > output.length || bpos + len < 0) {
        return null;
      }

      ++pos;

      if (commandType >= 4) {
        bpos2 = (this.data[pos] << 8) + this.data[pos + 1];
        if (bpos2 >= output.length || bpos2 < 0) {
          return null;
        }
        pos += 2;
      }

      switch (commandType) {
        case CompressionType.UNCOMPRESSED_BLOCK:
          while (len-- !== 0) {
            output[bpos++] = this.data[pos++];
          }
          break;

        case CompressionType.RUN_LENGTH_ENCODED_BYTE:
          while (len-- !== 0) {
            output[bpos++] = this.data[pos];
          }
          ++pos;
          break;

        case CompressionType.RUN_LENGTH_ENCODED_SHORT:
          if (bpos + 2 * len > output.length || bpos < 0) {
            return null;
          }
          while (len-- !== 0) {
            output[bpos++] = this.data[pos];
            output[bpos++] = this.data[pos + 1];
          }
          pos += 2;
          break;

        case CompressionType.INCREMENTAL_SEQUENCE:
          tmp = this.data[pos++];
          while (len-- !== 0) {
            output[bpos++] = tmp++;
          }
          break;

        case CompressionType.REPEAT_PREVIOUS_DATA:
          if (bpos2 + len > output.length || bpos2 < 0) {
            return null;
          }
          for (let i = 0; i < len; ++i) {
            output[bpos++] = output[bpos2 + i];
          }
          break;

        case CompressionType.REVERSE_BITS:
          if (bpos2 + len > output.length || bpos2 < 0) {
            return null;
          }
          while (len-- !== 0) {
            output[bpos++] = ROM.reversedBytes[output[bpos2++] & 0xff];
          }
          break;

        case CompressionType.COPY_REVERSED:
          if (bpos2 - len + 1 < 0) {
            return null;
          }
          while (len-- !== 0) {
            output[bpos++] = output[bpos2--];
          }
          break;

        default:
          return null;
      }
    }

    return output;
  }

  /**
   * Generate a table of reversed byte values
   * @returns An array of reversed byte values
   */
  private static generateReversedBytes(): Uint8Array {
    const reversedBytes = new Uint8Array(256);

    for (let i = 0; i < reversedBytes.length; ++i) {

      let x = i;
      x = ((x & 0b1111_0000) >> 4) | ((x & 0b0000_1111) << 4);
      x = ((x & 0b1100_1100) >> 2) | ((x & 0b0011_0011) << 2);
      x = ((x & 0b1010_1010) >> 1) | ((x & 0b0101_0101) << 1);
      reversedBytes[i] = x;
    }

    return reversedBytes;
  }

  /**
   * Get the ROM data
   */
  get data(): Uint8Array {
    return this.romData;
  }
}
