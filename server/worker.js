import { parentPort, workerData } from "node:worker_threads";
import { analyze } from "./analyze.js";
try { parentPort.postMessage({ ok: true, result: analyze(workerData) }); } catch (e) { parentPort.postMessage({ ok: false, error: e.message || "Analysis failed." }); }
