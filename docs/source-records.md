# Public source records

`src/source-records.js` provides a standalone browser module, exposed as
`window.KnowHowSourceRecords` and as CommonJS for tests. It reads no scenario
storage, authentication state, organization API, or AI endpoint.

## What is preserved

- Three bundled fictional originals: a policy memo, department table explanation,
  and owner reply. Stable IDs are `sample-policy-v1`,
  `sample-department-table-v1`, and `sample-reply-v1`.
- Two optional conflicting policy examples from `conflictCatalog()`, with IDs
  `sample-conflict-screen-v1` and `sample-conflict-logs-v1`. Their target and
  effective period match; neither is selected as authoritative.
- A user-selected UTF-8 TXT/MD file of at most 64 KiB and 2,000 lines. File name,
  original text, original bytes, SHA-256 of those bytes, intake timestamp, line
  numbers, paragraphs, and provenance remain available in the current tab.
- File intake creates an unverified draft. Corrections add a separate draft
  version with a reason; they never alter the source record or its bytes.

Samples are previewable before intake, clearly marked as uncollected. Only an
explicit intake button records a collection timestamp and hash. Repeated intake
of an existing sample, or the same file name and bytes, preserves the first intake
and any draft corrections. Timestamps describe local intake, not document
publication, business validity, or collection from an external service.

All source state and drafts live in the store's memory. They survive scenario
navigation when the parent retains the store, and disappear on refresh or tab
close. They are not written to `localStorage`, `sessionStorage`, organizational
KB, or any server. Original bytes can be downloaded using a browser Blob.

## Integration contract

```js
const sources = KnowHowSourceRecords;
const store = sources.createStore(); // once per page, outside scenario renders
const view = sources.mount(container, {store, department: 'app'});
const refs = sources.citationsFor({department: 'app', category: 'guide', version: 1});
view.openCitation(refs[0]); // preview only; does not collect implicitly
// Before replacing the parent view:
view.destroy();
```

`category` is `policy`, `data`, or `guide`; `department` is `app` or `device`.
`citationsFor()` returns source IDs, line ranges, human labels, and the initial
version. For version 2 or later, the link and source viewer explicitly identify
the original as initial example evidence, not support for the latest correction.
Each optional conflict original provides its own `.citation`.

Use `renderSourceLink(ref, label?)` for escaped button markup and
`bindCitationLinks(container, {onOpen: ref => view.openCitation(ref)})` for delegated
events; the binder returns a cleanup function. The parent should open its source
panel before calling `openCitation`. A mount handles its own renders and local
events. The shared store should not be recreated on every scenario render.

The store exposes `collectSamples()`, `collectSample(id)`, `importFile(file)`,
`createDraft(input)`, `reviseDraft(id, {content, reason})`, `resolveCitation(ref)`,
`getRecord(id)`, `listRecords()`, `getDraft(id)`, `listDrafts()`,
`originalBytes(id)`, `clear()`, and `subscribe(listener)`.
Returned records, drafts, citations, and bytes are defensive copies.

`rawText` retains original UTF-8 text including BOM and original line endings.
The line and paragraph index uses normalized line separators only for excerpts.
HTML display also normalizes CRLF as required by the browser's HTML parser;
original bytes and the download retain the original CRLF/BOM exactly.
No Markdown or HTML from a file is executed.

## Verification

```sh
node --test tests/source-records.cjs
node tests/source-records-browser.cjs
```

The browser check requires Playwright and Chromium or installed Google Chrome.
It starts its own localhost fixture, performs no organization/AI calls, and writes
only synthetic evidence under `tests/evidence/source-records/`. An alternative
output directory can be set with `SOURCE_RECORDS_EVIDENCE_DIR`.

Verified on 2026-09-21: all 18 unit tests passed. Headless Chrome passed explicit
sample intake, citation highlighting, both conflicting originals, real browser
File reading, original SHA-256 and exact downloaded bytes, literal HTML display,
draft v1→v2 with unchanged original, unchanged existing scenario storage, zero
fetch/XHR attempts, and refresh clearing. Desktop 1280px and mobile 390px renders
were inspected; mobile has no horizontal page overflow.

See `tests/evidence/source-records/report.json`, `desktop.png`, and `mobile.png`.
The UI integration task separately verified the integrated source links, intake,
line selection, and source preservation in its browser session.
