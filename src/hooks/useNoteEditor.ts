"use client";

import { useEffect, useRef } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import { WikiLink, convertWikiLinksToHTML } from "@/lib/tiptap/wiki-link";
import {
  SlashCommands,
  setCommandListComponent,
} from "@/lib/tiptap/slash-commands";
import { CommandList } from "@/components/notes/CommandList";

// Register CommandList component for slash commands
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
  const initialContentRef = useRef(initialContent);
  const onUpdateRef = useRef(onUpdate);
  const onLinkClickRef = useRef(onLinkClick);

  // Keep refs updated
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    onLinkClickRef.current = onLinkClick;
  }, [onLinkClick]);

  const editor = useEditor(
    {
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      autofocus: false,
      onCreate: ({ editor: createdEditor }) => {
        if (initialContentRef.current) {
          const htmlContent = initialContentRef.current.includes("<")
            ? initialContentRef.current
            : convertWikiLinksToHTML(initialContentRef.current);
          createdEditor.commands.setContent(htmlContent);
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
          addInputRules() {
            return [];
          },
        }),
        Bold.extend({
          addInputRules() {
            return [];
          },
        }),
        Italic.extend({
          addInputRules() {
            return [];
          },
        }),
        Placeholder.configure({
          placeholder: 'Type "/" for commands...',
        }),
        WikiLink.configure({
          onLinkClick: (title: string) => {
            onLinkClickRef.current?.(title);
          },
        }),
        SlashCommands,
      ],
      editorProps: {
        attributes: {
          class: "note-editor-content focus:outline-none min-h-[60vh]",
        },
      },
      onUpdate: ({ editor: updatedEditor }) => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          onUpdateRef.current?.(updatedEditor.getHTML());
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

  // Method to update content externally (e.g., when switching notes)
  const setContent = (content: string) => {
    if (editor) {
      const htmlContent = content.includes("<")
        ? content
        : convertWikiLinksToHTML(content);
      editor.commands.setContent(htmlContent);
    }
  };

  return { editor, setContent };
};
