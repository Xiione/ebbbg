import { MAX_LAYER_INDEX } from "$lib/constants";
import { AspectRatio, type BackgroundConfig } from "$lib/types";
import type { PageLoad } from "./$types";

const layer1Default = 219;
const layer2Default = 218;
const aspectRatioDefault = AspectRatio.FULL;
const frameSkipDefault = 1;

export const load: PageLoad = ({ url }) => {
  const params = url.searchParams;

  const parseLayerParam = (param: string, defaultValue: number): number => {
    const value = parseInt(params.get(param) || "");
    return !isNaN(value) && value >= 0 && value <= MAX_LAYER_INDEX
      ? value
      : defaultValue;
  };

  const parseAspectRatio = (): AspectRatio => {
    const value = parseInt(
      params.get("aspectRatio") || `${aspectRatioDefault}`,
    );
    switch (value) {
      case AspectRatio.FULL:
      case AspectRatio.WIDE:
      case AspectRatio.MEDIUM:
      case AspectRatio.NARROW:
        return value;
      default:
        return aspectRatioDefault;
    }
  };

  const parseFrameSkip = (): number => {
    const value = parseInt(params.get("frameSkip") || `${frameSkipDefault}`);
    return !isNaN(value) && value >= 1 && value <= 10
      ? value
      : frameSkipDefault;
  };

  const config: BackgroundConfig = {
    layer1: parseLayerParam("layer1", layer1Default),
    layer2: parseLayerParam("layer2", layer2Default),
    aspectRatio: parseAspectRatio(),
    frameSkip: parseFrameSkip(),
  };

  return {
    config,
  };
};
