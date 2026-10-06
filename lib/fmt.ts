export const pct = (x: number | null | undefined, d = 1, sign = false) =>
  x == null || !isFinite(x) ? "—" : `${sign && x > 0 ? "+" : ""}${(x * 100).toFixed(d)}%`;
export const ppt = (x: number | null | undefined, d = 0, sign = true) =>
  x == null || !isFinite(x) ? "—" : `${sign && x > 0 ? "+" : ""}${x.toFixed(d)}%`;
export const num = (x: number | null | undefined, d = 2) => (x == null || !isFinite(x) ? "—" : x.toFixed(d));
export const tone = (x: number | null | undefined) => (x == null ? "" : x > 0 ? "text-pos" : x < 0 ? "text-neg" : "");
