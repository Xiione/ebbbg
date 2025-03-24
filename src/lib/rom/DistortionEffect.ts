import ROM from "./ROM";

export enum EffectType {
  HORIZONTAL = 1,
  HORIZONTAL_INTERLACED = 2,
  VERTICAL = 3,
}

function toSignedShort(x: number) {
  // return x << 16 >> 16
  return x;
}

export default class DistortionEffect {
  private data = new Uint8Array(17);

  constructor(
    private rom: ROM,
    index = 0,
  ) {
    const main = this.rom.readBlock(0xf708 + index * 17);
    for (let i = 0; i < 17; ++i) {
      this.data[i] = main.readInt8();
    }
  }

  /* Is not caching distortion effects doing any harm? */
  //   static handler() {
  //     for (let i = 0; i < 135; ++i) {
  //       ROM.add(new DistortionEffect(i));
  //     }
  //   }

  static sanitize(type: number) {
    // sometimes it's 4...
    switch (type) {
      case EffectType.HORIZONTAL:
        return EffectType.HORIZONTAL;
      case EffectType.VERTICAL:
        return EffectType.VERTICAL;
      case EffectType.HORIZONTAL_INTERLACED:
      default:
        return EffectType.HORIZONTAL_INTERLACED;
    }
  }

  get type() {
    return DistortionEffect.sanitize(this.data[2]);
  }

  set type(value) {
    // this.data[2] = DistortionEffect.sanitize(this.data[2]);
    this.data[2] = value;
  }

  //   get duration() {
  //     return asInt16(this.data[0] + (this.data[1] << 8));
  //   }

  //   set duration(value) {
  //     this.data[0] = value;
  //     this.data[1] = value >> 8;
  //   }

  get frequency() {
    return toSignedShort(this.data[3] + (this.data[4] << 8));
  }

  set frequency(value) {
    this.data[3] = value;
    this.data[4] = value >> 8;
  }

  get amplitude() {
    return toSignedShort(this.data[5] + (this.data[6] << 8));
  }

  set amplitude(value) {
    this.data[5] = value;
    this.data[6] = value >> 8;
  }

  get compression() {
    return toSignedShort(this.data[8] + (this.data[9] << 8));
  }

  set compression(value) {
    this.data[8] = value;
    this.data[9] = value >> 8;
  }

  get frequencyAcceleration() {
    return toSignedShort(this.data[10] + (this.data[11] << 8));
  }

  set frequencyAcceleration(value) {
    this.data[10] = value;
    this.data[11] = value >> 8;
  }

  get amplitudeAcceleration() {
    return toSignedShort(this.data[12] + (this.data[13] << 8));
  }

  set amplitudeAcceleration(value) {
    this.data[12] = value;
    this.data[13] = value >> 8;
  }

  get speed() {
    return toSignedShort(this.data[14]);
  }

  set speed(value) {
    this.data[14] = value;
  }

  get compressionAcceleration() {
    return toSignedShort(this.data[15] + (this.data[16] << 8));
  }

  set compressionAcceleration(value) {
    this.data[15] = value;
    this.data[16] = value >> 8;
  }
}
