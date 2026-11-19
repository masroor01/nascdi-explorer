async function post(url, form) {
  const r = await fetch(url, { method: "POST", body: form });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
  return body;
}
export const getIndex = async () => { const r = await fetch("/api/index"); if (!r.ok) throw new Error("Could not load the NASCDI index."); return r.json(); };
export const getColumns = (file) => { const f = new FormData(); f.append("file", file); return post("/api/columns", f); };
export const runAnalysis = (file, mapping, options) => { const f = new FormData(); f.append("file", file); f.append("mapping", JSON.stringify(mapping)); f.append("options", JSON.stringify(options)); return post("/api/analyze", f); };
export const fmt = (v, d = 3) => (v === null || v === undefined || Number.isNaN(v) ? "–" : Number(v).toFixed(d).replace("-", "−"));
export const fmtP = (p) => (p === null || p === undefined || Number.isNaN(p) ? "–" : p < 0.001 ? "<0.001" : p.toFixed(3));
