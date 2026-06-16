import { mixHex } from "@/styles/tokens";
import biomesCfg from "./biomes.json";

/**
 * Height-banded biome backdrops: as the blob climbs, the sky/fog transition through
 * ground → sky → upper atmosphere → stratosphere → space → deep space. Data is in
 * biomes.json (each band a minHeight + sky/fog colors); biomeSkyAt() lerps smoothly
 * between the two surrounding bands so the backdrop morphs continuously with altitude.
 */

export interface BiomeColors {
  top: string;
  mid: string;
  deep: string;
  fog: string;
}

interface Band {
  name: string;
  minHeight: number;
  sky: { top: string; mid: string; deep: string };
  fog: string;
}

export const biomeBands = biomesCfg.bands as Band[];

const colorsOf = (b: Band): BiomeColors => ({ ...b.sky, fog: b.fog });

/** Smoothly interpolated biome colors at a given climb height (world Y). */
export function biomeSkyAt(height: number): BiomeColors {
  const bands = biomeBands;
  if (height <= bands[0].minHeight) return colorsOf(bands[0]);
  const last = bands[bands.length - 1];
  if (height >= last.minHeight) return colorsOf(last);

  let lo = bands[0];
  let hi = last;
  for (let i = 0; i < bands.length - 1; i++) {
    if (height >= bands[i].minHeight && height < bands[i + 1].minHeight) {
      lo = bands[i];
      hi = bands[i + 1];
      break;
    }
  }
  // Guard against adjacent bands sharing a minHeight (span 0 → NaN from divide-by-zero).
  const span = hi.minHeight - lo.minHeight;
  const t = span === 0 ? 0 : (height - lo.minHeight) / span;
  return {
    top: mixHex(lo.sky.top, hi.sky.top, t),
    mid: mixHex(lo.sky.mid, hi.sky.mid, t),
    deep: mixHex(lo.sky.deep, hi.sky.deep, t),
    fog: mixHex(lo.fog, hi.fog, t),
  };
}
