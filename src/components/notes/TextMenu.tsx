"use client";

import { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { useCallback, memo } from "react";

interface TextMenuProps {
  editor: Editor;
}

// Memoized button to prevent re-renders on every editor state change
const MenuButton = memo(function MenuButton({
  onClick,
  isActive,
  icon: Icon,
  tooltip,
}: {
  onClick: () => void;
  isActive: boolean;
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`p-1.5 rounded hover:bg-muted transition-colors ${
        isActive ? "bg-muted text-primary" : "text-foreground"
      }`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
});

export function TextMenu({ editor }: TextMenuProps) {
  // Format commands
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

  const toggleHeading1 = useCallback(() => {
    editor.chain().focus().toggleHeading({ level: 1 }).run();
  }, [editor]);

  const toggleHeading2 = useCallback(() => {
    editor.chain().focus().toggleHeading({ level: 2 }).run();
  }, [editor]);

  const toggleBulletList = useCallback(() => {
    editor.chain().focus().toggleBulletList().run();
  }, [editor]);

  const toggleOrderedList = useCallback(() => {
    editor.chain().focus().toggleOrderedList().run();
  }, [editor]);

  const toggleBlockquote = useCallback(() => {
    editor.chain().focus().toggleBlockquote().run();
  }, [editor]);

  // Determine if menu should show
  const shouldShow = useCallback(() => {
    // Don't show for empty selections or when editor is not editable
    if (!editor.isEditable) return false;

    const { state } = editor;
    const { selection } = state;
    const { empty } = selection;

    // Don't show on empty selection
    if (empty) return false;

    // Don't show inside code blocks
    if (editor.isActive("codeBlock")) return false;

    return true;
  }, [editor]);

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={shouldShow}
      className="bg-card border border-border rounded-lg shadow-lg flex items-center gap-0.5 p-1"
    >
      {/* Text formatting */}
      <MenuButton
        onClick={toggleBold}
        isActive={editor.isActive("bold")}
        icon={Bold}
        tooltip="Bold (Cmd+B)"
      />
      <MenuButton
        onClick={toggleItalic}
        isActive={editor.isActive("italic")}
        icon={Italic}
        tooltip="Italic (Cmd+I)"
      />
      <MenuButton
        onClick={toggleStrike}
        isActive={editor.isActive("strike")}
        icon={Strikethrough}
        tooltip="Strikethrough"
      />
      <MenuButton
        onClick={toggleCode}
        isActive={editor.isActive("code")}
        icon={Code}
        tooltip="Code (Cmd+E)"
      />

      {/* Divider */}
      <div className="w-px h-6 bg-border mx-1" />

      {/* Block types */}
      <MenuButton
        onClick={toggleHeading1}
        isActive={editor.isActive("heading", { level: 1 })}
        icon={Heading1}
        tooltip="Heading 1"
      />
      <MenuButton
        onClick={toggleHeading2}
        isActive={editor.isActive("heading", { level: 2 })}
        icon={Heading2}
        tooltip="Heading 2"
      />

      {/* Divider */}
      <div className="w-px h-6 bg-border mx-1" />

      {/* Lists */}
      <MenuButton
        onClick={toggleBulletList}
        isActive={editor.isActive("bulletList")}
        icon={List}
        tooltip="Bullet List"
      />
      <MenuButton
        onClick={toggleOrderedList}
        isActive={editor.isActive("orderedList")}
        icon={ListOrdered}
        tooltip="Numbered List"
      />
      <MenuButton
        onClick={toggleBlockquote}
        isActive={editor.isActive("blockquote")}
        icon={Quote}
        tooltip="Quote"
      />
    </BubbleMenu>
  );
}
