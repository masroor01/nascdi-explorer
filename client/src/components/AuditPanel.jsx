import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceArea, ReferenceLine } from "recharts";

const tickEvery = (n) => Math.max(1, Math.floor(n / 6));
export default function AuditPanel({ index, userRange }) {
  if (!index) return <section className="card" aria-busy="true"><h2>Index audit</h2><p className="muted">Loading the index…</p></section>;
  const { meta, audit, weeks } = index; const data = weeks.map((w) => ({ d: w.d, v: w.v, n: w.n }));
  const yearTick = (d) => d.slice(0, 4);
  const shade = userRange ? <ReferenceArea x1={userRange.from} x2={userRange.to} fill="var(--navy)" fillOpacity={0.12} /> : null;
  return (
    <section className="card" aria-label="Index audit">
      <h2>Index audit <span className="chip Inconclusive" title="Always shown beside results">always on</span></h2>
      <p className="small muted" style={{ marginTop: 0 }}>The index is only as reliable as the news records behind it. An earlier version of this index was built from an incomplete extract; this panel shows what the current one rests on.</p>
      <div className="facts">
        <div className="fact"><b>{meta.weeks}</b><span>weekly values, {meta.range[0].slice(0, 4)}–{meta.range[1].slice(0, 4)}</span></div>
        <div className="fact"><b>{(meta.qualifying_records / 1e6).toFixed(2)} M</b><span>qualifying records ({(meta.scored_articles / 1e6).toFixed(2)} M scored)</span></div>
        <div className="fact"><b>{audit.empty_days.length}</b><span>days without a qualifying record</span></div>
        <div className="fact"><b>p = {audit.breaks.index.p}</b><span>mean-shift test on the index (no break)</span></div>
      </div>
      <h3>Weekly NASCDI {userRange ? <span className="muted small">(shaded: your data)</span> : null}</h3>
      <div className="chart" style={{ height: 190 }}>
        <ResponsiveContainer><LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" /><XAxis dataKey="d" tickFormatter={yearTick} interval={tickEvery(data.length) * 4} tick={{ fontSize: 11, fill: "var(--muted)" }} /><YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "var(--muted)" }} width={38} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", fontSize: 12 }} labelStyle={{ color: "var(--ink)" }} />
          {shade}<Line type="monotone" dataKey="v" name="NASCDI" stroke="var(--navy)" dot={false} strokeWidth={1.2} isAnimationActive={false} />
        </LineChart></ResponsiveContainer>
      </div>
      <h3 style={{ marginTop: 10 }}>Qualifying records per week (log scale)</h3>
      <div className="chart" style={{ height: 170 }}>
        <ResponsiveContainer><LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" /><XAxis dataKey="d" tickFormatter={yearTick} interval={tickEvery(data.length) * 4} tick={{ fontSize: 11, fill: "var(--muted)" }} /><YAxis scale="log" domain={[300, "auto"]} allowDataOverflow tick={{ fontSize: 11, fill: "var(--muted)" }} width={44} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", fontSize: 12 }} />
          {shade}<ReferenceLine x="2020-10-04" stroke="var(--muted)" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="n" name="Records" stroke="var(--green)" dot={false} strokeWidth={1.2} isAnimationActive={false} />
        </LineChart></ResponsiveContainer>
      </div>
      <ul className="small" style={{ paddingLeft: 18, marginBottom: 6 }}>
        <li>Record volume roughly halves in October 2020 (break in the log weekly count, p = {audit.breaks.record_count.p}); the index, an average of article scores, does not shift.</li>
        {audit.notes.map((n, i) => <li key={i}>{n}</li>)}
        <li>Scoring: {meta.lexicon_terms}-term severity lexicon with a corridor and commodity gate; weekly mean of a daily z-scored mean (mean 100, SD 10).</li>
      </ul>
      <details><summary>Records and empty days by year</summary>
        <div className="scroll"><table><thead><tr><th>Year</th><th className="num">Days</th><th className="num">No-record days</th><th className="num">Records</th><th className="num">Mean index</th></tr></thead>
          <tbody>{audit.by_year.map((r) => <tr key={r.year}><td>{r.year}</td><td className="num">{r.days}</td><td className="num">{r.empty_days}</td><td className="num">{r.records.toLocaleString()}</td><td className="num">{r.mean_index.toFixed(1)}</td></tr>)}</tbody></table></div>
      </details>
    </section>
  );
}
