# AI Handoff Document: Phlogiston

This document provides context and architectural details for any AI agent taking over the development of **Phlogiston**, an offline-first PWA for synthetic chemists.

## Project Overview
Phlogiston is a pure frontend React application designed to replace paper laboratory notebooks and routine calculator tasks for chemists. It calculates stoichiometry (moles, mass, equivalents, volumes), handles solutions (molarity, wt%), allows drawing chemical structures via Ketcher, supports PubChem lookups, generates PDF reports, and works entirely offline.

## Core Directives for AI Agents
1. **Frontend Only (Mockup Stack):** This application DOES NOT have a backend. The `server/` folder is only for Vite/Replit dev tooling. **DO NOT** write or modify any backend code (Express, database routes, etc.).
2. **Local Storage First:** All data persistence relies on the browser's `localStorage` (via Zustand's `persist` middleware). There is no remote database.
3. **Offline Capability:** The app is a PWA. Features like PubChem lookup require internet, but core calculations, saved syntheses, and custom reagents must work perfectly offline.
4. **Bilingual:** The app supports English and Russian. All user-facing strings must use the `t()` function from `client/src/lib/i18n.ts`.

## Architecture & Tech Stack
- **Framework:** React 19 + TypeScript + Vite
- **Routing:** `wouter`
- **Styling:** Tailwind CSS + Shadcn UI (accessible via `@/components/ui/...`)
- **State Management:** Zustand (`client/src/store/appStore.ts` handles the global state, saved syntheses, inventory, and custom reagents).
- **Chemistry Tools:** 
  - `smiles-drawer`: Used for rendering SMILES strings onto HTML5 canvases (`StructureCanvas` component).
  - `ketcher-react`: Used for the standalone structure editor modal.
- **Exporting:** `jspdf` + `html2canvas` for generating A4 publication-style PDF reports. `papaparse` for CSV parsing/exporting.

## Key Files & Directories
- `client/src/pages/Home.tsx`: The main application view. Contains the reaction scheme, stoichiometry table, synthesis details, and sidebars (history, inventory, custom reagents).
- `client/src/pages/PrintSynthesis.tsx`: A visually stripped-down, print-optimized view of the synthesis, specifically structured for the PDF export via `html2canvas`.
- `client/src/components/ReactionScheme.tsx`: The visual reaction builder (Reactants → Conditions → Products) that supports Ketcher drawings and SMILES rendering.
- `client/src/lib/chemistry.ts`: Core chemical parsing (calculating molar masses from formulas/SMILES, fetching from PubChem API).
- `client/src/lib/export.tsx`: Logic for parsing TXT files, exporting to CSV, and defining the data structures.
- `client/src/store/appStore.ts`: Zustand store. Contains `syntheses` (saved history), `inventory` (Google Sheets/CSV imports), and `customReagents` (formerly known as abbreviations).
- `client/src/lib/i18n.ts`: Translation dictionaries (`ru` and `en`).

## Recent Changes & Current State
- **Storage Optimization (v1.2):** `CustomSectionManager.tsx` now uses a canvas to compress uploaded images (800px max, 0.5 quality JPEG) to prevent `QuotaExceededError` in the 5MB `localStorage` limit. Temporary PDF cache (`chemcalc_pdf_export`) is cleared when `Home.tsx` mounts.
- **Table Calculations (v1.2):** Custom table blocks support Excel-like formulas with click-to-reference functionality.
- **PDF Layout (v1.2):** Custom sections in `PrintSynthesis.tsx` are wrapped with a `page-break-before: always` print style to ensure they start on a new A4 page.
- **Bilingual Units (v1.2):** Added translations for units (`uiMg`, `uiMl`, `uiMmol`, etc.) in `i18n.ts` which are used in `PrintSynthesis.tsx` and `Home.tsx`.
- The terminology "My Abbreviations" (Мои сокращения) was replaced with "Custom Reagents" (Пользовательские реагенты) across the UI and translation files to better reflect its utility.
- The `phlogiston.zip` build artifact is automatically generated during `npm run build` via `script/build.ts`, packaging the `dist/public` folder for offline distribution.
- A superscript/subscript toolbar (`FormatToolbar.tsx`) is implemented for the reaction conditions textarea. It uses an `onMouseDown` event (instead of `onClick`) with `e.preventDefault()` to prevent focus loss during text formatting.
- PDF exports scale structures and text for A4 format (base font size 14px for readability). Structures do not have grey backgrounds (`bg-transparent` used in `ReactionScheme.tsx`).

## Development Workflow
To run the project: `npm run dev:client`
To build for production and generate the offline ZIP: `npm run build`

When making UI changes, prioritize clean, scientific, and minimal design. Use Tailwind spacing and standard Shadcn components. Ensure responsive behavior, especially for the large data tables.