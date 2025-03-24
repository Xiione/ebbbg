export enum AspectRatio {
  FULL = 0, // Full (8:7)
  WIDE = 16, // Wide Letterbox (4:3)
  MEDIUM = 48, // Medium Letterbox (2:1)
  NARROW = 64, // Narrow Letterbox (8:3)
}

export interface LayerPair {
  name: string;
  layer1: number;
  layer2: number;
}

export interface BackgroundConfig {
  layer1: number;
  layer2: number;
  aspectRatio: AspectRatio;
  frameSkip: number;
}

export type ShaderType =
  | "crt-aperture"
  | "crt-blurpi"
  | "crt-caligari"
  | "crt-easymode"
  | "crt-frutbunn"
  | "crt-geom"
  | "crtglow"
  | "crt-guest"
  | "crt-hyllian"
  | "crt-lottes"
  | "crt-mattias"
  | "crt-nes-mini"
  | "crt-pi"
  | "crt-potato"
  | "crt-royale"
  | "crtsim"
  | "crt-slangtest"
  | "crt-torridgristle"
  | "crt-yo6-kv-m14208b"
  | "dotmask"
  | "GritsScanlines"
  | "gtu"
  | "mame-hlsl"
  | "meta-crt"
  | "vector-glow"
  | "vt220"
  | "yeetron"
  | "zfast-crt"
  | "none";

/**
 * Adaptation of .glslp preset files from libretro.
 * Passes' frag and vert shader file names must match.
 */
export interface ShaderPreset {
  passes: string[];
  filterLinear: boolean;
  imageRendering?: "auto" | "crisp-edges" | "pixelated"
  uniforms?: Record<string, any>;
}
