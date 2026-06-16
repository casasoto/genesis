# LocksmithPrep — 8-Week MVP Roadmap

## Overview
**Goal:** Ship a functional beginner-level exam prep PWA with core study features, AI tutoring, and offline support.

---

## Week 1–2: Foundation & Core Data
**Status: ✅ Complete (this PR)**

- [x] Project scaffold (Vite + React + TypeScript + Tailwind + PWA)
- [x] Data models & TypeScript interfaces
- [x] IndexedDB schema (Dexie.js)
- [x] Feature flag system
- [x] Dark-mode theme (WCAG AA)
- [x] Unit test infrastructure (Vitest, 189 tests)
- [x] Content pipeline with validation & editorial workflow
- [x] LLM adapter (provider-agnostic, rate limiting, caching)

## Week 3: Content & Question Bank
- [ ] Seed beginner exam content (50+ items covering ALOA beginner topics)
- [ ] Build question import/authoring UI
- [ ] Implement lesson viewer component (text, images, diagrams)
- [ ] Wire up exam engine UI: start exam → answer questions → view results
- [ ] Add performance analytics dashboard

## Week 4: AI Tutor Integration
- [ ] RAG pipeline: index content corpus for retrieval
- [ ] AI Tutor chat UI component
- [ ] Wire TutorService to real LLM provider
- [ ] Human review queue UI for low-confidence responses
- [ ] On-device model fallback research & prototype

## Week 5: Flashcards & Spaced Repetition
- [ ] Flashcard deck UI (flip animation, swipe gestures)
- [ ] Review session flow with quality rating input
- [ ] Auto-generate flashcards from content items
- [ ] Retention statistics dashboard
- [ ] Deck management (create, edit, delete)

## Week 6: Study Planner & Notifications
- [ ] Study plan creation wizard UI
- [ ] Milestone progress tracker
- [ ] Streak visualization (calendar heatmap)
- [ ] iCal export functionality
- [ ] OS notification integration (Notification API)
- [ ] Notification preferences UI

## Week 7: Polish & Offline
- [ ] Service worker testing (offline mode verification)
- [ ] Selective media sync UI (choose what to cache offline)
- [ ] Media compression pipeline
- [ ] Loading states, error boundaries, empty states
- [ ] Accessibility audit (screen reader, keyboard nav)
- [ ] Responsive design QA (mobile, tablet, desktop)

## Week 8: Beta Launch
- [ ] Integration tests (full user flows)
- [ ] Beta user onboarding flow
- [ ] Pre/post test gain measurement
- [ ] Content audit checklist (human review of all beginner content)
- [ ] Deploy to production (Vercel/Cloudflare Pages)
- [ ] Beta feedback collection mechanism
- [ ] Documentation: user guide, developer guide, API docs

---

## Post-MVP (v1.0 and beyond)
| Feature | Target |
|---------|--------|
| Intermediate exam level | v1.1 |
| Interactive labs (lock disassembly simulator) | v1.2 |
| Advanced/electronics certification | v1.3 |
| User accounts with encrypted cloud sync | v1.4 |
| Community question contributions | v1.5 |
| Safe/vault specialist track | v2.0 |
| Institutional certification track | v2.0 |

---

## Prioritized MVP Feature List

### P0 — Must Have
1. Practice exam engine with scoring
2. Content viewer (text + images)
3. Study plan generator with target date
4. Offline access (PWA + IndexedDB)
5. Dark mode UI

### P1 — Should Have
6. AI Tutor with safety guardrails
7. Flashcards with spaced repetition
8. Performance analytics dashboard
9. Notification reminders
10. Calendar export

### P2 — Nice to Have
11. Interactive diagrams/animations
12. Content admin tools
13. Bloom's taxonomy coverage report
14. Study streak gamification
15. Media compression & selective sync
