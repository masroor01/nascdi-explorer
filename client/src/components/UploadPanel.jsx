import React, { useState } from "react";
import { getColumns } from "../api.js";

export default function UploadPanel({ onRun, busy, error }) {
  const [file, setFile] = useState(null), [cols, setCols] = useState(null), [msg, setMsg] = useState(null);
  const [m, setM] = useState({ date: "", y: "", x: "" });
  const [o, setO] = useState({ log: true, dayFirst: true, bootstrapB: 499, models: { nardl: true, level: true, prices: true, shortrun: true, diagnostics: true } });
  const load = async (f) => {
    setFile(f); setCols(null); setMsg(null); if (!f) return;
    try {
      const c = await getColumns(f); setCols(c); const lower = c.names.map((n) => n.toLowerCase()); const di = Math.max(0, lower.findIndex((n) => /date|week|day|time/.test(n)));
      const rest = c.names.filter((_, i) => i !== di); setM({ date: c.names[di], y: rest[0] || "", x: rest[1] || "" });
    } catch (e) { setMsg(e.message); }
  };
  const example = async () => { const r = await fetch("/example-synthetic.csv"); const b = await r.blob(); await load(new File([b], "example-synthetic.csv", { type: "text/csv" })); };
  const setModel = (k) => (e) => setO({ ...o, models: { ...o.models, [k]: e.target.checked } });
  const run = () => onRun(file, { date: m.date, y: m.y, x: m.x || null }, { ...o, models: { ...o.models, prices: o.models.prices && !!m.x } });
  return (
    <section className="card" aria-label="Upload your data">
      <h2>1 · Your data</h2>
      <div className="stack">
        <div><label htmlFor="f">CSV file with a date column and one or two numeric series</label><input id="f" type="file" accept=".csv,.tsv,.txt" onChange={(e) => load(e.target.files[0])} />
          <p className="small" style={{ margin: "6px 0 0" }}>No data to hand? <button type="button" className="secondary" style={{ padding: "3px 8px", fontWeight: 500 }} onClick={example}>Load a synthetic example</button></p></div>
        {msg && <div className="err" role="alert">{msg}</div>}
        {cols && (<>
          <div><label htmlFor="d">Date column</label><select id="d" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })}>{cols.names.map((n) => <option key={n}>{n}</option>)}</select></div>
          <div><label htmlFor="y">Series to explain (e.g. farm-gate price)</label><select id="y" value={m.y} onChange={(e) => setM({ ...m, y: e.target.value })}>{cols.names.filter((n) => n !== m.date).map((n) => <option key={n}>{n}</option>)}</select></div>
          <div><label htmlFor="x">Second series (optional: e.g. terminal-market price)</label><select id="x" value={m.x} onChange={(e) => setM({ ...m, x: e.target.value })}><option value="">none</option>{cols.names.filter((n) => n !== m.date && n !== m.y).map((n) => <option key={n}>{n}</option>)}</select></div>
          <label className="check"><input type="checkbox" checked={o.log} onChange={(e) => setO({ ...o, log: e.target.checked })} /><span>Use natural logs<small>Recommended for prices; values must be positive.</small></span></label>
          <label className="check"><input type="checkbox" checked={o.dayFirst} onChange={(e) => setO({ ...o, dayFirst: e.target.checked })} /><span>Dates are day first (DD/MM/YYYY)<small>Untick for MM/DD/YYYY. YYYY-MM-DD is always read correctly.</small></span></label>
          <p className="small muted" style={{ margin: 0 }}>{cols.rowCount.toLocaleString()} rows read. Daily values are averaged to weeks ending on Sunday, as the index is.</p>
        </>)}
      </div>
      {cols && (<div className="stack" style={{ marginTop: 16 }}>
        <h2 style={{ marginBottom: 0 }}>2 · What to run</h2>
        <label className="check"><input type="checkbox" checked={o.models.diagnostics} onChange={setModel("diagnostics")} /><span>Descriptive diagnostics<small>Overlay, lag correlations, data gaps and repeated values.</small></span></label>
        <label className="check"><input type="checkbox" checked={o.models.shortrun} onChange={setModel("shortrun")} /><span>Short-run effect of index changes<small>First-difference regression, five lags, bootstrap p-values.</small></span></label>
        <label className="check"><input type="checkbox" checked={o.models.nardl} onChange={setModel("nardl")} /><span>NARDL with bounds test<small>Positive and negative partial sums; symmetry tests.</small></span></label>
        <label className="check"><input type="checkbox" checked={o.models.level} onChange={setModel("level")} /><span>ECM with the index as a level<small>The partial sums are collinear in the paper; this avoids them.</small></span></label>
        <label className="check"><input type="checkbox" checked={o.models.prices && !!m.x} disabled={!m.x} onChange={setModel("prices")} /><span>Prices only (no index)<small>Cointegration of the two series. Needs a second series.</small></span></label>
        <div><label htmlFor="b">Bootstrap draws</label><select id="b" value={o.bootstrapB} onChange={(e) => setO({ ...o, bootstrapB: Number(e.target.value) })}><option value={199}>199 (quick)</option><option value={499}>499</option><option value={999}>999</option><option value={1999}>1,999 (as in the paper)</option></select></div>
        {error && <div className="err" role="alert">{error}</div>}
        <button className="primary" onClick={run} disabled={busy || !m.y}>{busy ? <><span className="spin" aria-hidden="true" />Running…</> : "Run analysis"}</button>
      </div>)}
      <p className="notice" style={{ marginTop: 14 }}><b>Data handling.</b> Your file is read into server memory for the length of the request, analysed, and discarded. It is not saved, logged or shared. Results are not stored: download them if you want to keep them.</p>
    </section>
  );
}
