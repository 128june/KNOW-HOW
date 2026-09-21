# KB document presentation

The KB list, selected document and review evidence use the same document heading, metadata and review field patterns. The source data and workflow handlers are unchanged.

- Titles lead with the department and displayed scope. Dates are recorded application periods, not a claim that a policy currently applies.
- Current judgment is separate from review completion and company sharing. An `unknown` current review uses an amber accent and keeps its conditions, unknowns and next action visible. No current validated review means no current judgment is invented.
- Current document and approved shared version remain separate. Selected detail metadata is read only from that returned document.
- Excerpts are labeled; complete original bodies and history are still reachable through native `details`. General fictional examples show their current original by default and explicitly label the prepared explanation.
- Missing comment author roles display as unknown. Missing policy dates, reasons, sharing metadata and comments keep their unknown states.

Styles live at the end of `src/style.css` and target KB containers only. The shell, navigation, intake, lineage, API contracts and inquiry handoff contents are outside this change. Desktop/mobile header heights stay 48/56px.

## Local verification

Run the existing VM tests with Node: `inquiry-handoff`, `inquiry-mode`, `organization-selected-version`, `organization-kb`, `company-sharing`, `company-sharing-transport`, `company-live`, `company-human-review`, `company-policy-display`, `kb-review-history`, `company-provenance`, `company-applicability`, `company-revision-version`, `company-mapping-revision`, `company-identity`, `company-selection`, `company-navigation`, `general-readable`, `general-examples`, and `platform-workflows` in `tests/*.cjs`.

`python3 tools/build.py` builds the static artifact. `tests/kb-review-history-browser.cjs` is the earlier browser regression suite.

The new comparison runner uses Playwright with installed Google Chrome:

```sh
NODE_PATH=/path/to/node_modules KB_VISUAL_EVIDENCE_DIR=/path/to/evidence node tests/kb-visual-browser.cjs
```

It serves baseline `00807e345e7a07dcc9750cc2550d7e9b11e8b85f` from git and the current source on loopback, blocks all other browser requests, and keeps AI requests paused. It replays preserved fixtures and an earlier local policy API response. `KB_VISUAL_PHASE=before` or `after` limits the run; default is both.

The 1440/390/320px checks cover current/old exact bodies, source SHA, keyboard disclosure access, held-but-reviewed state, current v3/shared v2, review/share pending, missing/empty body, long ID/title, multiple comments, shared scope, fictional examples and recorded policy. Stress inputs are synthetic display cases, not real policy assertions. This is local UI verification, not production API/deployment certification.
