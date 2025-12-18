"use client";

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { CommandItem } from "@/lib/tiptap/slash-commands";

interface CommandListProps extends SuggestionProps<CommandItem> {}

export interface CommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export const CommandList = forwardRef<CommandListRef, CommandListProps>(
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
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
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
        <div className="slash-command-menu bg-card border border-border rounded-lg shadow-lg p-3 text-sm text-muted-foreground">
          No commands found
        </div>
      );
    }

    return (
      <div className="slash-command-menu bg-card border border-border rounded-lg shadow-lg py-1 min-w-[220px] max-h-[300px] overflow-y-auto">
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
            <span className="w-8 h-8 flex items-center justify-center bg-secondary rounded text-sm font-mono text-foreground">
              {item.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-foreground text-sm">{item.title}</div>
              <div className="text-xs text-muted-foreground truncate">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

CommandList.displayName = "CommandList";
