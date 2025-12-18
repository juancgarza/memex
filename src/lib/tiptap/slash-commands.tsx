"use client";

import { Extension, Editor } from "@tiptap/core";
import Suggestion, {
  SuggestionProps,
  SuggestionKeyDownProps,
} from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { Instance, Props } from "tippy.js";
import { PluginKey } from "@tiptap/pm/state";
import { Group, Command } from "./slash-command-types";

// Command groups with Lucide icons and search aliases
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
        aliases: ["h1", "title"],
        action: (editor) => {
          editor.chain().focus().setNode("heading", { level: 1 }).run();
        },
      },
      {
        name: "heading2",
        label: "Heading 2",
        iconName: "Heading2",
        description: "Medium section heading",
        aliases: ["h2", "subtitle"],
        action: (editor) => {
          editor.chain().focus().setNode("heading", { level: 2 }).run();
        },
      },
      {
        name: "heading3",
        label: "Heading 3",
        iconName: "Heading3",
        description: "Small section heading",
        aliases: ["h3"],
        action: (editor) => {
          editor.chain().focus().setNode("heading", { level: 3 }).run();
        },
      },
      {
        name: "bulletList",
        label: "Bullet List",
        iconName: "List",
        description: "Unordered list of items",
        aliases: ["ul", "bullet", "unordered"],
        action: (editor) => {
          editor.chain().focus().toggleBulletList().run();
        },
      },
      {
        name: "numberedList",
        label: "Numbered List",
        iconName: "ListOrdered",
        description: "Ordered list of items",
        aliases: ["ol", "numbered", "ordered"],
        action: (editor) => {
          editor.chain().focus().toggleOrderedList().run();
        },
      },
      {
        name: "blockquote",
        label: "Quote",
        iconName: "Quote",
        description: "Add a blockquote",
        aliases: ["quote", "blockquote"],
        action: (editor) => {
          editor.chain().focus().wrapIn("blockquote").run();
        },
      },
      {
        name: "codeBlock",
        label: "Code Block",
        iconName: "Code",
        description: "Code block with syntax highlighting",
        aliases: ["code", "pre"],
        action: (editor) => {
          editor.chain().focus().setNode("codeBlock").run();
        },
      },
    ],
  },
  {
    name: "insert",
    title: "Insert",
    commands: [
      {
        name: "paragraph",
        label: "Text",
        iconName: "Pilcrow",
        description: "Plain paragraph text",
        aliases: ["p", "text", "paragraph"],
        action: (editor) => {
          editor.chain().focus().setNode("paragraph").run();
        },
      },
      {
        name: "horizontalRule",
        label: "Divider",
        iconName: "Minus",
        description: "Insert a horizontal divider",
        aliases: ["hr", "divider", "line"],
        action: (editor) => {
          editor.chain().focus().setHorizontalRule().run();
        },
      },
    ],
  },
];

// Filter commands based on query, checking both label and aliases
export const filterCommandGroups = (
  groups: Group[],
  query: string,
  editor: Editor
): Group[] => {
  const queryLower = query.toLowerCase().trim();

  const filteredGroups = groups
    .map((group) => ({
      ...group,
      commands: group.commands.filter((command) => {
        // Check if command should be hidden
        if (command.shouldBeHidden?.(editor)) {
          return false;
        }

        // Match against label
        if (command.label.toLowerCase().includes(queryLower)) {
          return true;
        }

        // Match against aliases
        if (command.aliases?.some((alias) => alias.includes(queryLower))) {
          return true;
        }

        return false;
      }),
    }))
    .filter((group) => group.commands.length > 0);

  return filteredGroups;
};

// Import CommandList dynamically to avoid circular deps
let CommandListComponent: React.ComponentType<any> | null = null;

export const setCommandListComponent = (
  component: React.ComponentType<any>
) => {
  CommandListComponent = component;
};

export const renderSuggestion = () => {
  let component: ReactRenderer | null = null;
  let popup: Instance<Props>[] | null = null;

  return {
    onStart: (props: SuggestionProps<Group[]>) => {
      if (!CommandListComponent) {
        console.error("CommandList component not set");
        return;
      }

      component = new ReactRenderer(CommandListComponent, {
        props: {
          ...props,
          items: props.items,
        },
        editor: props.editor,
      });

      if (!props.clientRect) return;

      popup = tippy("body", {
        getReferenceClientRect: props.clientRect as () => DOMRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: "manual",
        placement: "bottom-start",
      });
    },

    onUpdate(props: SuggestionProps<Group[]>) {
      component?.updateProps({
        ...props,
        items: props.items,
      });

      if (!props.clientRect) return;

      popup?.[0]?.setProps({
        getReferenceClientRect: props.clientRect as () => DOMRect,
      });
    },

    onKeyDown(props: SuggestionKeyDownProps) {
      if (props.event.key === "Escape") {
        popup?.[0]?.hide();
        return true;
      }

      return (component?.ref as any)?.onKeyDown(props) ?? false;
    },

    onExit() {
      popup?.[0]?.destroy();
      component?.destroy();
    },
  };
};

const extensionName = "slashCommands";

export const SlashCommands = Extension.create({
  name: extensionName,

  priority: 200,

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        allowSpaces: true,
        startOfLine: true,
        pluginKey: new PluginKey(extensionName),
        allow: ({ state, range }: { state: any; range: any }) => {
          const $from = state.doc.resolve(range.from);
          const isRootDepth = $from.depth === 1;
          const isParagraph = $from.parent.type.name === "paragraph";
          const isStartOfNode = $from.parent.textContent?.charAt(0) === "/";

          const afterContent = $from.parent.textContent?.substring(
            $from.parent.textContent?.indexOf("/")
          );
          const isValidAfterContent = !afterContent?.endsWith("  ");

          return isRootDepth && isParagraph && isStartOfNode && isValidAfterContent;
        },
        command: ({ editor, props }: { editor: Editor; props: any }) => {
          const { view, state } = editor;
          const { $head, $from } = view.state.selection;

          const end = $from.pos;
          // Get text before cursor in current node
          const textBefore = $head?.nodeBefore?.text || "";
          const slashIndex = textBefore.lastIndexOf("/");
          
          let from: number;
          if (slashIndex !== -1) {
            // Delete from the "/" to cursor
            from = end - (textBefore.length - slashIndex);
          } else {
            // Fallback: delete from start of current text node
            from = end - textBefore.length;
          }

          // Delete the slash command text
          const tr = state.tr.deleteRange(from, end);
          view.dispatch(tr);

          // Execute the command action (transforms the current block)
          props.action(editor);
          view.focus();
        },
        items: ({ query, editor }: { query: string; editor: Editor }) => {
          return filterCommandGroups(COMMAND_GROUPS, query, editor) as any;
        },
        render: renderSuggestion,
      }),
    ];
  },
});

// Re-export types for backward compatibility
export type { Command as CommandItem, Group, Command };
