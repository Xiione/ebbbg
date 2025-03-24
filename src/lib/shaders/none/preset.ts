import type { ShaderPreset } from "$lib/types";

export default {
  passes: [],
  filterLinear: false,
  imageRendering: "pixelated",
  uniforms: {
    pixelScale: 1, // to override engine param passed
  },
} satisfies ShaderPreset;
