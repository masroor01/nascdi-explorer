// NARDL / ARDL error-correction models with PSS bounds tests (finite-sample critical values), bootstrap symmetry tests,
// a short-run first-difference regression and descriptive diagnostics. Mirrors the pipeline used in the NASCDI paper.
import { ols, xtx, matInv, covHAC, covHC3, wald, wildP, chi2sf, quantile, rngFactory, matVec } from "./core.js";
const NaNf = Number.NaN;
const LMAX = 3;

export function makeData(grid, y, x, idx) { // all arrays aligned to grid (NaN where missing)
  const T = grid.length, g = (m) => grid.map((t) => (m.has(t) ? m.get(t) : NaNf)); const v = g(idx.v), P = g(idx.P), N = g(idx.N), a = P.map((p, i) => p + N[i]);
  const Am = new Map(); for (const [t0, pv] of idx.P) Am.set(t0, pv + idx.N.get(t0)); return { T, y, x, P, N, a, hasX: !!x, grid, Am };
}
const WEEK = 7 * 86400000;
function val(D, name, t, ext = false) {
  const m = name.match(/^(d?)(y|x|P|N|a)_L(\d+)$/); const arr = D[m[2]]; const L = +m[3];
  if (ext && m[1] && m[2] === "a") { const t1 = D.grid[0] + (t - L) * WEEK, t0 = t1 - WEEK; return D.Am.has(t1) && D.Am.has(t0) ? D.Am.get(t1) - D.Am.get(t0) : NaNf; }
  if (!m[1]) return t - L >= 0 ? arr[t - L] : NaNf;
  return t - L - 1 >= 0 ? arr[t - L] - arr[t - L - 1] : NaNf;
}
export function colNames(spec, p, q, r, hasX) {
  const base = { nardl: ["y_L1", "x_L1", "P_L1", "N_L1"], level: ["y_L1", "x_L1", "a_L1"], prices: ["y_L1", "x_L1"], sr_sym: ["y_L1", "x_L1", "P_L1", "N_L1"], lr_sym: ["y_L1", "x_L1", "a_L1"] }[spec].filter((c) => hasX || c !== "x_L1");
  const c = [...base]; for (let i = 1; i <= p; i++) c.push(`dy_L${i}`); if (hasX) for (let i = 0; i <= q; i++) c.push(`dx_L${i}`);
  if (spec === "nardl" || spec === "lr_sym") for (let i = 0; i <= r; i++) c.push(`dP_L${i}`);
  if (spec === "nardl" || spec === "lr_sym") for (let i = 0; i <= r; i++) c.push(`dN_L${i}`);
  if (spec === "level" || spec === "sr_sym") for (let i = 0; i <= r; i++) c.push(`da_L${i}`);
  return c;
}
function buildRows(D, names, tMin = 0, ext = false) { // returns X (with constant), y, rows index list
  const k = names.length + 1, rows = [], Xs = [], ys = [];
  for (let t = Math.max(1, tMin); t < D.T; t++) {
    const dy = D.y[t] - D.y[t - 1]; if (!Number.isFinite(dy)) continue; const row = [1]; let ok = true;
    for (const nm of names) { const v = val(D, nm, t, ext); if (!Number.isFinite(v)) { ok = false; break; } row.push(v); }
    if (!ok) continue; Xs.push(row); ys.push(dy); rows.push(t);
  }
  const n = rows.length, X = new Float64Array(n * k); for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) X[i * k + j] = Xs[i][j];
  return { X, y: Float64Array.from(ys), n, k, rows, names: ["const", ...names] };
}
export function bgP(X, e, n, k, nl = 4) {
  const A = new Float64Array(n * (k + nl)); for (let i = 0; i < n; i++) { for (let j = 0; j < k; j++) A[i * (k + nl) + j] = X[i * k + j]; for (let l = 1; l <= nl; l++) A[i * (k + nl) + k + l - 1] = i - l >= 0 ? e[i - l] : 0; }
  const f = ols(A, e, n, k + nl); if (!f) return NaNf; const mean = e.reduce((s, v) => s + v, 0) / n; let sst = 0; for (let i = 0; i < n; i++) sst += (e[i] - mean) ** 2;
  const r2 = 1 - f.ssr / sst; return chi2sf(n * r2, nl);
}
const aicOf = (fit) => fit.n * Math.log(fit.ssr / fit.n) + 2 * fit.k;

export function selectLags(D, spec) {
  const hasX = D.hasX, rr = spec === "prices" ? [0] : [0, 1, 2, 3], qq = hasX ? [0, 1, 2, 3] : [0];
  const maxNames = colNames(spec, LMAX, LMAX, spec === "prices" ? 0 : LMAX, hasX); const common = buildRows(D, maxNames); const tMin = common.rows.length ? common.rows[0] : 1; const set = new Set(common.rows);
  const cands = [];
  for (let p = 0; p <= LMAX; p++) for (const q of qq) for (const r of rr) {
    const nm = colNames(spec, p, q, r, hasX); const k = nm.length + 1; if (common.n < k + 12) continue;
    const sub = buildSubset(D, nm, set); const f = ols(sub.X, sub.y, sub.n, sub.k); if (f) cands.push({ aic: aicOf(f), p, q, r });
  }
  if (!cands.length) return null; cands.sort((a, b) => a.aic - b.aic); let bestFail = null;
  for (const c of cands) {
    const nm = colNames(spec, c.p, c.q, c.r, hasX), d = buildRows(D, nm), f = ols(d.X, d.y, d.n, d.k); if (!f) continue; const bg = bgP(d.X, f.e, d.n, d.k);
    if (bg >= 0.05) return { p: c.p, q: c.q, r: c.r, bg, constrained: true };
    if (!bestFail || (Number.isFinite(bg) && bg > bestFail.bg)) bestFail = { p: c.p, q: c.q, r: c.r, bg, constrained: false };
  }
  return bestFail;
}
function buildSubset(D, names, rowSet) { // rows restricted to a common set
  const k = names.length + 1, Xs = [], ys = []; for (const t of rowSet) { const dy = D.y[t] - D.y[t - 1]; const row = [1]; for (const nm of names) row.push(val(D, nm, t)); Xs.push(row); ys.push(dy); }
  const n = Xs.length, X = new Float64Array(n * k); for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) X[i * k + j] = Xs[i][j]; return { X, y: Float64Array.from(ys), n, k };
}

// ---- simulated bounds (Case III), qs = lag order of each long-run regressor's differences (-1 = none)
const boundsCache = new Map();
export function simBounds(n, p, qs, R = 2000, seed = 20261120) {
  const key = `${n}|${p}|${qs.join(",")}|${R}|${seed}`; if (boundsCache.has(key)) return boundsCache.get(key);
  const k = qs.length, mx = Math.max(p, ...qs, 0), N = n + mx + 1, rng = rngFactory(seed + 1000 * n + 100 * p + 10 * qs.reduce((s, v) => s + v, 0) + k); const ncols = 2 + k + p + qs.reduce((s, q) => s + q + 1, 0);
  const res = {};
  for (const bound of ["I0", "I1"]) {
    const Fs = new Float64Array(R), Ts = new Float64Array(R);
    for (let rep = 0; rep < R; rep++) {
      const dy = new Float64Array(N), y = new Float64Array(N); for (let t = 0; t < N; t++) { dy[t] = rng.normal(); y[t] = (t ? y[t - 1] : 0) + dy[t]; }
      const xs = [], dxs = []; for (let j = 0; j < k; j++) { const xa = new Float64Array(N), da = new Float64Array(N); if (bound === "I1") { for (let t = 0; t < N; t++) { da[t] = rng.normal(); xa[t] = (t ? xa[t - 1] : 0) + da[t]; } } else { for (let t = 0; t < N; t++) xa[t] = rng.normal(); for (let t = 1; t < N; t++) da[t] = xa[t] - xa[t - 1]; } xs.push(xa); dxs.push(da); }
      const X = new Float64Array(n * ncols), Y = new Float64Array(n);
      for (let i = 0; i < n; i++) { const t = mx + 1 + i; let c = 0; X[i * ncols + c++] = 1; X[i * ncols + c++] = y[t - 1]; for (let j = 0; j < k; j++) X[i * ncols + c++] = xs[j][t - 1]; for (let l = 1; l <= p; l++) X[i * ncols + c++] = dy[t - l]; for (let j = 0; j < k; j++) for (let l = 0; l <= qs[j]; l++) X[i * ncols + c++] = dxs[j][t - l]; Y[i] = dy[t]; }
      const f = ols(X, Y, n, ncols); if (!f) { Fs[rep] = NaNf; Ts[rep] = NaNf; continue; }
      const m = k + 1, R_ = new Float64Array(m * ncols); for (let i = 0; i < m; i++) R_[i * ncols + 1 + i] = 1; const V = new Float64Array(ncols * ncols); for (let i = 0; i < ncols * ncols; i++) V[i] = f.XtXi[i] * f.s2;
      Fs[rep] = wald(f.b, V, R_, m, ncols) / m; Ts[rep] = f.b[1] / Math.sqrt(V[1 * ncols + 1]);
    }
    res[bound] = { F: Array.from(Fs).filter(Number.isFinite), T: Array.from(Ts).filter(Number.isFinite) };
  }
  const out = { F0: quantile(res.I0.F, 0.95), F1: quantile(res.I1.F, 0.95), t0: quantile(res.I0.T, 0.05), t1: quantile(res.I1.T, 0.05) };
  boundsCache.set(key, out); return out;
}
export function category(F, t, c) {
  const fb = F > c.F1 ? "yes" : F > c.F0 ? "mid" : "no", tb = t < c.t1 ? "yes" : t < c.t0 ? "mid" : "no";
  if (fb === "yes" && tb === "yes") return "Yes"; if (fb === "yes" || tb === "yes") return "Mixed"; if (fb === "mid" || tb === "mid") return "Inconclusive"; return "No";
}
const restr = (names, groups, signs) => { // build R (m*k) from lists of [name,coef] per row
  const k = names.length, R = new Float64Array(groups.length * k); groups.forEach((g, i) => g.forEach(([nm, c]) => { const j = names.indexOf(nm); if (j < 0) throw new Error("missing term " + nm); R[i * k + j] = c; })); return R; };

export function runModel(D, spec, { lags = null, bootstrapB = 999, boundsReps = 2000, seed = 20261120, symmetry = true } = {}) {
  const sel = lags || selectLags(D, spec); if (!sel) throw new Error("Too few overlapping weeks to estimate the model (need roughly 30 consecutive-week observations).");
  const { p, q, r } = sel, names = colNames(spec, p, q, r, D.hasX), d = buildRows(D, names), fit = ols(d.X, d.y, d.n, d.k); if (!fit) throw new Error("The regressors are collinear in this sample.");
  const n = d.n, k = d.k, nm = d.names, hac = covHAC(d.X, fit), j1 = nm.indexOf("y_L1"), lam = fit.b[j1];
  const levelNames = { nardl: ["y_L1", "x_L1", "P_L1", "N_L1"], level: ["y_L1", "x_L1", "a_L1"], prices: ["y_L1", "x_L1"], sr_sym: ["y_L1", "x_L1", "P_L1", "N_L1"], lr_sym: ["y_L1", "x_L1", "a_L1"] }[spec].filter((c) => D.hasX || c !== "x_L1");
  const Rl = restr(nm, levelNames.map((c) => [[c, 1]])), m = levelNames.length, V = new Float64Array(k * k); for (let i = 0; i < k * k; i++) V[i] = fit.XtXi[i] * fit.s2;
  const F = wald(fit.b, V, Rl, m, k) / m, t = lam / Math.sqrt(V[j1 * k + j1]);
  const qs = []; if (D.hasX) qs.push(q); if (spec === "nardl") qs.push(r, r); else if (spec === "level") qs.push(r); else if (spec === "sr_sym") qs.push(r, -1); else if (spec === "lr_sym") qs.push(2 * r + 1);
  if (spec === "prices" && !D.hasX) throw new Error("The prices-only specification needs a second series.");
  const bounds = simBounds(n, p, qs, boundsReps, seed), cat = category(F, t, bounds);
  const seLam = Math.sqrt(hac[j1 * k + j1]), coefs = nm.map((c, i) => ({ name: c, coef: fit.b[i], se: Math.sqrt(hac[i * k + i]), t: fit.b[i] / Math.sqrt(hac[i * k + i]) }));
  let sst = 0, mean = d.y.reduce((s, v) => s + v, 0) / n; for (let i = 0; i < n; i++) sst += (d.y[i] - mean) ** 2;
  const longrun = {}; for (const c of levelNames.slice(1)) { const j = nm.indexOf(c), th = -fit.b[j] / lam; const g = new Float64Array(k); g[j] = -1 / lam; g[j1] = fit.b[j] / (lam * lam); const gv = matVec(hac, g, k, k); let s = 0; for (let i = 0; i < k; i++) s += g[i] * gv[i]; longrun[c] = { theta: th, se: Math.sqrt(s) }; }
  const out = { spec, n, lags: { p, q, r }, lagSelection: { bgP: sel.bg, constrained: sel.constrained }, ect: { coef: lam, se: seLam, lo: lam - 1.96 * seLam, hi: lam + 1.96 * seLam }, halfLife: lam < 0 && lam > -1 ? Math.log(0.5) / Math.log(1 + lam) : null,
    F, t, bounds: { F_lo: bounds.F0, F_hi: bounds.F1, t_lo: bounds.t0, t_hi: bounds.t1 }, category: cat, r2: 1 - fit.ssr / sst, coefficients: coefs, longRun: longrun, weeks: { first: d.rows[0], last: d.rows[n - 1] } };
  if (spec === "nardl") { const a = nm.indexOf("P_L1"), b2 = nm.indexOf("N_L1"); let sa = 0, sb = 0; for (let i = 0; i < n; i++) { sa += d.X[i * k + a]; sb += d.X[i * k + b2]; } sa /= n; sb /= n; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { const u = d.X[i * k + a] - sa, v = d.X[i * k + b2] - sb; sab += u * v; saa += u * u; sbb += v * v; } out.identification = { corrPN: sab / Math.sqrt(saa * sbb) }; }
  if (symmetry && spec === "nardl") {
    const rng = rngFactory(seed + 7), LR = restr(nm, [[["P_L1", 1], ["N_L1", -1]]]);
    const SRg = [[]]; for (let i = 0; i <= r; i++) { SRg[0].push([`dP_L${i}`, 1]); SRg[0].push([`dN_L${i}`, -1]); } const SR = restr(nm, SRg), J = restr(nm, [[["P_L1", 1], ["N_L1", -1]], SRg[0]]);
    const sym = {}; for (const [lab, Rm, mm] of [["longRun", LR, 1], ["shortRun", SR, 1], ["joint", J, 2]]) { const w = wald(fit.b, hac, Rm, mm, k); sym[lab] = { wald: w, pHAC: chi2sf(w, mm), pBoot: wildP(d.X, d.y, n, k, Rm, mm, bootstrapB, rng, fit) }; }
    const lr = sym.longRun.pBoot < 0.05, sr = sym.shortRun.pBoot < 0.05; sym.final = !lr && !sr ? "Symmetric" : !sr && lr ? "Short-run symmetric (long-run asymmetry)" : !lr && sr ? "Long-run symmetric (short-run asymmetry)" : "Unrestricted"; out.symmetry = sym;
  }
  return out;
}

// ---- short-run first-difference regression: dy on 5 contemporaneous+lagged index changes (+ own lag, other price changes)
export function shortRun(D, sd, { bootstrapB = 999, seed = 20261120 } = {}) {
  const names = ["dy_L1"]; if (D.hasX) names.push("dx_L0", "dx_L1", "dx_L2"); for (let i = 0; i < 5; i++) names.push(`da_L${i}`);
  const d = buildRows(D, names, 1, true); if (d.n < 20) throw new Error("Too few weeks for the short-run regression."); const fit = ols(d.X, d.y, d.n, d.k), nm = d.names, k = d.k, n = d.n;
  const idx = (c) => nm.indexOf(c), R5 = new Float64Array(5 * k); for (let i = 0; i < 5; i++) R5[i * k + idx(`da_L${i}`)] = 1; const Rs = new Float64Array(k); for (let i = 0; i < 5; i++) Rs[idx(`da_L${i}`)] = 1;
  const hac = covHAC(d.X, fit), rng = rngFactory(seed + 11); const cum = Rs.reduce((s, v, i) => s + v * fit.b[i], 0), vcum = (() => { const g = matVec(hac, Rs, k, k); let s = 0; for (let i = 0; i < k; i++) s += Rs[i] * g[i]; return s; })(), se = Math.sqrt(vcum);
  return { n, jointP: wildP(d.X, d.y, n, k, R5, 5, bootstrapB, rng, fit), jointPHAC: chi2sf(wald(fit.b, hac, R5, 5, k), 5), cumulative: { coef: cum, pctPerSD: 100 * cum * sd, se, pBoot: wildP(d.X, d.y, n, k, Rs, 1, bootstrapB, rng, fit), pHAC: chi2sf((cum / se) ** 2, 1), mdePctPerSD: 100 * 2.8 * se * sd }, coefficients: nm.map((c, i) => ({ name: c, coef: fit.b[i] })).filter((c) => c.name.startsWith("da_")) };
}

// ---- descriptive diagnostics
export function diagnostics(grid, y, x, idxV) {
  const T = grid.length, dy = y.map((v, i) => (i && Number.isFinite(v) && Number.isFinite(y[i - 1]) ? v - y[i - 1] : NaNf)), da = idxV.map((v, i) => (i && Number.isFinite(v) && Number.isFinite(idxV[i - 1]) ? v - idxV[i - 1] : NaNf));
  const corr = (a, b) => { const p = []; for (let i = 0; i < a.length; i++) if (Number.isFinite(a[i]) && Number.isFinite(b[i])) p.push([a[i], b[i]]); if (p.length < 8) return { r: NaNf, n: p.length }; const ma = p.reduce((s, q) => s + q[0], 0) / p.length, mb = p.reduce((s, q) => s + q[1], 0) / p.length; let sab = 0, saa = 0, sbb = 0; for (const [u, v] of p) { sab += (u - ma) * (v - mb); saa += (u - ma) ** 2; sbb += (v - mb) ** 2; } return { r: sab / Math.sqrt(saa * sbb), n: p.length }; };
  const lagCorr = []; for (let L = 0; L <= 8; L++) { const sh = da.map((_, i) => (i - L >= 0 ? da[i - L] : NaNf)); const c = corr(dy, sh); lagCorr.push({ lag: L, r: c.r, n: c.n, ci: c.n > 3 ? 1.96 / Math.sqrt(c.n) : null }); }
  const obs = y.filter(Number.isFinite).length; let rep = 0, tot = 0, run = 1, longest = 1; for (let i = 1; i < T; i++) if (Number.isFinite(y[i]) && Number.isFinite(y[i - 1])) { tot++; if (y[i] === y[i - 1]) { rep++; run++; longest = Math.max(longest, run); } else run = 1; }
  let gaps = 0, maxGap = 0, cur = 0; for (let i = 0; i < T; i++) { if (!Number.isFinite(y[i])) { cur++; } else { if (cur > 0) { gaps++; maxGap = Math.max(maxGap, cur); } cur = 0; } }
  return { lagCorr, weeksInGrid: T, weeksObserved: obs, repeatShare: tot ? rep / tot : null, longestRepeatedRun: longest, gapsInGrid: gaps, longestGapWeeks: maxGap };
}
