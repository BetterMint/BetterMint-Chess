function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return a || b || "#8b949e";
  return rgbToHex([
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
  ]);
}

/**
 * Colour for any rank, however deep. Ranks 1-3 use the three configured
 * colours; deeper ranks fade smoothly from the third colour toward the
 * "deeper ranks" colour so a 10-line readout stays readable instead of
 * collapsing into grey.
 */
export function rankColor(settings, rank, total = 0) {
  const c1 = settings.get("ui.arrowColor1");
  const c2 = settings.get("ui.arrowColor2");
  const c3 = settings.get("ui.arrowColor3");
  const cRest = settings.get("ui.arrowColorRest") || "#8b5cf6";

  if (rank <= 1) return c1;
  if (rank === 2) return c2;
  if (rank === 3) return c3;

  const deepest = Math.max(total, rank, 4);
  const span = Math.max(1, deepest - 3);
  const t = Math.min(1, (rank - 3) / span);
  return mix(c3, cRest, t);
}

export function rankAlpha(rank, total = 0) {
  if (rank <= 3) return 1;
  const deepest = Math.max(total, rank, 4);
  const span = Math.max(1, deepest - 3);
  const t = Math.min(1, (rank - 3) / span);
  return 1 - t * 0.45;
}
