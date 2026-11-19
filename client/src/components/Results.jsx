import React, { useState } from "react";
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, ReferenceLine, Legend } from "recharts";
import { fmt, fmtP } from "../api.js";

const VERDICT = {
  Yes: "Both bounds statistics lie beyond their upper critical values: evidence of a long-run relationship.",
  Mixed: "One statistic lies beyond its upper bound and the other does not: mixed evidence, not a confirmation.",
  Inconclusive: "At least one statistic lies between the bounds and none beyond the upper bound: the test cannot decide.",
  No: "Neither statistic reaches the lower bound: no evidence of a long-run relationship in this equation.",
};
const NAMES = { nardl: "NARDL (partial sums)", level: "ECM with the index as a level", prices: "Prices only (no index)" };
const tip = { contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", fontSize: 12 }, labelStyle: { color: "var(--ink)" } };
const axis = { tick: { fontSize: 11, fill: "var(--muted)" } };

function Overview({ r }) {
  const data = r.series.dates.map((d, i) => ({ d, y: r.series.y[i], x: r.series.x ? r.series.x[i] : null, idx: r.series.index[i] }));
  const a = r.audit;
  return (<div className="stack">
    <div className="facts">
      <div className="fact"><b>{r.input.weeksMatched}</b><span>weeks with your data</span></div>
      <div className="fact"><b>{r.input.from.slice(0, 7)} → {r.input.to.slice(0, 7)}</b><span>period analysed</span></div>
      <div className="fact"><b>{a.weeksAtFloor}</b><span>of these weeks at the index floor (no GKG records)</span></div>
      <div className="fact"><b>{a.weeksWithFewRecords}</b><span>weeks with under 800 qualifying records</span></div>
    </div>
    <h3>Your series and the index</h3>
    <div className="chart"><ResponsiveContainer><ComposedChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
      <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" /><XAxis dataKey="d" tickFormatter={(d) => d.slice(0, 7)} interval={Math.max(1, Math.floor(data.length / 6))} {...axis} />
      <YAxis yAxisId="l" domain={["auto", "auto"]} width={46} {...axis} /><YAxis yAxisId="r" orientation="right" domain={["auto", "auto"]} width={40} {...axis} />
      <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
      <Line yAxisId="l" dataKey="y" name={r.input.log ? "Series (log)" : "Series"} stroke="var(--navy)" dot={false} strokeWidth={1.5} connectNulls={false} isAnimationActive={false} />
      {r.series.x && <Line yAxisId="l" dataKey="x" name={r.input.log ? "Second series (log)" : "Second series"} stroke="var(--red)" dot={false} strokeWidth={1.5} connectNulls={false} isAnimationActive={false} />}
      <Line yAxisId="r" dataKey="idx" name="NASCDI (right axis)" stroke="var(--muted)" dot={false} strokeWidth={1} strokeDasharray="4 3" isAnimationActive={false} />
    </ComposedChart></ResponsiveContainer></div>
    {r.diagnostics && <>
      <h3>Correlation of weekly changes in your series with changes in the index, by lag</h3>
      <div className="chart" style={{ height: 200 }}><ResponsiveContainer><BarChart data={r.diagnostics.lagCorr.map((l) => ({ lag: `${l.lag}w`, r: Number.isFinite(l.r) ? l.r : null }))} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" /><XAxis dataKey="lag" {...axis} /><YAxis domain={[-0.6, 0.6]} width={40} {...axis} /><Tooltip {...tip} formatter={(v) => (v === null ? "–" : v.toFixed(3))} />
        {r.diagnostics.lagCorr[0].ci && <ReferenceLine y={r.diagnostics.lagCorr[0].ci} stroke="var(--red)" strokeDasharray="4 4" />}{r.diagnostics.lagCorr[0].ci && <ReferenceLine y={-r.diagnostics.lagCorr[0].ci} stroke="var(--red)" strokeDasharray="4 4" />}
        <Bar dataKey="r" fill="var(--navy)" isAnimationActive={false} />
      </BarChart></ResponsiveContainer></div>
      <p className="small muted" style={{ margin: 0 }}>Dashed lines: approximate 95% band under no association ({"±"}1.96/{"√"}n). Bars inside the band are indistinguishable from zero.</p>
      <table><tbody>
        <tr><td>Weeks observed / in the period</td><td className="num">{r.diagnostics.weeksObserved} / {r.diagnostics.weeksInGrid}</td></tr>
        <tr><td>Gaps (runs of missing weeks), longest</td><td className="num">{r.diagnostics.gapsInGrid}, {r.diagnostics.longestGapWeeks} weeks</td></tr>
        <tr><td>Weekly values equal to the previous week</td><td className="num">{r.diagnostics.repeatShare === null ? "–" : (100 * r.diagnostics.repeatShare).toFixed(0) + "%"} (longest run {r.diagnostics.longestRepeatedRun} weeks)</td></tr>
      </tbody></table>
      {r.diagnostics.repeatShare > 0.4 && <div className="warn">A large share of weekly values repeat the previous week. Filled or carried-forward values lower the power of every test below; a failure to reject is then weak evidence.</div>}
    </>}
  </div>);
}

function ShortRun({ r }) {
  const s = r.shortRun; if (!s) return null; if (s.error) return <div className="err">{s.error}</div>;
  const c = s.cumulative, unit = r.input.log ? "%" : " units", sd = r.audit.sdWeeklyChange;
  return (<div className="stack">
    <div className="readout"><p>A sustained rise of one standard deviation of the weekly index change ({sd.toFixed(1)} points) held for five weeks is associated with a cumulative change of <b>{fmt(c.pctPerSD, 1)}{unit}</b>{r.input.log ? "" : " (per unit of your series, scaled by 100)"} in your series (bootstrap p = {fmtP(c.pBoot)}; HAC p = {fmtP(c.pHAC)}).</p>
      <p>Joint test that all five index terms are zero: bootstrap p = {fmtP(s.jointP)}. An effect smaller than about <b>{fmt(c.mdePctPerSD, 1)}{unit}</b> per standard deviation would be hard to detect with {s.n} weeks (80% power).</p>
      <p className="muted">This is an association in your data, not a causal effect, and it uses the {"≥"}5% bootstrap threshold with no correction for the number of analyses you run.</p></div>
    <table><thead><tr><th>Index change</th><th className="num">Coefficient</th></tr></thead><tbody>{s.coefficients.map((c2) => <tr key={c2.name}><td>{c2.name.replace("da_L", "ΔNASCDI, lag ")}</td><td className="num">{fmt(c2.coef, 5)}</td></tr>)}</tbody></table>
  </div>);
}

function Model({ m, kind, r }) {
  if (!m) return null; if (m.error) return <div className="err">{m.error}</div>;
  const b = m.bounds, s = m.symmetry;
  return (<div className="stack">
    <div><span className={`chip ${m.category}`}>{m.category}</span> <span className="small muted">{VERDICT[m.category]}</span></div>
    <div className="facts">
      <div className="fact"><b>{fmt(m.ect.coef)}</b><span>error-correction coefficient (95% HAC: {fmt(m.ect.lo, 2)} to {fmt(m.ect.hi, 2)})</span></div>
      <div className="fact"><b>{m.halfLife ? m.halfLife.toFixed(1) + " wk" : "–"}</b><span>half-life of adjustment</span></div>
      <div className="fact"><b>{m.n}</b><span>weeks used; lags (p,q,r) = ({m.lags.p},{m.lags.q},{m.lags.r})</span></div>
      <div className="fact"><b>{fmt(m.r2, 2)}</b><span>R² of the differenced equation</span></div>
    </div>
    <table><thead><tr><th>Bounds test</th><th className="num">Statistic</th><th className="num">5% lower</th><th className="num">5% upper</th><th>Beyond upper?</th></tr></thead><tbody>
      <tr><td>F (lagged levels)</td><td className="num">{fmt(m.F, 2)}</td><td className="num">{fmt(b.F_lo, 2)}</td><td className="num">{fmt(b.F_hi, 2)}</td><td>{m.F > b.F_hi ? "yes" : "no"}</td></tr>
      <tr><td>t (error correction)</td><td className="num">{fmt(m.t, 2)}</td><td className="num">{fmt(b.t_lo, 2)}</td><td className="num">{fmt(b.t_hi, 2)}</td><td>{m.t < b.t_hi ? "yes" : "no"}</td></tr></tbody></table>
    <p className="small muted" style={{ margin: 0 }}>Critical values are simulated for this equation’s sample size and lag structure ({r.input.boundsReps.toLocaleString()} replications, unrestricted intercept). They differ from the tabulated asymptotic values in small samples.</p>
    <h3>Long-run coefficients (delta method, HAC)</h3>
    <table><thead><tr><th>Term</th><th className="num">Coefficient</th><th className="num">s.e.</th></tr></thead><tbody>{Object.entries(m.longRun).map(([k, v]) => <tr key={k}><td>{k.replace("_L1", "")}</td><td className="num">{fmt(v.theta)}</td><td className="num">{fmt(v.se)}</td></tr>)}</tbody></table>
    {s && (<>
      <h3>Symmetry tests (equal long-run and short-run response to rises and falls)</h3>
      <table><thead><tr><th>Hypothesis</th><th className="num">Wald</th><th className="num">p (HAC)</th><th className="num">p (wild bootstrap)</th></tr></thead><tbody>
        {[["Long-run", s.longRun], ["Short-run", s.shortRun], ["Joint", s.joint]].map(([l, v]) => <tr key={l}><td>{l}</td><td className="num">{fmt(v.wald, 2)}</td><td className="num">{fmtP(v.pHAC)}</td><td className="num">{fmtP(v.pBoot)}</td></tr>)}</tbody></table>
      <p className="small" style={{ margin: 0 }}>Final specification (restrictions not rejected at 5% by the bootstrap are imposed): <b>{s.final}</b>.</p>
      {m.identification && Math.abs(m.identification.corrPN) > 0.95 && <div className="warn">The positive and negative partial sums are almost perfectly correlated here (r = {fmt(m.identification.corrPN, 4)}), so long-run asymmetry cannot be separately identified and the long-run test has little power. Prefer the short-run test or the level specification.</div>}
    </>)}
    <details><summary>All coefficients (HAC standard errors)</summary><div className="scroll"><table><thead><tr><th>Term</th><th className="num">Coef.</th><th className="num">s.e.</th><th className="num">t</th></tr></thead><tbody>{m.coefficients.map((c) => <tr key={c.name}><td>{c.name}</td><td className="num">{fmt(c.coef, 4)}</td><td className="num">{fmt(c.se, 4)}</td><td className="num">{fmt(c.t, 2)}</td></tr>)}</tbody></table></div></details>
  </div>);
}

export default function Results({ r }) {
  const tabs = [["overview", "Overview"], ...(r.shortRun ? [["short", "Short run"]] : []), ...["nardl", "level", "prices"].filter((k) => r.models[k]).map((k) => [k, NAMES[k]]), ["notes", "Limits & export"]];
  const [tab, setTab] = useState("overview");
  const download = () => { const blob = new Blob([JSON.stringify({ ...r, series: undefined }, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "nascdi-explorer-results.json"; a.click(); URL.revokeObjectURL(a.href); };
  return (
    <section className="card" aria-label="Results">
      <h2>3 · Results</h2>
      {r.warnings.map((w, i) => <div className="warn" key={i} style={{ marginBottom: 8 }}>{w}</div>)}
      <div className="tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className="tab" onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === "overview" && <Overview r={r} />}
      {tab === "short" && <ShortRun r={r} />}
      {["nardl", "level", "prices"].includes(tab) && <Model m={r.models[tab]} kind={tab} r={r} />}
      {tab === "notes" && (<div className="stack">
        <h3>What these results can and cannot say</h3>
        <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>{r.caveats.map((c, i) => <li key={i}>{c}</li>)}
          <li>In the application that this tool grew out of (Kashmir apple prices, eight market chains), the index terms were not jointly significant in any chain’s error-correction equation, and evidence of a long-run price relationship was weak. Do not expect a strong result by default.</li>
          <li>Several analyses on one dataset raise the chance of a false positive. Treat a single p-value just below 0.05 with caution.</li></ul>
        <button className="secondary" onClick={download}>Download results (JSON)</button>
        <p className="small muted" style={{ margin: 0 }}>Reproducibility: random seed {r.input.seed}; {r.input.bootstrapB} bootstrap draws; the same data and settings give the same numbers.</p>
      </div>)}
    </section>
  );
}
