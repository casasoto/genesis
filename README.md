# 🔐 LocksmithPrep

> A cross-platform, offline-capable Progressive Web App for ALOA locksmith exam preparation.

**⚠️ Disclaimer:** LocksmithPrep is a study aid only. It does not guarantee passing any exam. Content accuracy depends on human-reviewed editorial processes. Always seek supervised, hands-on practice and follow all applicable laws and ethics codes.

## Quick Start

```bash
npm install
npm run dev        # Start dev server
npm run test       # Run unit tests (189 tests)
npm run build      # Production build
```

## Architecture

```
src/
├── models/              # TypeScript interfaces & types
│   ├── content.ts       # Content, Question, Flashcard, StudyPlan, ExamSession
│   └── ai-tutor.ts      # TutorResponse, LLMProviderConfig, TokenUsage
├── services/
│   ├── db.ts            # IndexedDB via Dexie.js (offline-first storage)
│   └── llm-adapter.ts   # Provider-agnostic LLM adapter (OpenAI/Anthropic/local)
├── modules/
│   ├── ai-tutor/        # AI tutor with prompt templates, safety filters, RAG
│   ├── question-bank/   # Exam engine: randomization, scoring, adaptive difficulty
│   ├── study-planner/   # Study plans, milestones, streaks, iCal export
│   ├── flashcards/      # SM-2 spaced repetition algorithm
│   ├── content-pipeline/# Editorial workflow, validation, Bloom's taxonomy stubs
│   └── notifications/   # Scheduled notifications, quiet hours, snooze
├── config/
│   ├── feature-flags.ts # Feature flag system for progressive rollout
│   └── theme.ts         # Dark-mode palette (WCAG AA contrast)
└── App.tsx              # UI shell with tabbed navigation
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript 6 |
| Build | Vite 8 |
| Testing | Vitest + Testing Library |
| Styling | Tailwind CSS 4 (dark mode) |
| Storage | Dexie.js (IndexedDB) |
| PWA | vite-plugin-pwa + Workbox |
| AI | Provider-agnostic LLM adapter |

## Key Features

### Modular Architecture
Every module is self-contained with its own types, logic, and test suite. New exam levels (intermediate, advanced, electronics, safe/vault, institutional) can be added by:
1. Adding the level to `ExamLevel` type
2. Creating content with the new `examLevel` field
3. Enabling via feature flags
4. Optionally adding an AI persona in `DEFAULT_PERSONAS`

### AI Tutor
- System prompt with ethical guardrails (no illegal bypass instructions)
- Structured JSON output with citations and confidence scores
- Low-confidence responses flagged for human review
- Per-level personas (beginner → master-locksmith)
- Blocked query detection for safety

### Provider-Agnostic LLM Adapter
```typescript
const adapter = new LLMAdapter({
  provider: 'openai',      // or 'anthropic', 'local', 'custom'
  apiUrl: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4',
  maxRequestsPerMinute: 60,
  cacheTTLSeconds: 300,
})
```
Built-in: rate limiting, response caching, token usage monitoring.

### Offline-First
- Service worker with Workbox precaching
- IndexedDB schema for all content, progress, and cache
- Designed for on-device LLM fallback

### Content Pipeline
- Editorial workflow: `draft → pending_review → approved/rejected → archived`
- Validation with provenance tracking (source IDs, citations)
- Bloom's taxonomy question stub generation

### Spaced Repetition (SM-2)
Full implementation of the SM-2 algorithm for flashcard scheduling with ease factor, interval tracking, and retention statistics.

## Testing

```bash
npm run test              # 189 unit tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

Coverage spans all core modules:
- LLM Adapter: cache, rate limiting, multi-provider parsing, auth headers
- AI Tutor: blocked queries, response validation, persona selection, low-confidence flagging
- Exam Engine: filtering, randomization, scoring, skill breakdown, adaptive difficulty
- Study Planner: milestones, streaks, progress, iCal export
- Flashcards: SM-2 algorithm, due cards, prioritization, retention stats
- Content Pipeline: validation, status transitions, Bloom's stubs, batch processing
- Notifications: quiet hours, snooze, dismiss, recurring reschedule
- Feature Flags: get/set/reset, exam level checks

## Documentation

See `docs/` for:
- [Product Summary](docs/PRODUCT_SUMMARY.md)
- [Functional Spec](docs/FUNCTIONAL_SPEC.md)
- [8-Week MVP Roadmap](docs/ROADMAP.md)

## License

Private — not for redistribution.
