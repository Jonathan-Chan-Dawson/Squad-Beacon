Onboarding and entry presentation

- copy.ts and illustrations.tsx: semantic, typed copy/optional quips and local Beacon vignette registry. Functional text stays independent of tone.
- presentation.ts: viewer-scoped Home classification, content-state precedence and confirmed-action success candidates.
- runtime.tsx and progress.ts: account/epoch-isolated progress, first-session reservation, dismissals, retry and atomic success receipts. Display preferences stay device-scoped.
- OnboardingUI.tsx: compositions of the existing EmptyState primitive, welcome/returning content, inline contextual tips and first-success feedback.
- scenarios.ts and DeveloperLab.tsx: development-only coherent demo fixtures and preview controls. Demo resets never write hosted progress.

Root navigation and runtime progress initialization share src/shared/accountReadiness.ts. A loaded, viewer-matched required profile permits entry regardless of optional survey status. Progress failures retain safe presentation fallbacks. See README.md for preview/testing commands and docs/ONBOARDING_2_VALIDATION.md for Phase 4B acceptance boundaries.
