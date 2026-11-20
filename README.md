# NASCDI Explorer

A small web app for the NASCDI paper (news-based corridor disruption index, Kashmir apple supply chain).
Upload a CSV with a date column and one or two numeric series (for example a farm-gate price and a terminal price);
the app aligns it to the weekly NASCDI and runs the analyses used in the paper.

**What it does**
- Audit panel (always visible): record counts, empty days, the 2025 source gap, the October 2020 volume break.
- Descriptive diagnostics: overlay, lag correlations of weekly changes, gaps, repeated values.
- Short-run effect of index changes (first-difference regression, wild-bootstrap p-values, detectable effect).
- NARDL / ECM with PSS bounds tests (finite-sample critical values simulated per equation), per-equation lag selection
  (AIC, Breusch-Godfrey check), HAC inference, restricted wild-bootstrap symmetry tests.

**What it does not do**: it is not an early-warning or insurance tool, it makes no policy recommendations, and it does not
establish causal effects. The index has not been validated against closure records.

## Run locally
```
npm run install:all
npm run build        # builds client/dist
npm start            # http://localhost:3001
npm test             # validates the Node engine against the Python results
```
Development with hot reload: `npm run dev:server` in one terminal and `npm run dev:client` in another (client on :5173 proxies /api).

## Deploy on Render
Push this folder to a Git repository and create a **Blueprint** on Render pointing at it (`render.yaml`). The blueprint defines one
free web service (Node 22) that builds the client and serves it together with the API. No environment variables are needed.

## Data handling
Uploaded files are held in server memory only for the length of one request (3 MB limit, 60,000 rows), processed in a worker thread
with a 90-second limit, and discarded. Nothing is written to disk or logged. API requests are rate-limited.

## Index data
`server/data/index.json` holds the weekly NASCDI (rebuilt from the complete GDELT GKG extract, 2015-02 to 2025-12; 2,916,923 scored
articles, 1,641,604 qualifying) and the audit statistics. GDELT is public. Re-export this file whenever the index is rebuilt.

## Validation
`server/test/validate.js` runs a synthetic dataset through the Node engine and compares with the Python (statsmodels) pipeline that
produced the paper's tables: sample size, selected lags, error-correction coefficient, F and t statistics, HAC p-values and the
short-run regression agree to 4+ decimals; simulated bounds and bootstrap p-values agree within simulation error. On the paper's own
chains (not shipped; the price registers are not public) Shopian-Delicious A and Sopore-American B reproduce Table 6.
The example file is synthetic.

## Free hosting notes (Render free web service)
- Free services sleep after 15 minutes without traffic and take about a minute to wake on the next visit; 750 free instance hours per month
  are enough for one always-available service. The first visit after a quiet period will be slow.
- Free instances have a small share of a CPU and 512 MB of memory. The default of 499 bootstrap draws keeps a typical analysis in seconds
  locally; on the free tier choose 199-499 draws for long series, and use 999-1,999 only when you can wait.
- Upgrading the service removes sleeping; nothing else needs to change.

## Licence
Code: MIT (see `LICENSE`). The index values in `server/data/index.json` are derived from public GDELT metadata; please cite the accompanying paper when using them.
