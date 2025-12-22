# Content Ingestion System Implementation Plan

## Overview

Build a content ingestion system that allows importing knowledge from external sources (web pages, YouTube videos, podcasts, book highlights) into the Memex note-taking system. Each import creates a searchable note with embeddings, enabling semantic search and @mentions in chat.

## Current State Analysis

### Existing Infrastructure:
- **API Routes**: `src/app/api/` contains routes for chat, transcribe, embed, extract-concepts
- **Note Storage**: `convex/canvas.ts` - notes are `canvasNodes` with `type: "note"`
- **Embeddings**: `convex/embeddings.ts` - uses OpenAI `text-embedding-3-small`
- **Source Tracking**: `sourceType` field exists with values: `manual`, `voice`, `chat`, `ai_extracted`
- **Concept Extraction**: `src/app/api/extract-concepts/route.ts` - Claude-powered atomic note extraction

### Key Discoveries:
- Notes stored in `canvasNodes` table with vector embeddings (`convex/schema.ts:46-86`)
- `createNode` mutation accepts `sourceType` and `sourceId` for provenance tracking (`convex/canvas.ts:25-71`)
- Embedding action `embedCanvasNode` handles OpenAI API calls (`convex/embeddings.ts:72-106`)
- Existing pattern: transcribe audio → extract concepts → create notes with embeddings

## Desired End State

After implementation:
1. User can paste any URL → get a note with clean markdown content
2. User can paste YouTube URL → get transcript as a searchable note
3. User can connect Readwise → auto-sync book highlights
4. All imported content has embeddings for semantic search
5. Imported notes appear in @mentions and wiki-links
6. Source provenance is tracked for each note

### Verification:
- Import a URL and verify note appears in Notes sidebar
- Search for content from imported note via semantic search
- @mention imported note in chat and verify context is included

## What We're NOT Doing

- Real-time podcast transcription (expensive, complex)
- Browser extension for clipping (future phase)
- Two-way sync with external services
- Import history/queue UI (keep it simple)
- Batch imports (one at a time for MVP)

## Implementation Approach

Incremental phases, each independently useful:
1. **Phase 1**: URL import with Firecrawl (most versatile)
2. **Phase 2**: YouTube transcript import (free, high value)
3. **Phase 3**: Readwise integration (optional, for readers)
4. **Phase 4**: Import UI modal (polish)

---

## Phase 1: URL Import with Firecrawl

### Overview
Add API endpoint to scrape any web page and create a note with clean markdown content.

### Changes Required:

#### 1. Install Dependencies
```bash
npm install @mendable/firecrawl-js
```

#### 2. Environment Variable
**File**: `.env.local`
```
FIRECRAWL_API_KEY=fc-your-api-key
```

#### 3. Schema Update
**File**: `convex/schema.ts`
**Changes**: Add new sourceType values

```typescript
sourceType: v.optional(
  v.union(
    v.literal("manual"),
    v.literal("voice"),
    v.literal("chat"),
    v.literal("ai_extracted"),
    v.literal("web"),        // NEW
    v.literal("youtube"),    // NEW
    v.literal("readwise")    // NEW
  )
),
// Add sourceUrl field for external content
sourceUrl: v.optional(v.string()),
```

#### 4. API Route
**File**: `src/app/api/import/url/route.ts` (NEW)

```typescript
import Firecrawl from "@mendable/firecrawl-js";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL required" }, { status: 400 });
    }

    const firecrawl = new Firecrawl({
      apiKey: process.env.FIRECRAWL_API_KEY!,
    });

    const result = await firecrawl.scrapeUrl(url, {
      formats: ["markdown"],
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to scrape URL" },
        { status: 500 }
      );
    }

    const title = result.metadata?.title || new URL(url).hostname;
    const content = `# ${title}\n\n${result.markdown}\n\n---\nSource: ${url}`;

    return NextResponse.json({
      title,
      content,
      metadata: result.metadata,
      sourceUrl: url,
    });
  } catch (error) {
    console.error("URL import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}
```

#### 5. Convex Mutation Update
**File**: `convex/canvas.ts`
**Changes**: Add `sourceUrl` to createNode args

```typescript
export const createNode = mutation({
  args: {
    // ... existing args ...
    sourceUrl: v.optional(v.string()), // NEW
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("canvasNodes", {
      // ... existing fields ...
      sourceUrl: args.sourceUrl, // NEW
    });
  },
});
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] Lint passes: `pnpm lint`
- [ ] API responds: `curl -X POST http://localhost:3005/api/import/url -H "Content-Type: application/json" -d '{"url":"https://example.com"}'`

#### Manual Verification:
- [ ] Paste URL in app → note created with markdown content
- [ ] Note appears in Notes sidebar
- [ ] Note is searchable via semantic search
- [ ] Note can be @mentioned in chat

---

## Phase 2: YouTube Transcript Import

### Overview
Add API endpoint to extract YouTube video transcripts and create searchable notes.

### Changes Required:

#### 1. Install Dependencies
```bash
npm install youtube-transcript
```

#### 2. API Route
**File**: `src/app/api/import/youtube/route.ts` (NEW)

```typescript
import { YoutubeTranscript } from "youtube-transcript";
import { NextResponse } from "next/server";

export const maxDuration = 30;

// Extract video ID from various YouTube URL formats
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/, // Just the ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL required" }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    // Fetch transcript
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

    // Combine transcript segments
    const transcript = transcriptItems
      .map((item) => item.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    // Fetch video metadata via oEmbed (no API key needed)
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const metaResponse = await fetch(oembedUrl);
    const metadata = metaResponse.ok ? await metaResponse.json() : {};

    const title = metadata.title || `YouTube Video ${videoId}`;
    const author = metadata.author_name || "Unknown";
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const content = `# ${title}\n\n**Channel**: ${author}\n**Source**: ${youtubeUrl}\n\n## Transcript\n\n${transcript}`;

    return NextResponse.json({
      title,
      content,
      videoId,
      author,
      sourceUrl: youtubeUrl,
      transcriptLength: transcript.length,
    });
  } catch (error) {
    console.error("YouTube import error:", error);

    // Handle common errors
    if (error instanceof Error) {
      if (error.message.includes("Transcript is disabled")) {
        return NextResponse.json(
          { error: "Transcript not available for this video" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [ ] API responds: `curl -X POST http://localhost:3005/api/import/youtube -H "Content-Type: application/json" -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'`

#### Manual Verification:
- [ ] Paste YouTube URL → note created with transcript
- [ ] Video title and channel extracted correctly
- [ ] Transcript is searchable via semantic search
- [ ] Works with youtu.be short URLs

---

## Phase 3: Readwise Integration (Optional)

### Overview
Connect to Readwise API to sync book highlights and annotations.

### Changes Required:

#### 1. Environment Variable
**File**: `.env.local`
```
READWISE_ACCESS_TOKEN=your-readwise-token
```

#### 2. API Route
**File**: `src/app/api/import/readwise/route.ts` (NEW)

```typescript
import { NextResponse } from "next/server";

export const maxDuration = 60;

interface ReadwiseHighlight {
  id: number;
  text: string;
  note: string;
  location: number;
  location_type: string;
  highlighted_at: string;
  book_id: number;
  url: string | null;
  tags: { id: number; name: string }[];
}

interface ReadwiseBook {
  id: number;
  title: string;
  author: string;
  category: string;
  source: string;
  num_highlights: number;
  cover_image_url: string;
  highlights_url: string;
  source_url: string | null;
  highlights: ReadwiseHighlight[];
}

async function fetchReadwiseExport(token: string, updatedAfter?: string) {
  const allBooks: ReadwiseBook[] = [];
  let nextPageCursor: string | null = null;

  do {
    const params = new URLSearchParams();
    if (nextPageCursor) params.append("pageCursor", nextPageCursor);
    if (updatedAfter) params.append("updatedAfter", updatedAfter);

    const response = await fetch(
      `https://readwise.io/api/v2/export/?${params}`,
      {
        headers: { Authorization: `Token ${token}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Readwise API error: ${response.status}`);
    }

    const data = await response.json();
    allBooks.push(...data.results);
    nextPageCursor = data.nextPageCursor;
  } while (nextPageCursor);

  return allBooks;
}

export async function POST(req: Request) {
  try {
    const { updatedAfter } = await req.json();

    const token = process.env.READWISE_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "Readwise not configured" },
        { status: 500 }
      );
    }

    const books = await fetchReadwiseExport(token, updatedAfter);

    // Convert each book to a note format
    const notes = books.map((book) => {
      const highlightsText = book.highlights
        .map((h) => {
          let text = `> ${h.text}`;
          if (h.note) text += `\n\n**Note**: ${h.note}`;
          if (h.tags.length > 0) {
            text += `\n\n*Tags: ${h.tags.map((t) => t.name).join(", ")}*`;
          }
          return text;
        })
        .join("\n\n---\n\n");

      const content = `# ${book.title}\n\n**Author**: ${book.author}\n**Category**: ${book.category}\n**Highlights**: ${book.num_highlights}\n\n## Highlights\n\n${highlightsText}`;

      return {
        bookId: book.id,
        title: book.title,
        author: book.author,
        content,
        highlightCount: book.num_highlights,
        sourceUrl: book.source_url || book.highlights_url,
      };
    });

    return NextResponse.json({
      books: notes,
      totalBooks: notes.length,
      totalHighlights: notes.reduce((sum, n) => sum + n.highlightCount, 0),
    });
  } catch (error) {
    console.error("Readwise import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [ ] API responds (with valid token): returns book highlights

#### Manual Verification:
- [ ] Readwise highlights import as notes
- [ ] Book metadata (title, author) captured
- [ ] Highlights searchable via semantic search
- [ ] Individual highlight notes preserved

---

## Phase 4: Import UI Modal

### Overview
Add a user-friendly import modal accessible from the Notes sidebar.

### Changes Required:

#### 1. Import Modal Component
**File**: `src/components/notes/ImportModal.tsx` (NEW)

```typescript
"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Link, Youtube, BookOpen, X, Loader2 } from "lucide-react";

type ImportType = "url" | "youtube" | "readwise";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (noteId: string) => void;
}

export function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const [importType, setImportType] = useState<ImportType>("url");
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createNode = useMutation(api.canvas.createNode);
  const embedNode = useAction(api.embeddings.embedCanvasNode);

  const handleImport = async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Determine endpoint based on import type
      const endpoint =
        importType === "youtube" ? "/api/import/youtube" : "/api/import/url";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Import failed");
      }

      const data = await response.json();

      // Create note in Convex
      const nodeId = await createNode({
        type: "note",
        content: data.content,
        x: 0,
        y: 0,
        sourceType: importType === "youtube" ? "youtube" : "web",
        sourceUrl: data.sourceUrl,
      });

      // Generate embedding
      await embedNode({
        nodeId,
        content: data.content,
      });

      // Success
      setUrl("");
      onSuccess(nodeId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Import Content</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Import Type Tabs */}
        <div className="flex border-b border-border">
          {[
            { type: "url" as const, icon: Link, label: "Web Page" },
            { type: "youtube" as const, icon: Youtube, label: "YouTube" },
            { type: "readwise" as const, icon: BookOpen, label: "Readwise" },
          ].map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => setImportType(type)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                importType === type
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {importType === "readwise" ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Readwise sync coming soon</p>
              <p className="text-sm mt-1">
                Configure READWISE_ACCESS_TOKEN in .env.local
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {importType === "youtube" ? "YouTube URL" : "Web Page URL"}
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={
                    importType === "youtube"
                      ? "https://youtube.com/watch?v=..."
                      : "https://example.com/article"
                  }
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={!url.trim() || isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Import"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

#### 2. Update Notes Sidebar
**File**: `src/components/notes/NotesSidebar.tsx`
**Changes**: Add import button that opens modal

```typescript
// Add to imports
import { ImportModal } from "./ImportModal";
import { Download } from "lucide-react";

// Add state in component
const [isImportModalOpen, setIsImportModalOpen] = useState(false);

// Add button next to "New Note" button
<button
  onClick={() => setIsImportModalOpen(true)}
  className="p-2 hover:bg-muted rounded-lg transition-colors"
  title="Import content"
>
  <Download className="w-5 h-5" />
</button>

// Add modal at end of component
<ImportModal
  isOpen={isImportModalOpen}
  onClose={() => setIsImportModalOpen(false)}
  onSuccess={(noteId) => {
    // Navigate to the new note
    onSelect(noteId);
  }}
/>
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `npx tsc --noEmit`
- [x] No lint errors: `pnpm lint`

#### Manual Verification:
- [ ] Import button visible in Notes sidebar
- [ ] Modal opens with tabs for URL/YouTube/Readwise
- [ ] URL import works end-to-end
- [ ] YouTube import works end-to-end
- [ ] Loading states display correctly
- [ ] Error messages are user-friendly
- [ ] Imported note is selected after creation

---

## Testing Strategy

### Manual Testing Steps:
1. **URL Import**:
   - Import a blog post URL
   - Import a news article
   - Try an invalid URL (should show error)
   - Try a paywalled URL (should handle gracefully)

2. **YouTube Import**:
   - Import video with standard URL format
   - Import with youtu.be short URL
   - Import with just video ID
   - Try video without captions (should show error)

3. **Search Integration**:
   - Import content, then search for keywords
   - Verify @mention works with imported notes
   - Check that imported notes appear in wiki-link suggestions

## Performance Considerations

- **Firecrawl**: ~1-3 seconds per page scrape
- **YouTube Transcript**: ~500ms for most videos
- **Readwise**: Paginated API, may take longer for large libraries
- **Embeddings**: ~200ms per embedding generation
- Consider showing progress for large imports

## Cost Estimates

| Service | Free Tier | Paid |
|---------|-----------|------|
| Firecrawl | 500 credits (one-time) | $16/mo for 3,000 |
| YouTube Transcript | Unlimited | Free |
| Readwise API | With subscription | ~$8/mo |
| OpenAI Embeddings | - | ~$0.0001 per 1K tokens |

## References

- Firecrawl docs: https://docs.firecrawl.dev
- youtube-transcript npm: https://www.npmjs.com/package/youtube-transcript
- Readwise API: https://readwise.io/api_deets
- Existing embed route: `src/app/api/embed/route.ts`
- Existing extract-concepts: `src/app/api/extract-concepts/route.ts`
