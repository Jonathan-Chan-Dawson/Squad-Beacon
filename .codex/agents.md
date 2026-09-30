# Agent Routing & Workflow Rules

## Primary Orchestrator

- **Orchestrator/Reviewer:** Astra / Medium
- **Role:** Handles high-level context, architecture planning, task splitting, plan reviewing, and final code reviews/verification.

## Subagent Definitions

- **Explore & Summarize Subagent:** Luna / Medium
  - **Scope:** Use for fast context gathering, codebase exploration, file extraction, and structured summaries.
- **Implementation Subagent:** Luna / XHigh
  - **Scope:** Use for bounded, repeatable, or targeted code implementation packets with explicit success criteria.

## Execution Rules

1. Sol / High must handle initial architecture and design plans.
2. Delegate all discovery, code navigation, and context summarization tasks explicitly to Luna / Medium.
3. Delegate implementation chunks to Luna / XHigh once the scope is clear.
4. Route all completed implementation packets back to Sol / High for code-review and plan validation.
