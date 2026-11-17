// Hue/Saturation like Photoshop: hue -180..180 degrees, sat -100..100 (-100 = grayscale).
// Uses the exact CSS filter matrices (Filter Effects spec) so the browser preview
// (`saturate() hue-rotate()` on the <video>) and the ffmpeg export match.

const mul = (a, b) => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]));

function saturate(s) {
  return [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ];
}

function hueRotate(deg) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
}

// CSS applies filters left to right: saturate first, then hue-rotate → M = H·S.
export const colorMatrix = (hue, sat) => mul(hueRotate(hue), saturate(1 + sat / 100));

export const cssFilter = (hue, sat) =>
  (hue || sat ? `saturate(${1 + sat / 100}) hue-rotate(${hue}deg)` : 'none');

// Two separate mixers, not the combined matrix: browsers clamp to 0..255 between filter steps.
export function mixerFilter(hue, sat) {
  if (!hue && !sat) return '';
  const k = ['rr', 'rg', 'rb', 'gr', 'gg', 'gb', 'br', 'bg', 'bb'];
  const mixer = (m) => `colorchannelmixer=${m.map((v, i) => `${k[i]}=${v.toFixed(4)}`).join(':')},`;
  return `format=gbrp,${sat ? mixer(saturate(1 + sat / 100)) : ''}${hue ? mixer(hueRotate(hue)) : ''}`;
}
