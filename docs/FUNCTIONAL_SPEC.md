# LocksmithPrep — Functional Specification

## 1. Content Management

### 1.1 Content Schema
Each content item carries:
- `examLevel`: beginner | intermediate | advanced | electronics | safe-vault | institutional
- `skillTags[]`: fine-grained topic tags (e.g., "pin-tumbler", "master-key", "rekeying")
- `difficulty`: 1–5 scale
- `bloomLevel`: remember | understand | apply | analyze | evaluate | create
- `learningObjective`: single-sentence statement
- `sourceId` + `citations[]`: provenance tracking
- `reviewStatus`: draft → pending_review → approved/rejected → archived

### 1.2 Editorial Workflow
```
draft --submit--> pending_review --approve--> approved --archive--> archived
                                 --reject---> rejected --revise--> draft
                                                       --archive-> archived
```
All procedural content requires human verification before `approved` status.

### 1.3 Media Types
- Text (rich markdown)
- Annotated images
- Short videos (< 5 min)
- Interactive diagrams
- Animations

### 1.4 Content Pipeline
- Validation: title, body length, skill tags, learning objective, source ID
- Bloom's taxonomy question stub generation
- Batch import with per-item validation

## 2. Question Bank & Exam Engine

### 2.1 Question Model
- Multiple-choice (4 options)
- Linked to content item
- Tagged with exam level, difficulty, Bloom's level, skill tags
- Explanation + citations for each question

### 2.2 Exam Generation
- Filter by exam level, skill tags, difficulty range
- Random selection and shuffling (Fisher-Yates)
- Configurable question count and time limit

### 2.3 Scoring & Analytics
- Per-question results (correct/incorrect)
- Overall score percentage
- Skill breakdown: correct/total per skill tag
- Time tracking

### 2.4 Adaptive Difficulty
- Recent score average → suggested difficulty range:
  - ≥80%: difficulty 3–5
  - ≥60%: difficulty 2–4
  - <60%: difficulty 1–3

## 3. Study Planner

### 3.1 Plan Generation
- User sets target exam date
- Content grouped by skill tags into milestones
- Milestones evenly spaced between now and target date

### 3.2 Progress Tracking
- Per-milestone completion
- Overall progress percentage
- Study streak (consecutive-day tracking, resets after 1-day gap)

### 3.3 Calendar Export
- iCalendar (.ics) format export
- One event per milestone with due date

## 4. Flashcards (Spaced Repetition)

### 4.1 SM-2 Algorithm
- Quality ratings 0–5
- Ease factor (min 1.3)
- Interval scheduling: 1 day → 6 days → interval × ease factor
- Reset on failure (quality < 3)

### 4.2 Deck Management
- Due card detection
- Priority sorting: overdue first, harder cards first
- Retention stats: new / learning / mature / average ease

## 5. AI Tutor

### 5.1 System Prompt
- Ethical guardrails: no illegal bypass instructions
- Citation-required: every factual claim must reference a content_id
- Uncertainty disclosure: state limitations when unsure
- Structured JSON output

### 5.2 Safety
- Blocked query patterns: bypass, unauthorized entry, illegal techniques
- Low-confidence flagging (< 0.6) triggers human review
- Unparseable responses flagged for review

### 5.3 Per-Level Personas
| Level | Temperature | Max Tokens | Focus |
|-------|------------|------------|-------|
| Beginner | 0.3 | 2048 | Foundational concepts, simple language |
| Intermediate | 0.4 | 2048 | Advanced keying, commercial applications |
| Advanced | 0.5 | 3072 | Safe/vault, electronic access, forensics |

### 5.4 Output Schema
```json
{
  "title": "...",
  "summary": "...",
  "tools_required": ["..."],
  "steps": [{"step": 1, "action": "...", "citation": ["content_id_..."]}],
  "pitfalls": ["..."],
  "quiz_questions": [{"q": "...", "options": ["..."], "answer_index": 0, "explanation": "...", "citation": ["content_id_..."]}],
  "confidence": 0.78,
  "sources": ["content_id_..."]
}
```

## 6. LLM API Adapter

### 6.1 Provider Support
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Local/self-hosted models
- Custom endpoints

### 6.2 Built-in Features
- Rate limiting (requests/minute, tokens/minute)
- Response caching with configurable TTL
- Token usage monitoring and logging
- Provider-specific request/response formatting

## 7. Notifications

### 7.1 Types
- Study reminders (recurring)
- Streak warnings
- Milestone due dates
- Exam readiness alerts
- Flashcard review due

### 7.2 User Controls
- Global enable/disable
- Per-type enable/disable
- Quiet hours (supports midnight wrap)
- Snooze functionality
- Dismiss

## 8. Feature Flags
Progressive rollout system:
- `enabledExamLevels[]` — which certification levels are available
- Module toggles: AI tutor, labs, flashcards, notifications, admin tools
- Dark mode toggle
- Calendar export toggle

## 9. UI/UX

### 9.1 Dark Mode Palette
WCAG AA compliant contrast ratios:
- Background: slate-950 (#020617)
- Surface: slate-900 (#0f172a)
- Text: slate-100 (#f1f5f9)
- Accent: blue-500 (#3b82f6)

### 9.2 Navigation
Tab-based: Dashboard, Lessons, Practice Exams, Flashcards, Study Plan, AI Tutor

### 9.3 Disclaimer Banner
Persistent top banner reminding users the app is a study aid, not a guarantee of exam success.

## 10. Security & Privacy
- Local-first storage (IndexedDB)
- No telemetry by default
- Optional account sync (future) with encryption
- API keys stored client-side, never transmitted to app servers
