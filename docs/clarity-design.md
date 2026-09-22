# Shared clarity design — 2026-09-22

The GS hackathon direction uses blue for actions, jade for linked knowledge and amber for provisional review. It does not add or alter an official GS logo. Palette inspiration: https://www.gscaltex.com/kr/company/brand/ci

`src/clarity-design.css` loads after all feature styles. Main body 15px/1.8, metadata 13px, headings 22/30px. Neutral canvas, white reading surfaces, reduced nested borders, strong text hierarchy. Existing content, routes, native dialogs, hidden/inert state and pending dashed amber appearance remain intact.

Contrast: body/white 11.43:1; muted/subtle surface 5.68:1; action/white 7.98:1; pending/amber 6.18:1; error/error surface 6.54:1; focus/subtle surface 5.41:1; input border/white 3.09:1. Buttons and named modal controls have 44px minimum targets.

Validation: real public baseline screens captured. Current local build with real API read requests via an isolated loopback preview proxy; model/embedding requests disabled and blocked. Five routes (#home, #support, #support-kb, #data, #general-1) at 1280×720 and 390×844 had zero horizontal overflow. Header remains 48px desktop / 56px mobile. Mobile menu opens/closes; native KB modal opens, contains keyboard focus, closes on Escape, restores opener focus. Build configuration suite: 3 passed. Error and loading states also captured. Evidence in tests/evidence/clarity-design.

Scope limit: new general workflow `.gw-app` selectors were coordinated with its owner but were not part of this baseline build; integration owner must verify the combined branch. Source-owner follow-ups (not CSS regressions): refresh rerender focus, support sidebar aria-current. VoiceOver and a complete WCAG audit were not performed. This commit is implementation only; deployment is coordinated by the hub.
