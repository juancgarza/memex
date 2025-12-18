"use client";

import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import { SuggestionKeyDownProps } from "@tiptap/suggestion";
import { Group, Command } from "@/lib/tiptap/slash-command-types";
import { icons } from "lucide-react";
import { Editor } from "@tiptap/core";

interface CommandListProps {
  items: Group[];
  command: (command: Command) => void;
  editor: Editor;
}

export interface CommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export const CommandList = forwardRef<CommandListRef, CommandListProps>(
  ({ items, command }, ref) => {
    const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
    const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const activeItemRef = useRef<HTMLButtonElement>(null);

    // Reset selection when items change (user typing filters)
    useEffect(() => {
      setSelectedGroupIndex(0);
      setSelectedCommandIndex(0);
    }, [items]);

    // Auto-scroll to active item
    useEffect(() => {
      if (activeItemRef.current && scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const item = activeItemRef.current;
        const offsetTop = item.offsetTop;
        const offsetHeight = item.offsetHeight;

        if (offsetTop < container.scrollTop) {
          container.scrollTop = offsetTop;
        } else if (
          offsetTop + offsetHeight >
          container.scrollTop + container.offsetHeight
        ) {
          container.scrollTop = offsetTop + offsetHeight - container.offsetHeight;
        }
      }
    }, [selectedGroupIndex, selectedCommandIndex]);

    const selectItem = useCallback(
      (groupIndex: number, commandIndex: number) => {
        const group = items[groupIndex];
        const cmd = group?.commands[commandIndex];
        if (cmd) {
          command(cmd);
        }
      },
      [items, command]
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === "ArrowDown") {
          if (!items.length) return false;

          const currentGroup = items[selectedGroupIndex];
          let newCommandIndex = selectedCommandIndex + 1;
          let newGroupIndex = selectedGroupIndex;

          // Move to next group if at end of current group
          if (newCommandIndex >= currentGroup.commands.length) {
            newCommandIndex = 0;
            newGroupIndex = selectedGroupIndex + 1;
          }

          // Wrap to first group if at end
          if (newGroupIndex >= items.length) {
            newGroupIndex = 0;
          }

          setSelectedGroupIndex(newGroupIndex);
          setSelectedCommandIndex(newCommandIndex);
          return true;
        }

        if (event.key === "ArrowUp") {
          if (!items.length) return false;

          let newCommandIndex = selectedCommandIndex - 1;
          let newGroupIndex = selectedGroupIndex;

          // Move to previous group if at start of current group
          if (newCommandIndex < 0) {
            newGroupIndex = selectedGroupIndex - 1;
            if (newGroupIndex < 0) {
              newGroupIndex = items.length - 1;
            }
            newCommandIndex = items[newGroupIndex].commands.length - 1;
          }

          setSelectedGroupIndex(newGroupIndex);
          setSelectedCommandIndex(newCommandIndex);
          return true;
        }

        if (event.key === "Enter") {
          if (!items.length) return false;
          selectItem(selectedGroupIndex, selectedCommandIndex);
          return true;
        }

        return false;
      },
    }));

    if (!items.length) {
      return (
        <div className="slash-command-menu bg-card border border-border rounded-lg shadow-lg p-3 text-sm text-muted-foreground">
          No commands found
        </div>
      );
    }

    return (
      <div
        ref={scrollContainerRef}
        className="slash-command-menu bg-card border border-border rounded-lg shadow-lg py-1 min-w-[240px] max-h-[320px] overflow-y-auto"
      >
        {items.map((group, groupIndex) => (
          <div key={group.name}>
            {/* Group header */}
            <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider first:pt-1">
              {group.title}
            </div>

            {/* Group commands */}
            {group.commands.map((cmd: Command, commandIndex: number) => {
              const isActive =
                selectedGroupIndex === groupIndex &&
                selectedCommandIndex === commandIndex;
              const IconComponent = icons[cmd.iconName];

              return (
                <button
                  key={cmd.name}
                  ref={isActive ? activeItemRef : null}
                  onClick={() => selectItem(groupIndex, commandIndex)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                    isActive ? "bg-muted" : "hover:bg-muted/50"
                  }`}
                >
                  <span className="w-8 h-8 flex items-center justify-center bg-secondary rounded text-sm text-foreground">
                    {IconComponent && <IconComponent className="w-4 h-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm">
                      {cmd.label}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {cmd.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  }
);

CommandList.displayName = "CommandList";
