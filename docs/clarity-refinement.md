# Reading hierarchy refinement — 2026-09-22

Follow-up to c269ec9/a899fd2, tested against the combined general workflow and input KB implementations in an isolated preview. No submission or goal logs changed.

## Changes

- Compact existing introductions, tabs and query controls. At 1280px the general result begins around y=553, with the same 48px app header; mobile keeps its 56px header.
- Align actions to blue, links and connected knowledge to jade, provisional states to dashed amber. Empty candidate lists do not receive pending-card styling.
- Readable contract IDs, version/source labels, row details, request quotations and review states. Correct missed contrast, input boundaries and mobile input sizing; tablet metrics use two columns.
- Home relationship/evidence/next-action hierarchy, lighter repeated containers, KB identity and document reading rhythm.
- Support sidebar announces its current page; user-triggered KB refresh restores keyboard focus.

## Validation

Seven routes (#home, #general-1/2/3, #data, #support, #support-kb), each at 1280, 768 and 390px: 21 layouts, no horizontal overflow. Actual computed text foreground/background contrast audit had no detected failures on those rendered pages; this is not a full WCAG certification.

Navigation unit tests 6/6; catalog tests 9/9; build configuration tests 4/4. Syntax checks and git diff --check passed. Browser checks: mobile menu/Escape/opener, native KB dialog focus containment/Escape/opener, refresh focus restoration, KB source-list jump/selection/selected state, and desktop/mobile captures. Real API routes were used: support ran against a cloned public snapshot and new isolated local session DB, with model/embedding calls disabled; general used its shared demo API. No user tabs, 18947/18967 servers or existing user data were altered.

Evidence: tests/evidence/clarity-refinement/layout-contrast.json and PNGs. The support accordion and general query-feedback/modal behavior follow-ups are owned by their feature tasks and integrated separately; this commit only owns clarity-design.css, platform-shell.js and kb-lineage.js. Deployment is coordinated by the input KB integration owner.
