// CSV parsing, date handling and weekly alignment with the NASCDI index.
export function parseCsv(text) {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim().length);
  if (clean.length < 2) throw new Error("The file needs a header row and at least one data row.");
  const head = clean[0], delim = [",", ";", "\t"].map((d) => [d, head.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const split = (line) => { const out = []; let cur = "", q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === delim && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map((s) => s.trim()); };
  const names = split(clean[0]).map((s, i) => s || `column_${i + 1}`); const rows = clean.slice(1).map(split);
  return { names, rows };
}
export function parseDate(s, dayFirst = true) {
  s = String(s).trim(); let m;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) { const a = +m[1], b = +m[2]; const [d, mo] = dayFirst ? [a, b] : [b, a]; if (mo < 1 || mo > 12 || d < 1 || d > 31) return NaN; return Date.UTC(+m[3], mo - 1, d); }
  return NaN;
}
const DAY = 86400000;
export const weekEnd = (ms) => { const dow = new Date(ms).getUTCDay(); return ms + ((7 - dow) % 7) * DAY; }; // Sunday on or after
export const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);

// Aggregate rows (date, value) to weekly means (weeks end on Sunday, as the index). Returns Map weekMs -> {mean, count}
export function toWeekly(dates, values) {
  const m = new Map();
  for (let i = 0; i < dates.length; i++) { if (!Number.isFinite(dates[i]) || !Number.isFinite(values[i])) continue; const w = weekEnd(dates[i]); const o = m.get(w) || { s: 0, c: 0 }; o.s += values[i]; o.c++; m.set(w, o); }
  const out = new Map(); for (const [w, o] of m) out.set(w, { mean: o.s / o.c, count: o.c }); return out;
}
// NASCDI index with its partial sums (Shin et al. convention: N is non-positive), cumulated over the full weekly series
export function indexSeries(idxJson) {
  const weeks = idxJson.weeks, v = new Map(), P = new Map(), N = new Map(), cnt = new Map(); let p = 0, n = 0, prev = null;
  for (const w of weeks) { const ms = Date.parse(w.d + "T00:00:00Z"); if (prev !== null) { const d = w.v - prev; if (d > 0) p += d; else if (d < 0) n += d; } prev = w.v; v.set(ms, w.v); P.set(ms, p); N.set(ms, n); cnt.set(ms, w.n); }
  return { v, P, N, cnt, first: Date.parse(weeks[0].d + "T00:00:00Z"), last: Date.parse(weeks[weeks.length - 1].d + "T00:00:00Z") };
}
export function weekGrid(startMs, endMs) { const g = []; for (let t = startMs; t <= endMs; t += 7 * DAY) g.push(t); return g; }
export function descr(a) { const f = a.filter(Number.isFinite), n = f.length, mean = f.reduce((s, x) => s + x, 0) / n, sd = Math.sqrt(f.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)); return { n, mean, sd, min: Math.min(...f), max: Math.max(...f) }; }
