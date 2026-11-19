import React, { useEffect, useState } from "react";
import { getIndex, runAnalysis } from "./api.js";
import AuditPanel from "./components/AuditPanel.jsx";
import UploadPanel from "./components/UploadPanel.jsx";
import Results from "./components/Results.jsx";

export default function App() {
  const [index, setIndex] = useState(null), [loadErr, setLoadErr] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(null), [result, setResult] = useState(null);
  useEffect(() => { getIndex().then(setIndex).catch((e) => setLoadErr(e.message)); }, []);
  const onRun = async (file, mapping, options) => {
    setBusy(true); setError(null);
    try { const r = await runAnalysis(file, mapping, options); setResult(r); setTimeout(() => document.getElementById("results-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="wrap">
      <header className="top">
        <h1>NASCDI Explorer</h1>
        <p>Test whether a news-based index of Kashmir–Delhi highway (NH-44) disruption relates to your own price or market series. Upload a CSV, and the tool aligns it to the weekly index and runs the error-correction and bounds tests used in the accompanying paper.</p>
      </header>
      {loadErr && <div className="err" role="alert">{loadErr}</div>}
      <div className="grid">
        <div><UploadPanel onRun={onRun} busy={busy} error={error} /></div>
        <div>
          <div id="results-anchor" />
          {result && <Results r={result} />}
          <AuditPanel index={index} userRange={result ? { from: result.input.from, to: result.input.to } : null} />
          <p className="notice" style={{ marginTop: 14 }}>The NASCDI is built from GDELT GKG metadata (public). It measures corridor-related news, not road closures, and has not been validated against administrative closure records. Methods and limits are described in the paper; this tool is for research use and is not an early-warning or insurance product.</p>
        </div>
      </div>
    </div>
  );
}
