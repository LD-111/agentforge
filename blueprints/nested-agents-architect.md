---
id: nested-agents-architect
title: Nested AGENTS.md Generator
version: 1.2.0
tags: [architecture, guardrails, setup]
variables:
  - name: framework
    source: auto:framework
    fallback: "TypeScript"
  - name: folder_tree
    source: auto:tree(depth=2)
  - name: strictness
    source: input
    default: "strict"
changelog:
  - version: 1.2.0
    note: "Added rule requiring agent to update AGENTS.md after structural refactors."
  - version: 1.0.0
    note: "Initial baseline prompt."
---

You are a Senior Software Architect. Analyze this {{framework}} repository and generate a hierarchical `AGENTS.md` documentation system.

### Current Directory Structure
{{folder_tree}}

### Instructions
1. Create a root `AGENTS.md` covering global architecture, tech stack conventions, and an index referencing all nested `AGENTS.md` files.
2. For each major module/directory, generate a dedicated `AGENTS.md` detailing local responsibilities, boundaries, and {{strictness}} coding guardrails.
3. Include an explicit rule instructing AI agents to verify and update the relevant `AGENTS.md` file whenever code modifications alter module contracts or structure.
