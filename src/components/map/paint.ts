/** Colour helpers shared by the marker and polygon layers. */

export function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Average of several hues, for a tint that belongs to no single grouping. */
export function blend(hexes: string[]): string {
  const parts = hexes.map((h) => Number.parseInt(h.slice(1), 16));
  const avg = (shift: number) =>
    Math.round(parts.reduce((sum, n) => sum + ((n >> shift) & 255), 0) / parts.length);
  return `#${[16, 8, 0].map((s) => avg(s).toString(16).padStart(2, "0")).join("")}`;
}
