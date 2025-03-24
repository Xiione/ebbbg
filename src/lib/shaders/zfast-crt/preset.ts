import type { ShaderPreset } from "$lib/types";

// #pragma parameter BLURSCALEX "Blur Amount X-Axis" 0.30 0.0 1.0 0.05
// #pragma parameter LOWLUMSCAN "Scanline Darkness - Low" 6.0 0.0 10.0 0.5
// #pragma parameter HILUMSCAN "Scanline Darkness - High" 8.0 0.0 50.0 1.0
// #pragma parameter BRIGHTBOOST "Dark Pixel Brightness Boost" 1.25 0.5 1.5 0.05
// #pragma parameter MASK_DARK "Mask Effect Amount" 0.25 0.0 1.0 0.05
// #pragma parameter MASK_FADE "Mask/Scanline Fade" 0.8 0.0 1.0 0.05

export default {
  passes: ["zfast-crt"],
  filterLinear: true,
  uniforms: {
    BLURSCALEX: 0.45, // [0.0, 1.0]
    LOWLUMSCAN: 10.0, // [0.0, 10.0]
    HILUMSCAN: 15.0, // [0.0, 50.0]
    BRIGHTBOOST: 3.0, // [0.5, 1.5]
    MASK_DARK: 0.25, // [0.0, 1.0]
    MASK_FADE: 0.8, // [0.0, 1.0]
  },
} satisfies ShaderPreset;
