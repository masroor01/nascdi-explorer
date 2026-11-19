import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseCsv, parseDate, toWeekly, indexSeries, weekGrid, isoDate, descr } from "./stats/series.js";
import { makeData, runModel, shortRun, diagnostics } from "./stats/models.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const INDEX = JSON.parse(readFileSync(path.join(here, "data", "index.json"), "utf8"));
const IDX = indexSeries(INDEX);
const idxWeeks = INDEX.weeks.map((w) => Date.parse(w.d + "T00:00:00Z"));
const dIdx = INDEX.weeks.slice(1).map((w, i) => w.v - INDEX.weeks[i].v); const sdChange = descr(dIdx).sd;
const FLOOR = INDEX.meta.floor_value;

export function publicIndex() { return { meta: INDEX.meta, audit: INDEX.audit, weeks: INDEX.weeks, sdWeeklyChange: sdChange }; }
export function columnsOf(csvText) { const { names, rows } = parseCsv(csvText); return { names, preview: rows.slice(0, 5), rowCount: rows.length }; }

const clampInt = (v, lo, hi, d) => { const x = Number.parseInt(v, 10); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };

export function analyze({ csvText, mapping, options = {} }) {
  const { names, rows } = parseCsv(csvText); const ci = (nm) => names.indexOf(nm);
  if (!mapping || ci(mapping.date) < 0 || ci(mapping.y) < 0) throw new Error("Choose the date column and the series to analyse.");
  if (rows.length > 60000) throw new Error("The file is too large for this tool (limit 60,000 rows). Aggregate to daily or weekly values first.");
  const dayFirst = options.dayFirst !== false, useLog = !!options.log, B = clampInt(options.bootstrapB, 99, 1999, 499), R = clampInt(options.boundsReps, 500, 3000, 1500), seed = clampInt(options.seed, 1, 2147483647, 20261120);
  const dates = rows.map((r) => parseDate(r[ci(mapping.date)], dayFirst)); const badDates = dates.filter((d) => !Number.isFinite(d)).length;
  if (badDates > 0.5 * rows.length) throw new Error("Most dates could not be read. Use YYYY-MM-DD or DD/MM/YYYY (tick 'month first' for MM/DD/YYYY).");
  const num = (col) => rows.map((r) => { const s = String(r[ci(col)]).replace(/,/g, "").trim(); const v = s === "" ? NaN : Number(s); return useLog ? (v > 0 ? Math.log(v) : NaN) : v; });
  const yv = num(mapping.y), xv = mapping.x && ci(mapping.x) >= 0 ? num(mapping.x) : null;
  const wy = toWeekly(dates, yv), wx = xv ? toWeekly(dates, xv) : null;
  const both = [...wy.keys()].filter((w) => !wx || wx.has(w)).sort((a, b) => a - b); if (both.length < 30) throw new Error(`Only ${both.length} weeks have the required values. At least 30 weeks are needed.`);
  const grid = weekGrid(both[0], both[both.length - 1]); const y = grid.map((t) => (wy.has(t) && (!wx || wx.has(t)) ? wy.get(t).mean : NaN)), x = wx ? grid.map((t) => (wx.has(t) && wy.has(t) ? wx.get(t).mean : NaN)) : null;
  const inIdx = grid.filter((t) => IDX.v.has(t)).length; if (inIdx < 30) throw new Error(`Your data cover ${isoDate(grid[0])} to ${isoDate(grid[grid.length - 1])}; the NASCDI index covers ${INDEX.meta.range[0]} to ${INDEX.meta.range[1]}. At least 30 overlapping weeks are needed.`);
  const D = makeData(grid, y, x, IDX), idxV = grid.map((t) => (IDX.v.has(t) ? IDX.v.get(t) : NaN));
  const want = options.models || { nardl: true, level: true, prices: !!x, shortrun: true, diagnostics: true };
  const warnings = [];
  const matched = grid.filter((t, i) => Number.isFinite(y[i]) && (!x || Number.isFinite(x[i]))).length; if (matched < 60) warnings.push(`Only ${matched} matched weeks: tests have little power and a failure to reject is not evidence of absence.`);
  if (grid[0] < IDX.first || grid[grid.length - 1] > IDX.last) warnings.push("Part of your series lies outside the index period and is ignored.");
  const lowN = grid.filter((t) => IDX.cnt.has(t) && IDX.cnt.get(t) < 800).length; const floorWeeks = grid.filter((t) => IDX.v.has(t) && IDX.v.get(t) <= FLOOR + 1e-6).length;
  const audit = { overlapWeeks: inIdx, weeksAtFloor: floorWeeks, weeksWithFewRecords: lowN, gapNote: INDEX.audit.notes, volumeBreak: INDEX.audit.breaks.record_count, indexBreak: INDEX.audit.breaks.index, indexRange: INDEX.meta.range, sdWeeklyChange: sdChange };
  const result = { input: { weeksInGrid: grid.length, weeksMatched: matched, from: isoDate(grid[0]), to: isoDate(grid[grid.length - 1]), log: useLog, hasSecondSeries: !!x, seed, bootstrapB: B, boundsReps: R }, audit, warnings, series: { dates: grid.map(isoDate), y: y.map((v) => (Number.isFinite(v) ? v : null)), x: x ? x.map((v) => (Number.isFinite(v) ? v : null)) : null, index: idxV.map((v) => (Number.isFinite(v) ? v : null)) }, models: {} };
  if (want.diagnostics) result.diagnostics = diagnostics(grid, y, x, idxV);
  for (const spec of ["nardl", "level", "prices"]) if (want[spec]) { try { result.models[spec] = runModel(D, spec, { bootstrapB: B, boundsReps: R, seed }); } catch (e) { result.models[spec] = { error: e.message }; } }
  if (want.shortrun) { try { result.shortRun = shortRun(D, sdChange, { bootstrapB: B, seed }); } catch (e) { result.shortRun = { error: e.message }; } }
  result.caveats = ["The NASCDI has not been validated against administrative closure records; it measures the volume and severity of corridor-related news, not road closures.", "Bounds tests use finite-sample critical values simulated for your sample size and lag structure; bootstrap p-values use a restricted wild bootstrap.", "Estimates condition on your series as uploaded: filled or repeated values lower the power of every test.", "Results are exploratory associations, not causal effects."];
  return result;
}
