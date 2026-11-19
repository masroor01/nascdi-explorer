// Numerical core: RNG, distributions, matrices, OLS and robust covariances. No dependencies.
export function rngFactory(seed = 20261120) {
  let a = seed >>> 0;
  const u = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let spare = null;
  const normal = () => { if (spare !== null) { const s = spare; spare = null; return s; } let x, y, r; do { x = 2 * u() - 1; y = 2 * u() - 1; r = x * x + y * y; } while (r >= 1 || r === 0); const m = Math.sqrt(-2 * Math.log(r) / r); spare = y * m; return x * m; };
  return { u, normal, rademacher: () => (u() < 0.5 ? -1 : 1) };
}

// ---- distributions
function gammaLn(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (let j = 0; j < 6; j++) s += c[j] / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function gammaP(a, x) { if (x <= 0) return 0; if (x < a + 1) { let ap = a, sum = 1 / a, del = sum; for (let n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; } return sum * Math.exp(-x + a * Math.log(x) - gammaLn(a)); } let b = x + 1 - a, c = 1e300, d = 1 / b, h = d; for (let i = 1; i < 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break; } return 1 - Math.exp(-x + a * Math.log(x) - gammaLn(a)) * h; }
export const chi2sf = (x, df) => (x <= 0 ? 1 : 1 - gammaP(df / 2, x / 2));
export function quantile(arr, q) { const a = Float64Array.from(arr).sort(); const pos = (a.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos); return a[lo] + (a[hi] - a[lo]) * (pos - lo); }

// ---- matrices (row-major Float64Array unless stated)
export function matInv(A, k) { // Gauss-Jordan, A is k*k flat; returns flat inverse or null if singular
  const m = Float64Array.from(A), inv = new Float64Array(k * k); for (let i = 0; i < k; i++) inv[i * k + i] = 1;
  for (let c = 0; c < k; c++) {
    let piv = c, best = Math.abs(m[c * k + c]); for (let r = c + 1; r < k; r++) { const v = Math.abs(m[r * k + c]); if (v > best) { best = v; piv = r; } }
    if (best < 1e-12) return null;
    if (piv !== c) for (let j = 0; j < k; j++) { let t = m[c * k + j]; m[c * k + j] = m[piv * k + j]; m[piv * k + j] = t; t = inv[c * k + j]; inv[c * k + j] = inv[piv * k + j]; inv[piv * k + j] = t; }
    const d = m[c * k + c]; for (let j = 0; j < k; j++) { m[c * k + j] /= d; inv[c * k + j] /= d; }
    for (let r = 0; r < k; r++) if (r !== c) { const f = m[r * k + c]; if (f !== 0) for (let j = 0; j < k; j++) { m[r * k + j] -= f * m[c * k + j]; inv[r * k + j] -= f * inv[c * k + j]; } }
  }
  return inv;
}
export function xtx(X, n, k) { const A = new Float64Array(k * k); for (let i = 0; i < n; i++) { const o = i * k; for (let a = 0; a < k; a++) { const xa = X[o + a]; for (let b = a; b < k; b++) A[a * k + b] += xa * X[o + b]; } } for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) A[a * k + b] = A[b * k + a]; return A; }
export function xty(X, y, n, k) { const v = new Float64Array(k); for (let i = 0; i < n; i++) { const o = i * k; for (let a = 0; a < k; a++) v[a] += X[o + a] * y[i]; } return v; }
export function matVec(A, v, r, c) { const o = new Float64Array(r); for (let i = 0; i < r; i++) { let s = 0; for (let j = 0; j < c; j++) s += A[i * c + j] * v[j]; o[i] = s; } return o; }
export function quad(v, A, k) { let s = 0; for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) s += v[i] * A[i * k + j] * v[j]; return s; }

// ---- OLS
export function ols(X, y, n, k) {
  const A = xtx(X, n, k), XtXi = matInv(A, k); if (!XtXi) return null;
  const b = matVec(XtXi, xty(X, y, n, k), k, k), e = new Float64Array(n); let ssr = 0;
  for (let i = 0; i < n; i++) { let f = 0; const o = i * k; for (let a = 0; a < k; a++) f += X[o + a] * b[a]; e[i] = y[i] - f; ssr += e[i] * e[i]; }
  return { b, e, XtXi, n, k, ssr, s2: ssr / (n - k) };
}
export function hatDiag(X, XtXi, n, k) { const h = new Float64Array(n); for (let i = 0; i < n; i++) { const o = i * k; let s = 0; for (let a = 0; a < k; a++) { let t = 0; for (let b = 0; b < k; b++) t += X[o + b] * XtXi[b * k + a]; s += t * X[o + a]; } h[i] = s; } return h; }
function sandwich(X, u, XtXi, n, k) { const meat = new Float64Array(k * k); for (let i = 0; i < n; i++) { const o = i * k, w = u[i] * u[i]; for (let a = 0; a < k; a++) { const xa = X[o + a] * w; for (let b = a; b < k; b++) meat[a * k + b] += xa * X[o + b]; } } for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) meat[a * k + b] = meat[b * k + a]; const T = new Float64Array(k * k), V = new Float64Array(k * k); for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { let s = 0; for (let l = 0; l < k; l++) s += XtXi[i * k + l] * meat[l * k + j]; T[i * k + j] = s; } for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { let s = 0; for (let l = 0; l < k; l++) s += T[i * k + l] * XtXi[l * k + j]; V[i * k + j] = s; } return V; }
export function covHC3(X, fit) { const { n, k, XtXi, e } = fit, h = hatDiag(X, XtXi, n, k), u = new Float64Array(n); for (let i = 0; i < n; i++) u[i] = e[i] / (1 - h[i]); return sandwich(X, u, XtXi, n, k); }
export function covHAC(X, fit, L = 4) { // Newey-West (Bartlett), small-sample correction n/(n-k) as statsmodels use_correction
  const { n, k, XtXi, e } = fit; const S = new Float64Array(k * k);
  const gam = (l) => { const G = new Float64Array(k * k); for (let t = l; t < n; t++) { const o1 = t * k, o2 = (t - l) * k, w = e[t] * e[t - l]; for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) G[a * k + b] += X[o1 + a] * X[o2 + b] * w; } return G; };
  const G0 = gam(0); for (let i = 0; i < k * k; i++) S[i] += G0[i];
  for (let l = 1; l <= L; l++) { const G = gam(l), w = 1 - l / (L + 1); for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) S[a * k + b] += w * (G[a * k + b] + G[b * k + a]); }
  const T = new Float64Array(k * k), V = new Float64Array(k * k);
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { let s = 0; for (let l = 0; l < k; l++) s += XtXi[i * k + l] * S[l * k + j]; T[i * k + j] = s; }
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { let s = 0; for (let l = 0; l < k; l++) s += T[i * k + l] * XtXi[l * k + j]; V[i * k + j] = s * n / (n - k); }
  return V;
}
// Wald statistic r'(R V R')^-1 r for restriction matrix R (m*k) and vector b
export function wald(b, V, R, m, k) {
  const RV = new Float64Array(m * k); for (let i = 0; i < m; i++) for (let j = 0; j < k; j++) { let s = 0; for (let l = 0; l < k; l++) s += R[i * k + l] * V[l * k + j]; RV[i * k + j] = s; }
  const RVR = new Float64Array(m * m); for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) { let s = 0; for (let l = 0; l < k; l++) s += RV[i * k + l] * R[j * k + l]; RVR[i * m + j] = s; }
  const inv = matInv(RVR, m); if (!inv) return NaN; const r = matVec(R, b, m, k); return quad(r, inv, m);
}
// Constrained LS: restrict R b = 0 (fitted via b - XtXi R'(R XtXi R')^-1 R b)
export function constrained(fit, R, m) {
  const { XtXi, b, k } = fit; const XR = new Float64Array(k * m); for (let i = 0; i < k; i++) for (let j = 0; j < m; j++) { let s = 0; for (let l = 0; l < k; l++) s += XtXi[i * k + l] * R[j * k + l]; XR[i * m + j] = s; }
  const M = new Float64Array(m * m); for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) { let s = 0; for (let l = 0; l < k; l++) s += R[i * k + l] * XR[l * m + j]; M[i * m + j] = s; }
  const Mi = matInv(M, m); if (!Mi) return null; const Rb = matVec(R, b, m, k), corr = matVec(Mi, Rb, m, m), bc = Float64Array.from(b);
  for (let i = 0; i < k; i++) { let s = 0; for (let j = 0; j < m; j++) s += XR[i * m + j] * corr[j]; bc[i] -= s; } return bc;
}
// Restricted wild bootstrap p-value for H0: R b = 0 using HC3 Wald, regressors fixed (Rademacher)
export function wildP(X, y, n, k, R, m, B, rng, fit0) {
  const fit = fit0 || ols(X, y, n, k); const XtXi = fit.XtXi, h = hatDiag(X, XtXi, n, k), hc3 = (yy) => { const b = matVec(XtXi, xty(X, yy, n, k), k, k), u = new Float64Array(n); for (let i = 0; i < n; i++) { let f = 0; for (let a = 0; a < k; a++) f += X[i * k + a] * b[a]; u[i] = (yy[i] - f) / (1 - h[i]); } return wald(b, sandwich(X, u, XtXi, n, k), R, m, k); };
  const obs = hc3(y), bc = constrained(fit, R, m); if (!bc) return NaN; const f0 = new Float64Array(n), e0 = new Float64Array(n);
  for (let i = 0; i < n; i++) { let f = 0; for (let a = 0; a < k; a++) f += X[i * k + a] * bc[a]; f0[i] = f; e0[i] = y[i] - f; }
  let cnt = 0; const ys = new Float64Array(n); for (let r = 0; r < B; r++) { for (let i = 0; i < n; i++) ys[i] = f0[i] + e0[i] * rng.rademacher(); if (hc3(ys) >= obs) cnt++; } return (cnt + 1) / (B + 1);
}
