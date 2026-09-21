# Data platform intake and policy UI handoff

The data workspace is implemented in `src/data-platform.js`, `src/data-explorer.js`, `src/data-review-ui.js`, `src/data-handoff-ui.js`, `src/data-lineage-ui.js`, and `src/data-platform.css`. The shared shell owns its routes and navigation; index and build configuration explicitly include each data module.

## Shell integration

Load `data-platform.css` after shared styles. Load `data-review-ui.js` and `data-handoff-ui.js` before `data-platform.js`; `data-explorer.js` also precedes the platform controller. Include all three new assets in the build allowlist and content-hash loop.

Routes call the existing `KnowHowDataPlatform.createController().mount(target, {section})` contract:

| Hash | Section | Legacy alias |
| --- | --- | --- |
| `#data` | `intake` or `jobs` | unchanged |
| `#data-privacy` | `privacy` | `#data-datasets` / `datasets` |
| `#data-policies` | `policies` | `#data-mart` / `mart` |
| `#data-lineage` | `lineage` | new read-only graph |

The shell owns the left navigation. The data page does not duplicate it with a second step navigation. Advanced aggregation remains available within the policy/result screen.

## Recorded data lineage

`data-lineage-ui.js` is loaded before the data controller and included in the build allowlist. The new left-navigation route reads `GET /{scope}/lineage?department=data&dataset_id=...` using the existing in-memory session. Opening a fresh tab creates no session or records. With an existing session, the selected dataset's connected family is loaded; selecting the empty filter shows the current scoped records. Department changes re-fetch the graph without opting into company-wide documents.

The graph displays actual dataset, run, KB binding and retained conversation-evidence records. It does not infer an applied policy from search results, or usage from a KB link. Run states remain separate from published dataset results. Policy identities and versions are shown only when the server permits access; hidden policy references are described as unavailable in the selected department. General preview/export history, usage timestamps and historical evidence versions are not recorded and are not reconstructed. Truncated results limit every absence statement to the displayed range.

Cards are native keyboard buttons with arrow/Home/End navigation and accessible selected state. Actual directed edges are accompanied by a textual connection list. Desktop uses four columns and mobile uses a vertical flow. Details open the existing source/result explorer or resolve the current KB document through the same visitor API. Lineage uses stored source metadata; the normal KB document endpoint keeps its stronger current-original validation. The graph introduces no model or embedding requests.

Run `node tests/data-lineage-ui.cjs` for rendering contracts. For actual local HTTP/Worker/SQLite/browser verification, run `python tests/data-lineage-local-api.py --api-repo ../ctrl-j-data-lineage` and then `node tests/data-lineage-live-browser.cjs` with Playwright available. The loopback harness uses disposable stores, rejects provider calls, and uploads explicitly synthetic CSV values through the real API. Reports and screenshots default to `/tmp/knowhow-data-lineage-live`; API response bodies are not stubbed and credentials are never saved to evidence. Production deployment remains coordinated by the hub.

## Real intake

The initial view performs no fetch and creates no jobs. An explicit import opens `/visitor/sessions`, retains its Bearer token only in controller memory, and uses `/visitor/` endpoints consistently for jobs, data, query, partitions, versions, export and original downloads. Switching to shared synthetic examples clears the displayed private state and sends no visitor token to `/demo/` endpoints. Returning to private intake reuses that controller's visitor session; reloading the app loses the in-memory session.

The environmental charger CTA starts a fresh source discovery against `https://ev.or.kr/nportal/monitor/evMapExcel.do`. File sources continue to ingest the downloaded snapshot, with `{preset:'charger'}` for this preset. HTML discovery pauses for explicit table selection. Public Sheets uses source kind `sheets`; binary uploads use `/visitor/uploads` with file format/name query parameters.

Only server-observed bytes and rows appear in progress. Unknown totals produce indeterminate progress, never random counters or invented percentages. Discovery completion is separate from RAW publication. RAW completion requires a succeeded job, dataset identity, row count, original file and source SHA. Completed data opens immediately in the bounded server explorer; it does not accumulate all rows in the browser. CSV and original downloads use authenticated requests, never tokens in URLs. Previously stored results are explicitly labeled as prior results rather than fresh downloads.

## Privacy and policy contract

- `POST /visitor/datasets/{id}/privacy-review {generate:false}`: explicit profile/policy lookup.
- The separate AI button is the only UI path that sends `generate:true`.
- The explicit example-policy button additionally sends `seed_demo:true`. Returned synthetic policy documents remain labeled as examples.
- The review is a durable job. On completion, the UI uses `job.result.review_id` to fetch `GET /visitor/privacy-reviews/{review_id}`; it does not trust cached policy bodies in job history.
- A review-backed processing form exposes only column/action decisions. `POST .../privacy-apply` receives `{review_id,decisions:[{column,action}],name,idempotency_key}`. Raw rows, preview values and policy text are never included in the model request from the UI.
- With no review, the existing manual transform engine remains available, including type conversion, rename, trim, deduplication and error handling.
- `GET /visitor/datasets/{result_id}/privacy-result?review_id=...` supplies actual application counts and source policy versions. Policy documents with no `applications` are not labeled as applied. Human changes with empty policy refs remain human decisions.
- Server errors, expired sessions and stale policy versions remain visible. Failed processing never appears as an applied policy.

## Verification and limits

Run tests with the configured Node runtime and Playwright. `tests/data-intake-browser.cjs` is an explicitly labeled fixture integration check, not external-source evidence. `tests/data-intake-state.cjs` verifies dataset boundaries, transient completion recovery, and model payload separation. `tests/data-review-ui.cjs` verifies policy and execution status rendering. `tests/data-intake-live-browser.cjs` covers real local API operations with actual uploaded test files and public HTML, and `tests/data-ev-live-browser.cjs` performs a fresh public environmental Excel download. The live scripts preserve API responses rather than stubbing success.

No production deployment, push, account keys, or paid generation is part of this branch. The hub must combine this branch with the visitor API and shared shell changes before publishing. Data source availability and large-file duration remain external conditions; live measurements apply only to the tested local API environment.

### Observed live environmental import

The local real-API browser run completed a fresh 46,014,290-byte source download and stored 520,973 RAW rows with 17 columns. Server searches returned 80,964 rows for 서울, 6,880 for 강남, and 10 for GS타워. The explorer displayed at most 50 rows per request and remained within the 390px mobile viewport. See `tests/evidence/data-ev-live/report.json` for timestamps, source SHA, observed progress and the exact tested local API. This is a local execution measurement, not a production capacity guarantee.

## Selected RAW row → department context

Charger-shaped visitor RAW results offer a collapsed handoff panel. Explicit `station-search` returns server row numbers; the visitor chooses up to three rows and an app/device department. `station-contexts` receives only those numbers and the department. The module checks the returned dataset, department, row selection, source and expiry before calling the company screen's Promise-based `window.KnowHowCompanyLive.open({apiBase,visitorBearer,contextId})` (or compatible `KnowHowCompany.openVisitorContext`). The bearer stays in JavaScript memory; no credential or context is written into a URL, storage, or evidence log. The company screen must re-resolve the server context before navigation. Without that callback the UI reports that the connection is unavailable and retains the selected original. No client station claim or internal charger ID is invented.

The small-file live run additionally verified a 5,228-byte XLSX upload (2 rows, 4 columns) with matching upload/server/download SHA, a 233,047-byte public HTML page (2 detected tables; the selected table stored as 6 RAW rows), and a 3-row CSV processed through the privacy engine. Policy lookup was `generate:false`: all three returned example policies remained unlinked search evidence rather than falsely showing confirmed application. Cross-visitor preview, original and privacy-result requests returned 404. No paid or real model generation was exercised.
