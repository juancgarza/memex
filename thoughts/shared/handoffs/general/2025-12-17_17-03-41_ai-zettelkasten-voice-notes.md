---
date: 2025-12-17T23:03:41Z
researcher: claude
git_commit: d0350b59e7718e2519a31ff7def498ce7b081076
branch: main
repository: memex
topic: "AI-Powered Zettelkasten with Voice Notes Implementation"
tags: [implementation, voice-notes, zettelkasten, ai, convex, whisper]
status: in_progress
last_updated: 2025-12-17
last_updated_by: claude
type: implementation_strategy
---

# Handoff: AI-Powered Zettelkasten with Voice Notes

## Task(s)

### Completed
1. **Theme System** - Added Gruvbox Light / Zinc Dark theme toggle with shadcn/ui Switch component
2. **Phase 1: Voice Recording & Storage** - Voice recorder UI, Convex file storage, schema updates
3. **Phase 2: Transcription & AI Processing** - Whisper API, Claude concept extraction, auto-node creation

### Work in Progress
- **Phase 3: Wiki Links & Auto-Suggestions** - `[[wiki-link]]` parsing, link autocomplete (not started)
- **Phase 4: Backlinks Panel** - Zettelkasten-style backlinks with AI explanations (not started)

### Reference Plan
Full implementation plan at: `docs/ai-zettelkasten-voice-notes-plan.md`

## Critical References
- `docs/ai-zettelkasten-voice-notes-plan.md` - Full 4-phase implementation plan
- `convex/schema.ts` - Data model with voiceNotes table and updated canvasNodes
- `convex/voiceNotes.ts` - Voice note processing pipeline

## Recent Changes

### Schema Updates
- `convex/schema.ts:28-45` - Added `voiceNotes` table (fileId, duration, transcription, status)
- `convex/schema.ts:47-75` - Updated `canvasNodes` with sourceType, sourceId, parentNodeId, outgoingLinks

### New Files
- `convex/voiceNotes.ts` - CRUD operations + `process` action for transcription/AI pipeline
- `src/components/voice/VoiceRecorder.tsx` - Floating mic button with recording UI
- `src/app/api/transcribe/route.ts` - Whisper API integration
- `src/app/api/extract-concepts/route.ts` - Claude concept extraction with zod schema

### Updated Files
- `convex/canvas.ts:25-55` - Added sourceType, sourceId, parentNodeId args to createNode
- `convex/canvas.ts:136-170` - Added getBacklinks and getNodesByVoiceNote queries
- `src/app/page.tsx:11,167-175` - Added VoiceRecorder component

### Theme System (Earlier in Session)
- `src/app/globals.css` - CSS variables for Gruvbox Light and Zinc Dark themes
- `src/lib/theme.tsx` - ThemeProvider with localStorage persistence
- `src/components/ui/switch.tsx` - shadcn Switch component
- All components updated to use theme-aware CSS variables

## Learnings

1. **Convex Actions for External APIs**: Use `action` (not `mutation`) for external API calls like Whisper/Claude. Actions can call mutations via `ctx.runMutation()`.

2. **Convex File Storage**: Use `ctx.storage.generateUploadUrl()` to get presigned URL, then POST the blob directly. Reference with `v.id("_storage")`.

3. **Environment Variables in Convex**: Access via `process.env` but types may not be available. Used workaround with `(globalThis as any).process?.env?.SITE_URL`.

4. **MediaRecorder Formats**: Browser MediaRecorder typically outputs webm/opus. Whisper accepts webm directly.

5. **Zod + AI SDK**: `generateObject` from AI SDK works well with zod schemas for structured output extraction.

6. **Tailwind v4 Theming**: Use CSS variables in HSL format without `hsl()` wrapper, then reference as `hsl(var(--variable))`.

## Artifacts

### Implementation Plan
- `docs/ai-zettelkasten-voice-notes-plan.md` - Complete 4-phase plan with code snippets

### New Convex Functions
- `convex/voiceNotes.ts` - generateUploadUrl, create, updateStatus, get, list, getAudioUrl, process
- `convex/canvas.ts:136-170` - getBacklinks, getNodesByVoiceNote

### New Components
- `src/components/voice/VoiceRecorder.tsx` - Full voice recording UI

### New API Routes
- `src/app/api/transcribe/route.ts` - Whisper integration
- `src/app/api/extract-concepts/route.ts` - AI concept extraction

### Theme System
- `src/lib/theme.tsx` - ThemeProvider
- `src/lib/utils.ts` - cn() utility
- `src/components/ui/switch.tsx` - shadcn Switch

## Action Items & Next Steps

1. **Test Voice Recording Flow**
   - Run `npx convex dev` and `pnpm dev`
   - Record a voice note and verify nodes appear on canvas
   - Check transcription and concept extraction quality

2. **Implement Phase 3: Wiki Links**
   - Create `src/lib/links.ts` - extractWikiLinks() and parseWikiLinks()
   - Create `src/components/canvas/LinkSuggestions.tsx` - Autocomplete dropdown
   - Update NoteNode to render `[[links]]` as clickable
   - See plan: `docs/ai-zettelkasten-voice-notes-plan.md#phase-3`

3. **Implement Phase 4: Backlinks Panel**
   - Create `src/components/canvas/BacklinksPanel.tsx`
   - Add `src/app/api/explain-link/route.ts` for AI relationship explanations
   - Integrate panel into MemexCanvas with node selection
   - See plan: `docs/ai-zettelkasten-voice-notes-plan.md#phase-4`

4. **Production Setup**
   - Set `SITE_URL` environment variable in Convex dashboard for production
   - Verify OPENAI_API_KEY is set (needed for Whisper + embeddings)

## Other Notes

### Environment Variables Required
```
OPENAI_API_KEY=xxx          # For Whisper + embeddings (already set)
ANTHROPIC_API_KEY=xxx       # For Claude (already set)
SITE_URL=http://localhost:3005  # Set in Convex dashboard for prod
```

### Market Research Context
Research was done on competitors (Reflect, Tana, Heptabase, Granola). Key insights:
- Voice → structured notes pipeline is a differentiator
- Canvas-first with semantic embeddings is unique
- Backlinks + AI explanations adds value over simple linking

### Codebase Structure
```
convex/
  schema.ts       - Data model
  voiceNotes.ts   - Voice note processing
  canvas.ts       - Node/edge CRUD + backlinks
  embeddings.ts   - Semantic search
  
src/components/
  voice/VoiceRecorder.tsx  - Recording UI
  canvas/                   - Canvas + nodes
  chat/                     - Chat interface
  
src/app/api/
  transcribe/     - Whisper
  extract-concepts/ - Claude extraction
  chat/           - Chat streaming
```
