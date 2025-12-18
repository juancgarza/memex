# Phase 3: NoteEditor Improvements - Implementation Plan

## Overview

Refactor the NoteEditor to follow best practices from tiptap-templates/next-block-editor-app, improving performance, code organization, and user experience with features like grouped slash commands, text selection menus, and wiki-link auto-suggestions.

## Current State Analysis

**What exists:**
- `NoteEditor.tsx` with inline TipTap configuration
- `slash-commands.tsx` with flat command list
- `CommandList.tsx` with basic keyboard navigation
- `wiki-link.ts` extension with click handlers
- CSS styles in `globals.css` for editor

**Key Issues:**
- `immediatelyRender: false` causes flicker
- Missing `shouldRerenderOnTransaction: false` for performance
- Extensions defined inline, not centralized
- Slash commands lack groups, aliases, and icons
- No text selection menu (BubbleMenu)
- No wiki-link autocomplete when typing `[[`

## Desired End State

After implementation:
1. Editor uses custom `useNoteEditor` hook with optimized settings
2. Extensions centralized in `extension-kit.ts`
3. Slash commands organized into groups with Lucide icons and aliases
4. Text selection shows formatting toolbar (bold, italic, wiki-link)
5. Typing `[[` triggers note title autocomplete

**Verification:**
- Editor loads without flicker
- `/h1` alias works for Heading 1
- Selecting text shows bubble menu
- Typing `[[` shows note suggestions

## What We're NOT Doing

- Collaboration features (Yjs, cursor sync)
- AI writing features
- Image upload/drag-drop
- Table support
- Multi-column layouts
- Font family/size pickers

## Implementation Approach

Follow tiptap-templates patterns incrementally:
1. Extract editor logic into custom hook
2. Centralize extensions
3. Enhance slash commands
4. Add bubble menu
5. Add wiki-link suggestions

---

## Phase 1: Extract useNoteEditor Hook & Performance Optimization

### Overview
Create a custom hook following the template's `useBlockEditor` pattern with performance optimizations.

### Changes Required:

#### 1. Create useNoteEditor Hook
**File**: `src/hooks/useNoteEditor.ts` (new)

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";
import { useEditor } from "@tiptap/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import { WikiLink, convertWikiLinksToHTML } from "@/lib/tiptap/wiki-link";
import { SlashCommands, setCommandListComponent } from "@/lib/tiptap/slash-commands";
import { CommandList } from "@/components/notes/CommandList";

// Register CommandList component
setCommandListComponent(CommandList);

interface UseNoteEditorOptions {
  initialContent?: string;
  onUpdate?: (content: string) => void;
  onLinkClick?: (title: string) => void;
}

export const useNoteEditor = ({
  initialContent = "",
  onUpdate,
  onLinkClick,
}: UseNoteEditorOptions) => {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const editor = useEditor(
    {
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      autofocus: false,
      onCreate: ({ editor }) => {
        if (initialContent) {
          const htmlContent = initialContent.includes("<")
            ? initialContent
            : convertWikiLinksToHTML(initialContent);
          editor.commands.setContent(htmlContent);
        }
      },
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          horizontalRule: false,
          bold: false,
          italic: false,
        }),
        HorizontalRule.extend({
          addInputRules() { return []; },
        }),
        Bold.extend({
          addInputRules() { return []; },
        }),
        Italic.extend({
          addInputRules() { return []; },
        }),
        Placeholder.configure({
          placeholder: 'Type "/" for commands...',
        }),
        WikiLink.configure({
          onLinkClick,
        }),
        SlashCommands,
      ],
      editorProps: {
        attributes: {
          class: "note-editor-content focus:outline-none min-h-[60vh]",
        },
      },
      onUpdate: ({ editor }) => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          onUpdate?.(editor.getHTML());
        }, 500);
      },
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return { editor };
};
```

#### 2. Update NoteEditor to Use Hook
**File**: `src/components/notes/NoteEditor.tsx`

Refactor to use the new hook, removing inline editor configuration.

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm tsc --noEmit`
- [ ] Build passes: `pnpm build`

#### Manual Verification:
- [ ] Editor loads without flicker
- [ ] Content saves correctly
- [ ] Wiki-links still clickable
- [ ] Slash commands still work

---

## Phase 2: Create Extension Kit Pattern

### Overview
Centralize all TipTap extensions into a single configuration file.

### Changes Required:

#### 1. Create Extension Kit
**File**: `src/lib/tiptap/extension-kit.ts` (new)

```typescript
"use client";

import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import CharacterCount from "@tiptap/extension-character-count";
import { WikiLink } from "./wiki-link";
import { SlashCommands } from "./slash-commands";

interface ExtensionKitOptions {
  onLinkClick?: (title: string) => void;
  placeholder?: string;
}

export const ExtensionKit = ({ onLinkClick, placeholder }: ExtensionKitOptions) => [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    horizontalRule: false,
    bold: false,
    italic: false,
  }),
  HorizontalRule.extend({
    addInputRules() { return []; },
  }),
  Bold.extend({
    addInputRules() { return []; },
  }),
  Italic.extend({
    addInputRules() { return []; },
  }),
  Placeholder.configure({
    placeholder: placeholder || 'Type "/" for commands...',
  }),
  CharacterCount.configure({
    limit: 50000,
  }),
  WikiLink.configure({
    onLinkClick,
  }),
  SlashCommands,
];

export default ExtensionKit;
```

#### 2. Update useNoteEditor to Use Extension Kit
**File**: `src/hooks/useNoteEditor.ts`

Replace inline extensions with `ExtensionKit({ onLinkClick })`.

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm tsc --noEmit`
- [ ] Build passes: `pnpm build`

#### Manual Verification:
- [ ] All existing functionality works
- [ ] Character count available via `editor.storage.characterCount`

---

## Phase 3: Enhanced Slash Commands with Groups & Aliases

### Overview
Refactor slash commands to use grouped structure with Lucide icons and search aliases.

### Changes Required:

#### 1. Create Command Types
**File**: `src/lib/tiptap/slash-command-types.ts` (new)

```typescript
import { Editor } from "@tiptap/core";
import { icons } from "lucide-react";

export interface Command {
  name: string;
  label: string;
  description: string;
  aliases?: string[];
  iconName: keyof typeof icons;
  action: (editor: Editor) => void;
  shouldBeHidden?: (editor: Editor) => boolean;
}

export interface Group {
  name: string;
  title: string;
  commands: Command[];
}
```

#### 2. Create Command Groups
**File**: `src/lib/tiptap/slash-command-groups.ts` (new)

```typescript
import { Group } from "./slash-command-types";

export const COMMAND_GROUPS: Group[] = [
  {
    name: "format",
    title: "Format",
    commands: [
      {
        name: "heading1",
        label: "Heading 1",
        iconName: "Heading1",
        description: "Large section heading",
        aliases: ["h1"],
        action: (editor) => editor.chain().focus().setHeading({ level: 1 }).run(),
      },
      {
        name: "heading2",
        label: "Heading 2",
        iconName: "Heading2",
        description: "Medium section heading",
        aliases: ["h2"],
        action: (editor) => editor.chain().focus().setHeading({ level: 2 }).run(),
      },
      {
        name: "heading3",
        label: "Heading 3",
        iconName: "Heading3",
        description: "Small section heading",
        aliases: ["h3"],
        action: (editor) => editor.chain().focus().setHeading({ level: 3 }).run(),
      },
      {
        name: "bulletList",
        label: "Bullet List",
        iconName: "List",
        description: "Unordered list of items",
        aliases: ["ul", "bullet"],
        action: (editor) => editor.chain().focus().toggleBulletList().run(),
      },
      {
        name: "numberedList",
        label: "Numbered List",
        iconName: "ListOrdered",
        description: "Ordered list of items",
        aliases: ["ol", "numbered"],
        action: (editor) => editor.chain().focus().toggleOrderedList().run(),
      },
      {
        name: "blockquote",
        label: "Quote",
        iconName: "Quote",
        description: "Add a blockquote",
        aliases: ["quote"],
        action: (editor) => editor.chain().focus().setBlockquote().run(),
      },
      {
        name: "codeBlock",
        label: "Code Block",
        iconName: "Code",
        description: "Code block with syntax highlighting",
        aliases: ["code"],
        action: (editor) => editor.chain().focus().setCodeBlock().run(),
      },
    ],
  },
  {
    name: "insert",
    title: "Insert",
    commands: [
      {
        name: "horizontalRule",
        label: "Divider",
        iconName: "Minus",
        description: "Insert a horizontal divider",
        aliases: ["hr", "divider"],
        action: (editor) => editor.chain().focus().setHorizontalRule().run(),
      },
      {
        name: "paragraph",
        label: "Text",
        iconName: "Pilcrow",
        description: "Plain paragraph text",
        aliases: ["p", "text"],
        action: (editor) => editor.chain().focus().setParagraph().run(),
      },
    ],
  },
];
```

#### 3. Update SlashCommands Extension
**File**: `src/lib/tiptap/slash-commands.tsx`

Update to use groups, filter by aliases, and handle group structure.

#### 4. Update CommandList Component
**File**: `src/components/notes/CommandList.tsx`

Add group headers, Lucide icons, and two-dimensional keyboard navigation.

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm tsc --noEmit`
- [ ] Build passes: `pnpm build`

#### Manual Verification:
- [ ] `/h1` filters to Heading 1
- [ ] `/ul` filters to Bullet List
- [ ] Groups show with headers
- [ ] Lucide icons render correctly
- [ ] Keyboard navigation works across groups

---

## Phase 4: Add Text Selection Menu (BubbleMenu)

### Overview
Add a floating toolbar that appears when text is selected.

### Changes Required:

#### 1. Create TextMenu Component
**File**: `src/components/notes/TextMenu.tsx` (new)

```typescript
"use client";

import { BubbleMenu, Editor } from "@tiptap/react";
import { Bold, Italic, Strikethrough, Code, Link2 } from "lucide-react";
import { useCallback } from "react";

interface TextMenuProps {
  editor: Editor;
}

export function TextMenu({ editor }: TextMenuProps) {
  const toggleBold = useCallback(() => {
    editor.chain().focus().toggleBold().run();
  }, [editor]);

  const toggleItalic = useCallback(() => {
    editor.chain().focus().toggleItalic().run();
  }, [editor]);

  const toggleStrike = useCallback(() => {
    editor.chain().focus().toggleStrike().run();
  }, [editor]);

  const toggleCode = useCallback(() => {
    editor.chain().focus().toggleCode().run();
  }, [editor]);

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100 }}
      className="bg-card border border-border rounded-lg shadow-lg flex items-center gap-0.5 p-1"
    >
      <button
        onClick={toggleBold}
        className={`p-1.5 rounded hover:bg-muted transition-colors ${
          editor.isActive("bold") ? "bg-muted text-primary" : ""
        }`}
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        onClick={toggleItalic}
        className={`p-1.5 rounded hover:bg-muted transition-colors ${
          editor.isActive("italic") ? "bg-muted text-primary" : ""
        }`}
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        onClick={toggleStrike}
        className={`p-1.5 rounded hover:bg-muted transition-colors ${
          editor.isActive("strike") ? "bg-muted text-primary" : ""
        }`}
      >
        <Strikethrough className="w-4 h-4" />
      </button>
      <button
        onClick={toggleCode}
        className={`p-1.5 rounded hover:bg-muted transition-colors ${
          editor.isActive("code") ? "bg-muted text-primary" : ""
        }`}
      >
        <Code className="w-4 h-4" />
      </button>
    </BubbleMenu>
  );
}
```

#### 2. Add TextMenu to NoteEditor
**File**: `src/components/notes/NoteEditor.tsx`

Import and render `<TextMenu editor={editor} />` after `<EditorContent />`.

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm tsc --noEmit`
- [ ] Build passes: `pnpm build`

#### Manual Verification:
- [ ] Select text → bubble menu appears
- [ ] Click Bold → text becomes bold
- [ ] Active states show correctly
- [ ] Menu hides when selection cleared

---

## Phase 5: Add Wiki-Link Auto-suggestion

### Overview
Add autocomplete when typing `[[` to suggest existing note titles.

### Changes Required:

#### 1. Create WikiLinkSuggestion Extension
**File**: `src/lib/tiptap/wiki-link-suggestion.ts` (new)

Create a suggestion extension that triggers on `[[` and shows note titles.

#### 2. Create WikiLinkList Component
**File**: `src/components/notes/WikiLinkList.tsx` (new)

Dropdown component showing matching note titles.

#### 3. Integrate with Extension Kit
**File**: `src/lib/tiptap/extension-kit.ts`

Add WikiLinkSuggestion to the extension kit.

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm tsc --noEmit`
- [ ] Build passes: `pnpm build`

#### Manual Verification:
- [ ] Type `[[` → dropdown appears with note titles
- [ ] Type `[[Pro` → filters to matching notes
- [ ] Select note → inserts `[[Note Title]]`
- [ ] Escape closes dropdown

---

## Testing Strategy

### Manual Testing Steps:
1. Open Notes view
2. Create/open a note
3. Verify editor loads without flicker
4. Test slash commands with aliases (`/h1`, `/ul`)
5. Select text and verify bubble menu
6. Test formatting buttons in bubble menu
7. Type `[[` and verify suggestions appear
8. Test keyboard navigation in all menus

### Edge Cases:
- Empty notes list for wiki-link suggestions
- Very long note titles
- Rapid typing
- Nested lists and blockquotes

## Performance Considerations

- `shouldRerenderOnTransaction: false` prevents unnecessary re-renders
- Debounced saves (500ms) reduce Convex mutations
- Memoized callbacks in TextMenu
- Character count limit (50,000) prevents performance issues

## References

- Template: `tiptap-templates/templates/next-block-editor-app/`
- useBlockEditor pattern: `tiptap-templates/.../hooks/useBlockEditor.ts`
- Extension kit pattern: `tiptap-templates/.../extensions/extension-kit.ts`
- SlashCommand groups: `tiptap-templates/.../extensions/SlashCommand/groups.ts`
- TextMenu pattern: `tiptap-templates/.../components/menus/TextMenu/`
