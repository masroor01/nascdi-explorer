import express from "express";
import multer from "multer";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { publicIndex, columnsOf } from "./analyze.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express(); const PORT = process.env.PORT || 3001;
const MAX_BYTES = 3 * 1024 * 1024, MAX_JOBS = 2, JOB_TIMEOUT_MS = 90_000;
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", "data:"], connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'self'"] } } }));
app.use(compression());
app.use("/api/", rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: "Too many requests. Please wait a minute." } }));
// Uploads are held in memory only, never written to disk, never logged.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 }, fileFilter: (_req, file, cb) => (/\.(csv|txt|tsv)$/i.test(file.originalname) ? cb(null, true) : cb(new Error("Upload a .csv, .tsv or .txt file."))) });

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/index", (_req, res) => { res.set("Cache-Control", "public, max-age=3600"); res.json(publicIndex()); });
app.post("/api/columns", upload.single("file"), (req, res) => {
  try { if (!req.file) throw new Error("No file received."); res.json(columnsOf(req.file.buffer.toString("utf8"))); } catch (e) { res.status(400).json({ error: e.message }); }
});
let running = 0;
app.post("/api/analyze", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file received." });
  if (running >= MAX_JOBS) return res.status(503).json({ error: "The server is busy with other analyses. Try again in a minute." });
  let mapping, options; try { mapping = JSON.parse(req.body.mapping || "{}"); options = JSON.parse(req.body.options || "{}"); } catch { return res.status(400).json({ error: "Invalid request." }); }
  running++; let done = false;
  const worker = new Worker(path.join(here, "worker.js"), { workerData: { csvText: req.file.buffer.toString("utf8"), mapping, options }, resourceLimits: { maxOldGenerationSizeMb: 256 } });
  const finish = (fn) => { if (done) return; done = true; running--; clearTimeout(timer); fn(); };
  const timer = setTimeout(() => { worker.terminate(); finish(() => res.status(408).json({ error: "The analysis took too long. Use fewer bootstrap draws or a shorter series." })); }, JOB_TIMEOUT_MS);
  worker.once("message", (m) => finish(() => (m.ok ? res.json(m.result) : res.status(400).json({ error: m.error }))));
  worker.once("error", () => finish(() => res.status(500).json({ error: "The analysis failed on the server." })));
});
app.use((err, _req, res, next) => { if (!err) return next(); res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "File too large (limit 3 MB)." : err.message }); });

const dist = path.join(here, "..", "client", "dist");
if (existsSync(dist)) { app.use(express.static(dist, { maxAge: "1h" })); app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html"))); }
app.listen(PORT, () => console.log(`NASCDI Explorer listening on ${PORT}`));
