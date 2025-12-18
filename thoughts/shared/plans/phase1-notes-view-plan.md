# Phase 1: Notes View & TipTap Editor - Implementation Plan

## Overview

Add a Notion-like full-page notes view to Memex alongside the existing Chat and Canvas views. Users can browse, create, and edit notes with a rich TipTap editor that supports `[[wiki-links]]`.

## Current State Analysis

**What exists:**
- TipTap packages installed (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/suggestion`, etc.)
- WikiLink extension at `src/lib/tiptap/wiki-link.ts` with click handlers
- Canvas nodes with `type: "note"` stored in Convex
- View toggle pattern (chat/canvas) in `src/app/page.tsx:26-29`
- ChatSidebar pattern we can follow for NotesSidebar

**What's missing:**
- Notes view in the view toggle
- NotesSidebar component to browse notes
- NoteEditor component using TipTap
- Full-page note editing experience

## Desired End State

After implementation:
1. User sees three view options: Chat, Canvas, Notes
2. Notes view shows a sidebar with all notes (sorted by updated date)
3. Clicking a note opens it in a full-page TipTap editor
4. User can create new notes from the sidebar
5. `[[wiki-links]]` render as clickable styled spans
6. Clicking a wiki-link navigates to that note (or creates it if missing)
7. Changes auto-save to Convex

**Verification:**
- Toggle to Notes view → see list of existing notes
- Click a note → opens in editor with full content
- Type `[[some link]]` → renders as styled link
- Click the link → navigates to/creates that note
- Edit content → saves automatically

## What We're NOT Doing

- Wiki-link autocomplete/suggestions (Phase 2)
- Backlinks panel (Phase 3)
- Canvas ↔ Notes navigation integration (Phase 4)
- Mobile-optimized notes editing
- Markdown import/export
- Note folders/hierarchy

## Implementation Approach

Keep it simple:
1. Add "notes" view to existing view toggle
2. Create NotesSidebar following ChatSidebar patterns
3. Create NoteEditor with TipTap + existing WikiLink extension
4. Add Convex query for finding notes by title (for wiki-link navigation)

---

## Phase 1.1: Add Notes View Toggle

### Overview
Extend the existing view toggle to include a "Notes" option.

### Changes Required:

#### 1. Update View Type
**File**: `src/app/page.tsx`

Change line 26:
```typescript
// Before
type View = "chat" | "canvas";

// After
type View = "chat" | "canvas" | "notes";
```

#### 2. Add Notes Button to Desktop Toggle
**File**: `src/app/page.tsx`

Update the desktop view toggle (around line 165-189) to add a Notes button:
```typescript
<button
  onClick={() => setView("notes")}
  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
    view === "notes"
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground"
  }`}
>
  Notes
</button>
```

#### 3. Add Notes Button to Mobile Bottom Nav
**File**: `src/app/page.tsx`

Update mobile nav (around line 261-286) to add Notes option with icon.

#### 4. Add Notes View Conditional Rendering
**File**: `src/app/page.tsx`

Add after the canvas conditional (around line 254-258):
```typescript
{view === "notes" && (
  <NotesView />
)}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm tsc --noEmit`
- [x] Build passes: `pnpm build`

#### Manual Verification:
- [x] Three buttons visible in desktop header (Chat, Canvas, Notes)
- [x] Three buttons visible in mobile bottom nav
- [x] Clicking Notes shows empty/placeholder view

---

## Phase 1.2: Create NotesSidebar Component

### Overview
Create a sidebar to list and manage notes, following ChatSidebar patterns.

### Changes Required:

#### 1. Create NotesSidebar Component
**File**: `src/components/notes/NotesSidebar.tsx` (new)

```typescript
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { FileText, Plus, Trash2 } from "lucide-react";

interface NotesSidebarProps {
  selectedId: Id<"canvasNodes"> | null;
  onSelect: (id: Id<"canvasNodes">) => void;
  onClose?: () => void;
}

export function NotesSidebar({ selectedId, onSelect, onClose }: NotesSidebarProps) {
  const notes = useQuery(api.canvas.listNotes);
  const createNode = useMutation(api.canvas.createNode);
  const deleteNode = useMutation(api.canvas.deleteNode);

  const handleNewNote = async () => {
    const id = await createNode({
      type: "note",
      content: "# Untitled\n\nStart writing...",
      x: 0,
      y: 0,
      sourceType: "manual",
    });
    onSelect(id);
    onClose?.();
  };

  const handleDelete = async (id: Id<"canvasNodes">, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNode({ id });
  };

  // Extract title from note content (first line or # heading)
  const getTitle = (content: string) => {
    const firstLine = content.split("\n")[0];
    return firstLine.replace(/^#\s*/, "").trim() || "Untitled";
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="w-72 md:w-64 bg-card border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Notes</h2>
        <button
          onClick={handleNewNote}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          title="New note"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto">
        {notes?.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground text-center">
            No notes yet. Create one to get started.
          </div>
        )}
        {notes?.map((note) => (
          <div
            key={note._id}
            onClick={() => {
              onSelect(note._id);
              onClose?.();
            }}
            className={`group px-4 py-3 cursor-pointer border-b border-border transition-colors ${
              selectedId === note._id
                ? "bg-muted"
                : "hover:bg-muted/50"
            }`}
          >
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate text-foreground">
                    {getTitle(note.content)}
                  </span>
                  <button
                    onClick={(e) => handleDelete(note._id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-all"
                    title="Delete note"
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(note.updatedAt)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 2. Add Convex Query for Notes
**File**: `convex/canvas.ts`

Add a query to list only note-type nodes, sorted by updatedAt:
```typescript
export const listNotes = query({
  args: {},
  handler: async (ctx) => {
    const nodes = await ctx.db.query("canvasNodes").collect();
    return nodes
      .filter((node) => node.type === "note")
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm tsc --noEmit`
- [x] Build passes: `pnpm build`

#### Manual Verification:
- [ ] NotesSidebar displays list of existing notes
- [ ] Notes show title extracted from content
- [ ] Notes show last updated date
- [ ] "New" button creates a new note
- [ ] Delete button removes note
- [ ] Clicking note triggers onSelect callback

---

## Phase 1.3: Create NoteEditor Component

### Overview
Create a TipTap-based editor for editing notes with wiki-link support.

### Changes Required:

#### 1. Create NoteEditor Component
**File**: `src/components/notes/NoteEditor.tsx` (new)

```typescript
"use client";

import { useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { WikiLink } from "@/lib/tiptap/wiki-link";

interface NoteEditorProps {
  noteId: Id<"canvasNodes">;
  onNavigate: (noteId: Id<"canvasNodes">) => void;
}

export function NoteEditor({ noteId, onNavigate }: NoteEditorProps) {
  const note = useQuery(api.canvas.getNodeById, { id: noteId });
  const updateNode = useMutation(api.canvas.updateNode);
  const createNode = useMutation(api.canvas.createNode);
  const findByTitle = useQuery(api.canvas.findNoteByTitle, { title: "" }); // placeholder

  // Handle wiki-link clicks
  const handleLinkClick = useCallback(async (title: string) => {
    // TODO: Find note by title and navigate, or create if not found
    console.log("Link clicked:", title);
  }, [onNavigate]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
      WikiLink.configure({
        onLinkClick: handleLinkClick,
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-200px)] p-4",
      },
    },
    onUpdate: ({ editor }) => {
      // Debounced save
      const content = editor.getHTML();
      updateNode({ id: noteId, content });
    },
  });

  // Sync content when note loads or changes
  useEffect(() => {
    if (editor && note?.content) {
      // Only update if content is different to avoid cursor jumps
      const currentContent = editor.getHTML();
      if (currentContent !== note.content) {
        editor.commands.setContent(note.content);
      }
    }
  }, [editor, note?.content]);

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto py-8">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
```

#### 2. Add Editor Styles
**File**: `src/app/globals.css`

Add TipTap-specific styles:
```css
/* TipTap Editor Styles */
.ProseMirror {
  outline: none;
}

.ProseMirror p.is-editor-empty:first-child::before {
  color: hsl(var(--muted-foreground));
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

/* Wiki link styling */
.wiki-link {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-decoration-color: hsl(var(--primary) / 0.5);
  cursor: pointer;
  font-weight: 500;
}

.wiki-link:hover {
  text-decoration-color: hsl(var(--primary));
}
```

#### 3. Fix WikiLink Extension Types
**File**: `src/lib/tiptap/wiki-link.ts`

Update to fix TypeScript errors and add proper types.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm tsc --noEmit`
- [x] Build passes: `pnpm build`

#### Manual Verification:
- [ ] Editor loads note content
- [ ] Can type and format text (headings, bold, italic, lists)
- [ ] Changes save automatically
- [ ] `[[link]]` text renders with wiki-link styling
- [ ] Clicking wiki-link logs to console (navigation in later phase)

---

## Phase 1.4: Create NotesView Container

### Overview
Combine NotesSidebar and NoteEditor into a complete Notes view.

### Changes Required:

#### 1. Create NotesView Component
**File**: `src/components/notes/NotesView.tsx` (new)

```typescript
"use client";

import { useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { NotesSidebar } from "./NotesSidebar";
import { NoteEditor } from "./NoteEditor";
import { FileText } from "lucide-react";

export function NotesView() {
  const [selectedNoteId, setSelectedNoteId] = useState<Id<"canvasNodes"> | null>(null);

  const handleNavigate = (noteId: Id<"canvasNodes">) => {
    setSelectedNoteId(noteId);
  };

  return (
    <div className="flex h-full">
      <NotesSidebar
        selectedId={selectedNoteId}
        onSelect={setSelectedNoteId}
      />
      
      {selectedNoteId ? (
        <NoteEditor
          noteId={selectedNoteId}
          onNavigate={handleNavigate}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-background">
          <FileText className="w-12 h-12 mb-4 opacity-50" />
          <p>Select a note or create a new one</p>
        </div>
      )}
    </div>
  );
}
```

#### 2. Add Import and Render in Page
**File**: `src/app/page.tsx`

Add import at top:
```typescript
import { NotesView } from "@/components/notes/NotesView";
```

Add conditional render for notes view:
```typescript
{view === "notes" && <NotesView />}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm tsc --noEmit`
- [x] Build passes: `pnpm build`

#### Manual Verification:
- [ ] Notes view shows sidebar + empty state
- [ ] Clicking note shows editor
- [ ] Can edit and save notes
- [ ] Can create new notes
- [ ] Can delete notes

---

## Phase 1.5: Wiki-Link Navigation

### Overview
Implement navigation when clicking `[[wiki-links]]` - find existing note by title or create new one.

### Changes Required:

#### 1. Add findNoteByTitle Query
**File**: `convex/canvas.ts`

```typescript
export const findNoteByTitle = query({
  args: { title: v.string() },
  handler: async (ctx, args) => {
    if (!args.title) return null;
    
    const nodes = await ctx.db.query("canvasNodes").collect();
    const notes = nodes.filter((n) => n.type === "note");
    
    // Find note where title matches (first line or # heading)
    return notes.find((note) => {
      const firstLine = note.content.split("\n")[0];
      const noteTitle = firstLine.replace(/^#\s*/, "").trim();
      return noteTitle.toLowerCase() === args.title.toLowerCase();
    }) || null;
  },
});
```

#### 2. Implement Link Click Handler
**File**: `src/components/notes/NoteEditor.tsx`

Update handleLinkClick to find or create note:
```typescript
const handleLinkClick = useCallback(async (title: string) => {
  // Find existing note by title
  const existingNote = await findNoteByTitle({ title });
  
  if (existingNote) {
    onNavigate(existingNote._id);
  } else {
    // Create new note with this title
    const newId = await createNode({
      type: "note",
      content: `# ${title}\n\n`,
      x: 0,
      y: 0,
      sourceType: "manual",
    });
    onNavigate(newId);
  }
}, [onNavigate, createNode]);
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm tsc --noEmit`
- [x] Build passes: `pnpm build`

#### Manual Verification:
- [ ] Type `[[Existing Note Title]]` → click → navigates to that note
- [ ] Type `[[New Note Title]]` → click → creates new note with that title
- [ ] New note opens in editor with title as heading

---

## Testing Strategy

### Manual Testing Steps:
1. Start app with `pnpm dev` and `npx convex dev`
2. Toggle to Notes view
3. Create a new note
4. Edit content with headings, lists, bold text
5. Type `[[Another Note]]` and verify styling
6. Create "Another Note" manually
7. Click the wiki-link → should navigate
8. Delete a note from sidebar
9. Verify changes persist after refresh

### Edge Cases:
- Empty notes list
- Very long note titles
- Special characters in wiki-links
- Rapid switching between notes

## Performance Considerations

- Debounce content saves (every 500ms, not every keystroke)
- Only update editor content when note changes (avoid cursor jumps)
- Lazy load TipTap editor

## References

- Existing WikiLink extension: `src/lib/tiptap/wiki-link.ts`
- ChatSidebar pattern: `src/components/chat/ChatSidebar.tsx`
- View toggle pattern: `src/app/page.tsx:165-189`
- Convex canvas functions: `convex/canvas.ts`
