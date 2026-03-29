# StructureAI Pipeline

A React + Tailwind implementation of a 5-stage structural intelligence workflow inspired by the supplied hackathon concept.

## What is included

- Stage 1: floor-plan parser workflow with sample plans and custom-image preview
- Stage 2: geometry reconstruction with room spans, wall classes, and alerts
- Stage 3: interactive 3D structural model using Three.js
- Stage 4: material recommendation engine with cost-strength-durability tradeoffs
- Stage 5: explainability report with export to text
- Local persistence for recent runs

## Tech stack

- React 18
- Vite 4
- Tailwind CSS 3
- Three.js

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Notes

- Custom uploaded images are previewed immediately, but still use fallback geometry until a backend CV parser is connected.
- The report stage is fully wired from structured frontend data, so replacing the local narrative generator with a backend LLM call is straightforward.
