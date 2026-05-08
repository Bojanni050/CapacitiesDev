# Mindstack — Personal Knowledge Stack

## Original problem statement
> maak een notetaking app zoals capacities, notes zijn objects, en ai matched ze of jezelf. https://capacities.io/

## User choices
- Object types: Notes, People, Tasks, Ideas, Books, Projects, Meetings, Daily Logs (8 types)
- AI matching: both auto-suggest related notes + auto AI tags
- AI provider: Gemini 3 Flash (gemini-3-flash-preview) via Emergent Universal Key
- No auth, single user
- Design: clean & minimal Capacities-style

## Architecture
- Backend: FastAPI + Motor (MongoDB) + emergentintegrations (LlmChat)
- Frontend: React 19, Tailwind, shadcn/ui, lucide-react, sonner
- Storage: single `objects` collection, schema `{id, type, title, body, tags[], ai_tags[], ai_summary, metadata, created_at, updated_at}`

## What's been implemented (2026-02)
- Backend `/api`:
  - `GET /types`, `GET /stats`
  - `GET /objects?type=&search=&limit=`
  - `GET/PUT/DELETE /objects/{id}`, `POST /objects`
  - `POST /objects/{id}/ai-enhance` → ai_tags + ai_summary
  - `GET /objects/{id}/related` → top-5 semantic matches via Gemini 3 Flash
- Frontend (4-pane layout):
  - Sidebar with 8 typed nav items + counts (Manrope display, IBM Plex body, earthy palette)
  - Object list column with previews, tags, relative time
  - Editor: huge title input, body textarea, type dropdown, tag chips, AI-enhance + delete
  - AI weave panel: AI summary, auto-tags, related-object cards with score + reason
  - Cmd+K command palette (search + create new)
  - Debounced auto-save + auto-AI-enhance after typing pause
  - Toast notifications (sonner)
- Verified via 25/25 backend tests + Playwright e2e

## Backlog
- P1: Backlinks via @mention syntax inside body
- P1: Daily-note auto-create for today (Capacities-style daily journal)
- P1: Type-specific metadata fields (e.g. People → email/twitter, Books → author/rating)
- P2: Markdown rendering / rich-text editor
- P2: Object-to-object linking UI (drag from related card to embed)
- P2: Export / backup to JSON
- P2: Multi-user + auth
- P2: Offline cache + optimistic updates
