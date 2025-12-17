# AI-Powered Zettelkasten with Voice Notes - Implementation Plan

## Overview

Build an AI-powered Zettelkasten system with voice note capture that automatically processes content into atomic, semantically-linked notes on the canvas. The system leverages AI for transcription, concept extraction, link suggestions, and relationship explanations.

## Current State Analysis

**Existing Infrastructure:**
- Canvas with node types: `text`, `chat_reference`, `note`
- Semantic embeddings (OpenAI `text-embedding-3-small`, 1536 dimensions)
- `findRelated` action for semantic search
- Edge system connecting nodes with labels
- Anthropic Claude for chat

**Key Files:**
- `convex/schema.ts` - Data model definitions
- `convex/canvas.ts` - Node/edge CRUD operations
- `convex/embeddings.ts` - Embedding generation and semantic search
- `src/components/canvas/` - Canvas UI components

## Desired End State

After implementation:
1. User can record voice notes via a floating mic button
2. Audio is stored and transcribed via Whisper API
3. AI automatically extracts atomic concepts from transcription
4. Each concept becomes a note node on the canvas
5. AI suggests `[[wiki-links]]` to existing notes
6. Backlinks panel shows incoming connections with AI explanations
7. All happens automatically upon recording completion

**Verification:**
- Record a 30-second voice note about a topic
- System creates 2-4 atomic note nodes
- Each node has semantic links to related existing nodes
- Backlinks panel shows connections with explanations

## What We're NOT Doing

- Real-time live transcription (batch only)
- Meeting mode / multi-speaker diarization (Phase 2+)
- Mobile-specific UI optimizations
- Offline support
- Custom AI model fine-tuning

## Implementation Approach

We'll build in 4 phases:
1. **Voice Recording & Storage** - Capture audio, store in Convex
2. **Transcription & Processing** - Whisper API + AI concept extraction
3. **Auto-linking & Wiki Syntax** - `[[link]]` parsing and suggestions
4. **Backlinks Panel** - Show incoming links with AI explanations

---

## Phase 1: Voice Recording & Storage

### Overview
Add voice recording UI and store audio files in Convex file storage.

### Changes Required:

#### 1. Schema Updates
**File**: `convex/schema.ts`

Add `voiceNotes` table and update `canvasNodes`:

```typescript
// Add to schema.ts

// Voice notes - audio recordings
voiceNotes: defineTable({
  fileId: v.id("_storage"), // Convex file storage reference
  duration: v.number(), // Duration in seconds
  transcription: v.optional(v.string()),
  status: v.union(
    v.literal("recording"),
    v.literal("uploaded"),
    v.literal("transcribing"),
    v.literal("processing"),
    v.literal("completed"),
    v.literal("error")
  ),
  errorMessage: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
}),

// Update canvasNodes - add sourceType and sourceId
canvasNodes: defineTable({
  type: v.union(
    v.literal("text"),
    v.literal("chat_reference"),
    v.literal("note")
  ),
  content: v.string(),
  x: v.number(),
  y: v.number(),
  width: v.number(),
  height: v.number(),
  messageId: v.optional(v.id("messages")),
  conversationId: v.optional(v.id("conversations")),
  // NEW: Source tracking
  sourceType: v.optional(v.union(
    v.literal("manual"),
    v.literal("voice"),
    v.literal("chat"),
    v.literal("ai_extracted")
  )),
  sourceId: v.optional(v.id("voiceNotes")), // Reference to voice note
  parentNodeId: v.optional(v.id("canvasNodes")), // For atomic splits
  // NEW: Wiki links extracted from content
  outgoingLinks: v.optional(v.array(v.string())), // [[link]] targets
  embedding: v.optional(v.array(v.float64())),
  createdAt: v.number(),
  updatedAt: v.number(),
}).vectorIndex("by_embedding", {
  vectorField: "embedding",
  dimensions: 1536,
  filterFields: ["type", "sourceType"],
}),
```

#### 2. Voice Notes Convex Functions
**File**: `convex/voiceNotes.ts` (new file)

```typescript
import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";

// Generate upload URL for audio file
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Create voice note record after upload
export const create = mutation({
  args: {
    fileId: v.id("_storage"),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("voiceNotes", {
      fileId: args.fileId,
      duration: args.duration,
      status: "uploaded",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update voice note status
export const updateStatus = mutation({
  args: {
    id: v.id("voiceNotes"),
    status: v.union(
      v.literal("recording"),
      v.literal("uploaded"),
      v.literal("transcribing"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("error")
    ),
    transcription: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Get voice note by ID
export const get = query({
  args: { id: v.id("voiceNotes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// List recent voice notes
export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("voiceNotes")
      .order("desc")
      .take(args.limit ?? 20);
  },
});

// Get audio file URL
export const getAudioUrl = query({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.fileId);
  },
});
```

#### 3. Voice Recorder Component
**File**: `src/components/voice/VoiceRecorder.tsx` (new file)

```typescript
"use client";

import { useState, useRef, useCallback } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Mic, Square, Loader2 } from "lucide-react";

interface VoiceRecorderProps {
  onRecordingComplete?: (voiceNoteId: string) => void;
}

export function VoiceRecorder({ onRecordingComplete }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const generateUploadUrl = useMutation(api.voiceNotes.generateUploadUrl);
  const createVoiceNote = useMutation(api.voiceNotes.create);
  const processVoiceNote = useAction(api.voiceNotes.process);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setDuration(0);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;

    setIsProcessing(true);

    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const mediaRecorder = mediaRecorderRef.current;

    return new Promise<void>((resolve) => {
      mediaRecorder.onstop = async () => {
        // Stop all tracks
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());

        // Create blob from chunks
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });

        try {
          // Upload to Convex
          const uploadUrl = await generateUploadUrl();
          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": "audio/webm" },
            body: blob,
          });
          const { storageId } = await response.json();

          // Create voice note record
          const voiceNoteId = await createVoiceNote({
            fileId: storageId,
            duration,
          });

          // Trigger processing (transcription + AI)
          processVoiceNote({ voiceNoteId }).catch(console.error);

          onRecordingComplete?.(voiceNoteId);
        } catch (error) {
          console.error("Failed to upload recording:", error);
        } finally {
          setIsRecording(false);
          setIsProcessing(false);
          setDuration(0);
          resolve();
        }
      };

      mediaRecorder.stop();
    });
  }, [duration, generateUploadUrl, createVoiceNote, processVoiceNote, onRecordingComplete]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isRecording && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-card border border-border rounded-full px-3 py-1 text-sm font-mono text-destructive animate-pulse">
          {formatDuration(duration)}
        </div>
      )}
      
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        className={`
          w-14 h-14 rounded-full flex items-center justify-center
          transition-all shadow-lg hover:shadow-xl
          ${isRecording 
            ? "bg-destructive hover:bg-destructive/90" 
            : "bg-primary hover:bg-primary/90"
          }
          ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}
        `}
        title={isRecording ? "Stop recording" : "Start voice note"}
      >
        {isProcessing ? (
          <Loader2 className="w-6 h-6 text-primary-foreground animate-spin" />
        ) : isRecording ? (
          <Square className="w-5 h-5 text-destructive-foreground" />
        ) : (
          <Mic className="w-6 h-6 text-primary-foreground" />
        )}
      </button>
    </div>
  );
}
```

#### 4. Add VoiceRecorder to Main Page
**File**: `src/app/page.tsx`

Add import and component:
```typescript
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";

// Inside the return, before closing </div>:
<VoiceRecorder />
```

### Success Criteria:

#### Automated Verification:
- [ ] Build passes: `pnpm build`
- [ ] Schema migration applies: `npx convex dev` shows no errors
- [ ] TypeScript compiles: `pnpm tsc --noEmit`

#### Manual Verification:
- [ ] Mic button appears in bottom-right corner
- [ ] Click mic starts recording (browser permission prompt)
- [ ] Timer shows recording duration
- [ ] Click stop uploads audio to Convex
- [ ] Voice note record created in database

---

## Phase 2: Transcription & AI Processing

### Overview
Add Whisper API transcription and AI concept extraction to create atomic notes.

### Changes Required:

#### 1. Transcription API Route
**File**: `src/app/api/transcribe/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audioFile = formData.get("audio") as File;

  if (!audioFile) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }

  // Create form data for OpenAI
  const openAIFormData = new FormData();
  openAIFormData.append("file", audioFile);
  openAIFormData.append("model", "whisper-1");
  openAIFormData.append("response_format", "json");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: openAIFormData,
  });

  if (!response.ok) {
    const error = await response.json();
    return NextResponse.json({ error: error.message }, { status: response.status });
  }

  const result = await response.json();
  return NextResponse.json({ transcription: result.text });
}
```

#### 2. AI Concept Extraction API Route
**File**: `src/app/api/extract-concepts/route.ts` (new file)

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 60;

const ConceptsSchema = z.object({
  concepts: z.array(z.object({
    title: z.string().describe("A short title for this atomic concept (3-7 words)"),
    content: z.string().describe("The atomic note content, one clear idea"),
    suggestedLinks: z.array(z.string()).describe("Suggested [[wiki-links]] to related concepts"),
    tags: z.array(z.string()).describe("1-3 relevant tags"),
  })),
  summary: z.string().describe("One sentence summary of the entire transcription"),
});

export async function POST(req: Request) {
  const { transcription, existingNotes } = await req.json();

  const existingNotesList = existingNotes
    ?.map((n: { content: string }) => `- ${n.content.slice(0, 100)}`)
    .join("\n") || "None yet";

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-20250514"),
    schema: ConceptsSchema,
    prompt: `You are a Zettelkasten assistant. Analyze this voice note transcription and extract atomic concepts.

TRANSCRIPTION:
${transcription}

EXISTING NOTES IN SYSTEM:
${existingNotesList}

INSTRUCTIONS:
1. Break the transcription into atomic concepts (single ideas that stand alone)
2. Each concept should be self-contained and understandable without context
3. Suggest [[wiki-links]] to connect related concepts (both new and existing)
4. Use the exact note content for links when referencing existing notes
5. Keep each concept concise but complete
6. Add relevant tags for categorization

Return 1-5 atomic concepts depending on the content density.`,
  });

  return Response.json(object);
}
```

#### 3. Voice Note Processing Action
**File**: `convex/voiceNotes.ts` (add to existing)

```typescript
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

// Process voice note: transcribe + extract concepts + create nodes
export const process = action({
  args: { voiceNoteId: v.id("voiceNotes") },
  handler: async (ctx, args) => {
    // Get voice note
    const voiceNote = await ctx.runQuery(api.voiceNotes.get, { id: args.voiceNoteId });
    if (!voiceNote) throw new Error("Voice note not found");

    // Update status to transcribing
    await ctx.runMutation(api.voiceNotes.updateStatus, {
      id: args.voiceNoteId,
      status: "transcribing",
    });

    try {
      // Get audio file URL
      const audioUrl = await ctx.runQuery(api.voiceNotes.getAudioUrl, {
        fileId: voiceNote.fileId,
      });
      if (!audioUrl) throw new Error("Audio file not found");

      // Fetch audio file
      const audioResponse = await fetch(audioUrl);
      const audioBlob = await audioResponse.blob();

      // Transcribe via API route
      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.webm");

      const transcribeResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/transcribe`,
        { method: "POST", body: formData }
      );

      if (!transcribeResponse.ok) {
        throw new Error("Transcription failed");
      }

      const { transcription } = await transcribeResponse.json();

      // Update with transcription
      await ctx.runMutation(api.voiceNotes.updateStatus, {
        id: args.voiceNoteId,
        status: "processing",
        transcription,
      });

      // Get existing notes for context
      const existingNodes = await ctx.runQuery(api.canvas.listNodes);

      // Extract concepts via AI
      const extractResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/extract-concepts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcription,
            existingNotes: existingNodes.map((n) => ({ content: n.content })),
          }),
        }
      );

      if (!extractResponse.ok) {
        throw new Error("Concept extraction failed");
      }

      const { concepts } = await extractResponse.json();

      // Create nodes for each concept
      let xOffset = 0;
      for (const concept of concepts) {
        const nodeId = await ctx.runMutation(api.canvas.createNode, {
          type: "note",
          content: `# ${concept.title}\n\n${concept.content}\n\n${concept.suggestedLinks.map((l: string) => `[[${l}]]`).join(" ")}`,
          x: 100 + xOffset,
          y: 100,
          sourceType: "voice",
          sourceId: args.voiceNoteId,
        });

        // Embed the node
        await ctx.runAction(api.embeddings.embedCanvasNode, {
          nodeId,
          content: concept.content,
        });

        // Find and create edges to related nodes
        const related = await ctx.runAction(api.embeddings.findRelated, {
          query: concept.content,
          limit: 3,
        });

        for (const relatedNode of related.nodes) {
          if (relatedNode && relatedNode._id !== nodeId) {
            await ctx.runMutation(api.canvas.createEdge, {
              source: nodeId,
              target: relatedNode._id,
              label: `${Math.round(relatedNode.score * 100)}%`,
            });
          }
        }

        xOffset += 350;
      }

      // Mark complete
      await ctx.runMutation(api.voiceNotes.updateStatus, {
        id: args.voiceNoteId,
        status: "completed",
      });

      return { success: true, conceptCount: concepts.length };
    } catch (error) {
      await ctx.runMutation(api.voiceNotes.updateStatus, {
        id: args.voiceNoteId,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  },
});
```

#### 4. Update Canvas Schema for sourceType
**File**: `convex/schema.ts`

Update `createNode` mutation args to include sourceType and sourceId.

#### 5. Update Canvas Mutation
**File**: `convex/canvas.ts`

```typescript
export const createNode = mutation({
  args: {
    type: v.union(
      v.literal("text"),
      v.literal("chat_reference"),
      v.literal("note"),
    ),
    content: v.string(),
    x: v.number(),
    y: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    messageId: v.optional(v.id("messages")),
    conversationId: v.optional(v.id("conversations")),
    // NEW
    sourceType: v.optional(v.union(
      v.literal("manual"),
      v.literal("voice"),
      v.literal("chat"),
      v.literal("ai_extracted")
    )),
    sourceId: v.optional(v.id("voiceNotes")),
    parentNodeId: v.optional(v.id("canvasNodes")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("canvasNodes", {
      type: args.type,
      content: args.content,
      x: args.x,
      y: args.y,
      width: args.width ?? 300,
      height: args.height ?? 150,
      messageId: args.messageId,
      conversationId: args.conversationId,
      sourceType: args.sourceType ?? "manual",
      sourceId: args.sourceId,
      parentNodeId: args.parentNodeId,
      createdAt: now,
      updatedAt: now,
    });
  },
});
```

### Success Criteria:

#### Automated Verification:
- [ ] Build passes: `pnpm build`
- [ ] API routes respond: `curl -X POST /api/transcribe` returns expected structure
- [ ] TypeScript compiles: `pnpm tsc --noEmit`

#### Manual Verification:
- [ ] Record a voice note saying "I want to learn about React hooks and state management"
- [ ] Transcription appears in voice note record
- [ ] 1-3 atomic note nodes created on canvas
- [ ] Notes have semantic links to each other
- [ ] Notes contain [[wiki-links]] in content

---

## Phase 3: Wiki Links & Auto-Suggestions

### Overview
Parse `[[wiki-links]]` from note content, show link suggestions while editing, and resolve links to actual nodes.

### Changes Required:

#### 1. Link Parser Utility
**File**: `src/lib/links.ts` (new file)

```typescript
// Extract [[wiki-links]] from content
export function extractWikiLinks(content: string): string[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1]);
  }
  return links;
}

// Convert [[links]] to clickable elements (for rendering)
export function parseWikiLinks(
  content: string,
  onLinkClick: (linkText: string) => void
): React.ReactNode[] {
  const parts = content.split(/(\[\[[^\]]+\]\])/g);
  return parts.map((part, i) => {
    const match = part.match(/\[\[([^\]]+)\]\]/);
    if (match) {
      return (
        <button
          key={i}
          onClick={() => onLinkClick(match[1])}
          className="text-primary hover:underline font-medium"
        >
          {match[1]}
        </button>
      );
    }
    return part;
  });
}
```

#### 2. Link Suggestions Component
**File**: `src/components/canvas/LinkSuggestions.tsx` (new file)

```typescript
"use client";

import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface LinkSuggestionsProps {
  currentText: string;
  onSelectLink: (linkText: string) => void;
  position: { x: number; y: number };
}

export function LinkSuggestions({ currentText, onSelectLink, position }: LinkSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Array<{ content: string; score: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const findRelated = useAction(api.embeddings.findRelated);

  useEffect(() => {
    if (currentText.length < 10) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await findRelated({ query: currentText, limit: 5 });
        setSuggestions(
          results.nodes
            .filter((n): n is NonNullable<typeof n> => n !== null)
            .map((n) => ({ content: n.content, score: n.score }))
        );
      } catch (e) {
        console.error("Failed to get suggestions:", e);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [currentText, findRelated]);

  if (suggestions.length === 0 && !isLoading) return null;

  return (
    <div
      className="absolute z-50 bg-popover border border-border rounded-lg shadow-lg p-2 w-64 max-h-48 overflow-y-auto"
      style={{ left: position.x, top: position.y }}
    >
      <div className="text-xs text-muted-foreground mb-2">Link suggestions</div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Finding related notes...</div>
      ) : (
        <div className="space-y-1">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onSelectLink(s.content.split("\n")[0].replace(/^#\s*/, ""))}
              className="w-full text-left p-2 rounded hover:bg-muted text-sm truncate"
            >
              {s.content.slice(0, 50)}...
              <span className="text-xs text-muted-foreground ml-2">
                {Math.round(s.score * 100)}%
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### 3. Update Note Node with Link Rendering
**File**: `src/components/canvas/nodes/NoteNode.tsx`

Update to render `[[wiki-links]]` as clickable and show suggestions while editing.

### Success Criteria:

#### Automated Verification:
- [ ] Build passes: `pnpm build`
- [ ] Link parser extracts links correctly (unit test)

#### Manual Verification:
- [ ] Type `[[` in a note shows suggestion dropdown
- [ ] Clicking suggestion inserts `[[link text]]`
- [ ] `[[links]]` render as clickable in view mode
- [ ] Clicking a link navigates/highlights the linked node

---

## Phase 4: Backlinks Panel

### Overview
Add a Zettelkasten-style backlinks panel showing incoming links and semantically related notes with AI explanations.

### Changes Required:

#### 1. Backlinks Query
**File**: `convex/canvas.ts` (add)

```typescript
// Get backlinks for a node
export const getBacklinks = query({
  args: { nodeId: v.id("canvasNodes") },
  handler: async (ctx, args) => {
    // Get edges where this node is the target
    const incomingEdges = await ctx.db
      .query("canvasEdges")
      .withIndex("by_target", (q) => q.eq("target", args.nodeId))
      .collect();

    // Get source nodes
    const sourceNodes = await Promise.all(
      incomingEdges.map(async (edge) => {
        const node = await ctx.db.get(edge.source);
        return node ? { ...node, edgeLabel: edge.label } : null;
      })
    );

    return sourceNodes.filter(Boolean);
  },
});
```

#### 2. AI Explanation Action
**File**: `convex/embeddings.ts` (add)

```typescript
// Explain relationship between two nodes
export const explainRelationship = action({
  args: {
    sourceContent: v.string(),
    targetContent: v.string(),
  },
  handler: async (ctx, args) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/explain-link`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: args.sourceContent,
          target: args.targetContent,
        }),
      }
    );

    if (!response.ok) throw new Error("Failed to explain relationship");
    return await response.json();
  },
});
```

#### 3. Explain Link API Route
**File**: `src/app/api/explain-link/route.ts` (new file)

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export async function POST(req: Request) {
  const { source, target } = await req.json();

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    prompt: `Explain in ONE sentence why these two notes might be related:

NOTE 1: ${source.slice(0, 200)}

NOTE 2: ${target.slice(0, 200)}

Be concise and insightful. Focus on conceptual connections.`,
  });

  return Response.json({ explanation: text });
}
```

#### 4. Backlinks Panel Component
**File**: `src/components/canvas/BacklinksPanel.tsx` (new file)

```typescript
"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { Link2, Sparkles, X } from "lucide-react";

interface BacklinksPanelProps {
  nodeId: Id<"canvasNodes"> | null;
  nodeContent: string;
  onClose: () => void;
  onNavigateToNode: (nodeId: Id<"canvasNodes">) => void;
}

export function BacklinksPanel({ 
  nodeId, 
  nodeContent, 
  onClose, 
  onNavigateToNode 
}: BacklinksPanelProps) {
  const backlinks = useQuery(
    api.canvas.getBacklinks,
    nodeId ? { nodeId } : "skip"
  );
  const findRelated = useAction(api.embeddings.findRelated);
  const [semanticLinks, setSemanticLinks] = useState<Array<{
    _id: string;
    content: string;
    score: number;
  }>>([]);
  const [explanations, setExplanations] = useState<Record<string, string>>({});

  // Fetch semantically related notes
  useEffect(() => {
    if (!nodeContent) return;

    findRelated({ query: nodeContent, limit: 5 }).then((results) => {
      setSemanticLinks(
        results.nodes
          .filter((n): n is NonNullable<typeof n> => n !== null && n._id !== nodeId)
          .map((n) => ({ _id: n._id, content: n.content, score: n.score }))
      );
    });
  }, [nodeContent, nodeId, findRelated]);

  if (!nodeId) return null;

  return (
    <div className="w-80 bg-card border-l border-border h-full overflow-y-auto">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          Backlinks
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Direct Backlinks */}
      <div className="p-4 border-b border-border">
        <h4 className="text-sm font-medium text-muted-foreground mb-2">
          Linked from ({backlinks?.length ?? 0})
        </h4>
        {backlinks?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No incoming links yet</p>
        ) : (
          <div className="space-y-2">
            {backlinks?.map((node) => (
              <button
                key={node._id}
                onClick={() => onNavigateToNode(node._id)}
                className="w-full text-left p-2 rounded bg-secondary/50 hover:bg-secondary text-sm"
              >
                <div className="truncate">{node.content.slice(0, 60)}...</div>
                {node.edgeLabel && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {node.edgeLabel}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Semantic Links */}
      <div className="p-4">
        <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
          <Sparkles className="w-3 h-3" />
          Related by meaning ({semanticLinks.length})
        </h4>
        <div className="space-y-2">
          {semanticLinks.map((node) => (
            <button
              key={node._id}
              onClick={() => onNavigateToNode(node._id as Id<"canvasNodes">)}
              className="w-full text-left p-2 rounded bg-secondary/50 hover:bg-secondary text-sm"
            >
              <div className="truncate">{node.content.slice(0, 60)}...</div>
              <div className="text-xs text-muted-foreground mt-1">
                {Math.round(node.score * 100)}% similar
              </div>
              {explanations[node._id] && (
                <div className="text-xs text-accent mt-1 italic">
                  {explanations[node._id]}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

#### 5. Integrate Backlinks Panel into Canvas
**File**: `src/components/canvas/MemexCanvas.tsx`

Add state for selected node and render BacklinksPanel.

### Success Criteria:

#### Automated Verification:
- [ ] Build passes: `pnpm build`
- [ ] Backlinks query returns correct nodes

#### Manual Verification:
- [ ] Click a node shows backlinks panel
- [ ] Panel shows direct incoming links
- [ ] Panel shows semantically related notes
- [ ] Clicking a backlink navigates to that node
- [ ] AI explanations appear for semantic links

---

## Testing Strategy

### Unit Tests:
- Link parser extracts `[[wiki-links]]` correctly
- Duration formatting works

### Integration Tests:
- Voice note upload creates record
- Processing pipeline completes end-to-end

### Manual Testing Steps:
1. Record a 30-second voice note about "React state management"
2. Verify transcription appears
3. Verify 2-4 atomic notes created
4. Verify notes have `[[wiki-links]]`
5. Click a note, verify backlinks panel shows
6. Record another voice note mentioning similar concepts
7. Verify new notes link to previous ones

## Performance Considerations

- Whisper API calls are async, don't block UI
- Debounce link suggestions (500ms)
- Cache AI explanations to avoid repeated calls
- Limit semantic search to 5 results

## Environment Variables Required

```
OPENAI_API_KEY=xxx          # For Whisper + embeddings
ANTHROPIC_API_KEY=xxx       # For Claude (already exists)
NEXT_PUBLIC_APP_URL=http://localhost:3005  # For internal API calls
```

## References

- Market research: Reflect, Tana, Heptabase patterns
- Convex file storage: https://docs.convex.dev/file-storage
- OpenAI Whisper API: https://platform.openai.com/docs/guides/speech-to-text
- Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
