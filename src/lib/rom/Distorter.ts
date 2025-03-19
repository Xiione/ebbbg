import DistortionEffect, { EffectType } from "./DistortionEffect";
import { SNES_HEIGHT, SNES_WIDTH } from "$lib/constants";

const R = 0;
const G = 1;
const B = 2;
const A = 3;

const C1 = 1 / 512;
const C2 = (8 * Math.PI) / (1024 * 256);
const C3 = Math.PI / 60;

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

// There is some redundancy here: 'effect' is currently what is used
// in computing frames, although really there should be a list of
// four different effects ('dist') which are used in sequence.
//
// 'distortions' is currently unused, but ComputeFrame should be changed to
// make use of it as soon as the precise nature of effect sequencing
// can be determined.
//
// The goal is to make Distorter a general-purpose BG effect class that
// can be used to show either a single distortion effect, or to show the
// entire sequence of effects associated with a background entry (including
// scrolling and Palette animation, which still need to be implemented).
//     this.distortions = Array(4).fill(new DistortionEffect());
/* NOTE: Another discrepancy from Java: These values should be "short" and must have a specific precision. This seems to affect backgrounds with distortEffect === HORIZONTAL */
export default class Distorter {
  constructor(
    private effect: DistortionEffect,
    private bitmap: Uint8Array,
  ) {}

  // setOffsetConstants(ticks: number, effect: DistortionEffect) {
  //   const {
  //     amplitude,
  //     amplitudeAcceleration,
  //     compression,
  //     compressionAcceleration,
  //     frequency,
  //     frequencyAcceleration,
  //     speed,
  //   } = effect;
  //   /* Compute "current" values of amplitude, frequency and compression */
  //   const t2 = ticks * 2;
  //
  //   this.amplitude = C1 * (amplitude + amplitudeAcceleration * t2);
  //   this.frequency = C2 * (frequency + frequencyAcceleration * t2);
  //   this.compression = 1 + (compression + compressionAcceleration * t2) / 256;
  //   this.speed = C3 * speed * ticks;
  //   this.S = (y) =>
  //     round(this.amplitude * sin(this.frequency * y + this.speed));
  // }

  // overlayFrame(dst, letterbox, ticks, alpha, erase) {
  //   return this.computeFrame(
  //     dst,
  //     this.bitmap,
  //     letterbox,
  //     ticks,
  //     alpha,
  //     erase,
  //     this.effect,
  //   );
  // }

  /**
   * Evaluates the distortion effect at the given destination line and
   * time value and returns the computed offset value.
   * If the distortion mode is horizontal, this offset should be interpreted
   * as the number of pixels to offset the given line's starting x position.
   * If the distortion mode is vertical, this offset should be interpreted as
   * the y-coordinate of the line from the source bitmap to draw at the given
   * y-coordinate in the destination bitmap.
   * @param y
   *   The y-coordinate of the destination line to evaluate for
   * @param t
   *   The number of ticks since beginning animation
   * @return
   *   The distortion offset for the given (y, t) coordinates
   */
  // getAppliedOffset(y, distortionEffect) {
  //   const s = this.S(y);
  //   switch (distortionEffect) {
  //     default:
  //     case HORIZONTAL:
  //       return s;
  //     case HORIZONTAL_INTERLACED:
  //       return y % 2 === 0 ? -s : s;
  //     case VERTICAL:
  //       /* Compute L */
  //       return mod(floor(s + y * this.compression), 256);
  //   }
  // }

  overlayFrame(
    destinationBitmap: Uint8Array,
    letterbox: number,
    ticks: number,
    alpha: number,
    erase: boolean,
  ) {
    const { type: distortionEffect } = this.effect;
    const newBitmap = destinationBitmap;
    const oldBitmap = this.bitmap;
    const dstStride = 1024;
    const srcStride = 1024;

    /*
      Given the list of 4 distortions and the tick count, decide which
      effect to use:
      Basically, we have 4 effects, each possibly with a duration.
      Evaluation order is: 1, 2, 3, 0
      If the first effect is null, control transitions to the second effect.
      If the first and second effects are null, no effect occurs.
      If any other effect is null, the sequence is truncated.
      If a non-null effect has a zero duration, it will not be switched
      away from.
      Essentially, this configuration sets up a precise and repeating
      sequence of between 0 and 4 different distortion effects. Once we
      compute the sequence, computing the particular frame of which distortion
      to use becomes easy; simply mod the tick count by the total duration
      of the effects that are used in the sequence, then check the remainder
      against the cumulative durations of each effect.
      I guess the trick is to be sure that my description above is correct.
      Heh.
    */

    const {
      amplitude,
      amplitudeAcceleration,
      compression,
      compressionAcceleration,
      frequency,
      frequencyAcceleration,
      speed,
    } = this.effect;

    const t2 = ticks * 2;

    const amplitudeCur = C1 * (amplitude + amplitudeAcceleration * t2);
    const compressionCur =
      1 + (compression + compressionAcceleration * t2) / 256;
    const frequencyCur = C2 * (frequency + frequencyAcceleration * t2);
    const speedCur = C3 * speed * ticks;

    for (let y = 0; y < SNES_HEIGHT; ++y) {
      const s = Math.round(
        amplitudeCur * Math.sin(frequencyCur * y + speedCur),
      );
      let offset = 0;
      switch (distortionEffect) {
        case EffectType.HORIZONTAL:
          offset = s;
          break;
        case EffectType.HORIZONTAL_INTERLACED:
          offset = y % 2 === 0 ? -s : s;
          break;
        case EffectType.VERTICAL:
          offset = mod(Math.floor(s + y * compressionCur), 256);
          break;
      }

      const L = distortionEffect === EffectType.VERTICAL ? offset : y;
      for (let x = 0; x < SNES_WIDTH; ++x) {
        let bPos = x * 4 + y * dstStride;
        if (y < letterbox || y > SNES_HEIGHT - letterbox) {
          // c: R, G, B. 3 is A
          for (let c = 0; c < 3; c++) {
            newBitmap[bPos + c] = 0;
          }
          newBitmap[bPos + 3] = 255;
          continue;
        }

        let dx = x;
        if (
          distortionEffect === EffectType.HORIZONTAL ||
          distortionEffect === EffectType.HORIZONTAL_INTERLACED
        ) {
          dx = mod(x + offset, SNES_WIDTH);
        }

        let sPos = dx * 4 + L * srcStride;
        /* Either copy or add to the destination bitmap */

        // c: R, G, B. 3 is A
        for (let c = 0; c < 3; c++) {
          if (erase) {
            newBitmap[bPos + c] = 0;
          }
          newBitmap[bPos + c] += alpha * oldBitmap[sPos + c];
        }
        newBitmap[bPos + 3] = 255;
      }
    }
    return newBitmap;
  }
}
