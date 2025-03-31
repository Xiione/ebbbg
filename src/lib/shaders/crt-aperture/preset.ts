import type { ShaderPreset } from "$lib/types";

// #pragma parameter SHARPNESS_IMAGE "Sharpness Image" 1.0 1.0 5.0 1.0
// #pragma parameter SHARPNESS_EDGES "Sharpness Edges" 3.0 1.0 5.0 1.0
// #pragma parameter GLOW_WIDTH "Glow Width" 0.5 0.05 0.65 0.05
// #pragma parameter GLOW_HEIGHT "Glow Height" 0.5 0.05 0.65 0.05
// #pragma parameter GLOW_HALATION "Glow Halation" 0.1 0.0 1.0 0.01
// #pragma parameter GLOW_DIFFUSION "Glow Diffusion" 0.05 0.0 1.0 0.01
// #pragma parameter MASK_COLORS "Mask Colors" 2.0 2.0 3.0 1.0
// #pragma parameter MASK_STRENGTH "Mask Strength" 0.3 0.0 1.0 0.05
// #pragma parameter MASK_SIZE "Mask Size" 1.0 1.0 9.0 1.0
// #pragma parameter SCANLINE_SIZE_MIN "Scanline Size Min." 0.5 0.5 1.5 0.05
// #pragma parameter SCANLINE_SIZE_MAX "Scanline Size Max." 1.5 0.5 1.5 0.05
// #pragma parameter SCANLINE_SHAPE "Scanline Shape" 2.5 1.0 100.0 0.1
// #pragma parameter SCANLINE_OFFSET "Scanline Offset" 1.0 0.0 1.0 1.0
// #pragma parameter GAMMA_INPUT "Gamma Input" 2.4 1.0 5.0 0.1
// #pragma parameter GAMMA_OUTPUT "Gamma Output" 2.4 1.0 5.0 0.1
// #pragma parameter BRIGHTNESS "Brightness" 1.5 0.0 2.0 0.05

export default {
  passes: ["crt-aperture"],
  filterLinear: false,
  uniforms: {
    SHARPNESS_IMAGE: 1.0, // [1.0, 5.0]
    SHARPNESS_EDGES: 3.0, // [1.0, 5.0]
    GLOW_WIDTH: 0.5, // [0.05, 0.65]
    GLOW_HEIGHT: 0.5, // [0.05, 0.65]
    GLOW_HALATION: 0.1, // [0.01, 1.0]
    GLOW_DIFFUSION: 0.05, // [0.01, 1.0]
    MASK_COLORS: 2.0, // [2.0, 3.0]
    MASK_STRENGTH: 0.3, // [0.0, 1.0]
    MASK_SIZE: 1.0, // [1.0, 9.0]
    SCANLINE_SIZE_MIN: 0.5, // [0.5, 1.5]
    SCANLINE_SIZE_MAX: 1.5, // [0.5, 1.5]
    SCANLINE_SHAPE: 2.5, // [1.0, 100.0]
    SCANLINE_OFFSET: 1.0, // [0.0, 1.0]
    GAMMA_INPUT: 2.4, // [1.0, 5.0]
    GAMMA_OUTPUT: 5, // [1.0, 5.0]
    BRIGHTNESS: 8.5, // [0.0, 2.0]
  },
} satisfies ShaderPreset;
