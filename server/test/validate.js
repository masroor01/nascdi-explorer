import { readFileSync } from "node:fs";
import { analyze } from "../analyze.js";
const csvText = readFileSync(new URL("./fixture.csv", import.meta.url), "utf8");
const exp = JSON.parse(readFileSync(new URL("./expected.json", import.meta.url), "utf8"));
const t0 = Date.now();
const res = analyze({ csvText, mapping: { date: "date", y: "producer", x: "terminal" }, options: { log: true, bootstrapB: 999, boundsReps: 2000, models: { nardl: true, level: true, prices: true, shortrun: true, diagnostics: true } } });
let fails = 0;
const chk = (label, got, want, tol) => { const ok = typeof want === "string" ? got === want : Math.abs(got - want) <= tol; if (!ok) fails++; console.log((ok ? "ok   " : "FAIL ") + label.padEnd(34) + String(typeof got === "number" ? got.toFixed(4) : got).padStart(12) + "  python " + String(typeof want === "number" ? want.toFixed(4) : want)); };
for (const spec of ["nardl", "level", "prices"]) {
  const m = res.models[spec], e = exp[spec]; if (m.error) { console.log("FAIL", spec, m.error); fails++; continue; }
  chk(spec + " n", m.n, e.n, 0); chk(spec + " p", m.lags.p, e.p, 0); chk(spec + " q", m.lags.q, e.q, 0); chk(spec + " r", spec === "prices" ? 0 : m.lags.r, e.r, 0);
  chk(spec + " ECT", m.ect.coef, e.ECT, 1e-6); chk(spec + " F", m.F, e.F, 1e-5); chk(spec + " t", m.t, e.t, 1e-5);
  chk(spec + " F upper bound (simulated)", m.bounds.F_hi, e.F_hi, 0.25); chk(spec + " t upper bound (simulated)", m.bounds.t_hi, e.t_hi, 0.08); chk(spec + " category", m.category, e.cat === "Mixed" ? "Mixed" : e.cat, 0);
}
const s = res.models.nardl.symmetry, e = exp.nardl;
chk("LR p (HAC)", s.longRun.pHAC, e.LR_pHAC, 1e-4); chk("SR p (HAC)", s.shortRun.pHAC, e.SR_pHAC, 1e-4); chk("LR p (boot)", s.longRun.pBoot, e.LR_pboot, 0.06); chk("SR p (boot)", s.shortRun.pBoot, e.SR_pboot, 0.06); chk("joint p (boot)", s.joint.pBoot, e.J_pboot, 0.06); chk("final spec", s.final.split(" ")[0], e.final, 0);
chk("short-run n", res.shortRun.n, exp.shortrun.n, 0); chk("cumulative effect", res.shortRun.cumulative.coef, exp.shortrun.cum, 1e-6); chk("cumulative HAC s.e.", res.shortRun.cumulative.se, exp.shortrun.se, 1e-5);
console.log(`\n${fails ? "FAILED: " + fails : "ALL CHECKS PASSED"} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); process.exit(fails ? 1 : 0);
