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
