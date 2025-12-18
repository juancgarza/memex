# Phase 2: Slash Commands for Notes Editor

## Overview

Add Notion-style slash commands to the TipTap editor. When users type `/`, a dropdown menu appears with formatting options and block types they can insert.

## Desired End State

After implementation:
1. Typing `/` opens a command menu
2. Menu shows available commands (headings, lists, code blocks, etc.)
3. User can filter commands by typing (e.g., `/head` filters to heading options)
4. Arrow keys navigate the menu, Enter/click selects
5. Escape closes the menu
6. Selected command is applied at cursor position

**Commands to support:**
- `/h1`, `/h2`, `/h3` - Headings
- `/bullet` - Bullet list
- `/numbered` - Numbered list
- `/quote` - Blockquote
- `/code` - Code block
- `/divider` - Horizontal rule
- `/todo` - Task/checkbox item (stretch goal)

## Current State Analysis

**What exists:**
- TipTap editor in `src/components/notes/NoteEditor.tsx`
- `@tiptap/suggestion` package already installed
- StarterKit provides heading, list, blockquote, code extensions

**What's needed:**
- Slash command extension using `@tiptap/suggestion`
- Command menu UI component
- Keyboard navigation logic

## Implementation Approach

TipTap's suggestion extension handles the hard parts:
1. Detecting when to show suggestions (after `/`)
2. Filtering based on query text
3. Keyboard navigation

We just need to:
1. Configure the suggestion extension for `/` trigger
2. Create a menu component to render suggestions
3. Define the available commands

---

## Phase 2.1: Create Slash Command Extension

### Overview
Create a TipTap extension that triggers suggestions when `/` is typed.

### Changes Required:

#### 1. Create SlashCommand Extension
**File**: `src/lib/tiptap/slash-commands.tsx` (new)

```typescript
import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import { CommandList } from "@/components/notes/CommandList";

export interface CommandItem {
  title: string;
  description: string;
  icon: string;
  command: ({ editor, range }: { editor: any; range: any }) => void;
}

export const SlashCommands = Extension.create({
  name: "slashCommands",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
```

#### 2. Define Available Commands
**File**: `src/lib/tiptap/slash-commands.tsx`

```typescript
export const getSuggestionItems = ({ query }: { query: string }): CommandItem[] => {
  const items: CommandItem[] = [
    {
      title: "Heading 1",
      description: "Large section heading",
      icon: "H1",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
      },
    },
    {
      title: "Heading 2",
      description: "Medium section heading",
      icon: "H2",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
      },
    },
    {
      title: "Heading 3",
      description: "Small section heading",
      icon: "H3",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
      },
    },
    {
      title: "Bullet List",
      description: "Create a bullet list",
      icon: "•",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: "Numbered List",
      description: "Create a numbered list",
      icon: "1.",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "Quote",
      description: "Add a blockquote",
      icon: "❝",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      title: "Code Block",
      description: "Add a code block",
      icon: "</>",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      title: "Divider",
      description: "Add a horizontal divider",
      icon: "—",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
  ];

  return items.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase())
  );
};
```

### Success Criteria:
- [ ] Extension created and exports SlashCommands
- [ ] getSuggestionItems returns filtered commands

---

## Phase 2.2: Create Command Menu Component

### Overview
Create a React component that renders the command dropdown menu.

### Changes Required:

#### 1. Create CommandList Component
**File**: `src/components/notes/CommandList.tsx` (new)

```typescript
"use client";

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { CommandItem } from "@/lib/tiptap/slash-commands";

interface CommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
}

export const CommandList = forwardRef<any, CommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command(item);
        }
      },
      [items, command]
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    if (items.length === 0) {
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-2 text-sm text-muted-foreground">
          No commands found
        </div>
      );
    }

    return (
      <div className="bg-card border border-border rounded-lg shadow-lg py-1 min-w-[200px] max-h-[300px] overflow-y-auto">
        {items.map((item, index) => (
          <button
            key={item.title}
            onClick={() => selectItem(index)}
            className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
              index === selectedIndex
                ? "bg-muted"
                : "hover:bg-muted/50"
            }`}
          >
            <span className="w-8 h-8 flex items-center justify-center bg-muted rounded text-sm font-mono">
              {item.icon}
            </span>
            <div>
              <div className="font-medium text-foreground">{item.title}</div>
              <div className="text-xs text-muted-foreground">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

CommandList.displayName = "CommandList";
```

### Success Criteria:
- [ ] CommandList renders list of commands
- [ ] Keyboard navigation works (up/down/enter)
- [ ] Click selection works
- [ ] Selected item is highlighted

---

## Phase 2.3: Integrate with TipTap Editor

### Overview
Wire up the slash command extension with the editor and menu rendering.

### Changes Required:

#### 1. Update Slash Commands with Rendering Logic
**File**: `src/lib/tiptap/slash-commands.tsx`

Add tippy.js rendering (or use a simpler approach with React portals):

```typescript
import { ReactRenderer } from "@tiptap/react";
import tippy, { Instance } from "tippy.js";

export const suggestionConfig = {
  items: getSuggestionItems,
  render: () => {
    let component: ReactRenderer | null = null;
    let popup: Instance[] | null = null;

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(CommandList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) return;

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        });
      },
      onUpdate(props: any) {
        component?.updateProps(props);
        if (props.clientRect) {
          popup?.[0]?.setProps({
            getReferenceClientRect: props.clientRect,
          });
        }
      },
      onKeyDown(props: any) {
        if (props.event.key === "Escape") {
          popup?.[0]?.hide();
          return true;
        }
        return component?.ref?.onKeyDown(props);
      },
      onExit() {
        popup?.[0]?.destroy();
        component?.destroy();
      },
    };
  },
};
```

#### 2. Add Extension to NoteEditor
**File**: `src/components/notes/NoteEditor.tsx`

```typescript
import { SlashCommands, suggestionConfig } from "@/lib/tiptap/slash-commands";

// In useEditor extensions array:
SlashCommands.configure({
  suggestion: suggestionConfig,
}),
```

#### 3. Install tippy.js
```bash
pnpm add tippy.js
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm tsc --noEmit`
- [ ] Build passes: `pnpm build`

#### Manual Verification:
- [ ] Type `/` in editor → menu appears
- [ ] Type `/h` → filters to heading options
- [ ] Arrow keys navigate menu
- [ ] Enter selects command
- [ ] Escape closes menu
- [ ] Click selects command
- [ ] Selected formatting is applied

---

## Phase 2.4: Add Styles for Command Menu

### Overview
Add CSS for tippy.js popup and command menu styling.

### Changes Required:

#### 1. Add Tippy Styles
**File**: `src/app/globals.css`

```css
/* Slash Command Menu */
.tippy-box {
  background: transparent;
  border: none;
  padding: 0;
}

.tippy-content {
  padding: 0;
}
```

### Success Criteria:
- [ ] Menu appears in correct position
- [ ] Menu styling matches app theme
- [ ] Menu is visible in both light and dark modes

---

## Testing Strategy

### Manual Testing Steps:
1. Open a note in the editor
2. Type `/` - menu should appear
3. Type `/h1` - should filter to Heading 1
4. Press Enter - should create H1
5. Type `/bullet` - should create bullet list
6. Test all commands work correctly
7. Test Escape closes menu
8. Test clicking outside closes menu

### Edge Cases:
- `/` at start of document
- `/` in middle of text
- `/` inside code block (should not trigger)
- Rapid typing
- Empty filter results

## Dependencies

- `tippy.js` - For positioning the popup menu
- `@tiptap/suggestion` - Already installed

## References

- TipTap Suggestion docs: https://tiptap.dev/docs/editor/api/utilities/suggestion
- Existing editor: `src/components/notes/NoteEditor.tsx`
