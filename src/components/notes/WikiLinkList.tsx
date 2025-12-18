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
import { WikiLinkSuggestionItem } from "@/lib/tiptap/wiki-link-suggestion";
import { FileText, Plus } from "lucide-react";

interface WikiLinkListProps {
  items: WikiLinkSuggestionItem[];
  command: (item: WikiLinkSuggestionItem) => void;
  query: string;
}

export interface WikiLinkListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export const WikiLinkList = forwardRef<WikiLinkListRef, WikiLinkListProps>(
  ({ items, command, query }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const activeItemRef = useRef<HTMLButtonElement>(null);

    // Include "create new" option if query doesn't match any existing note exactly
    const hasExactMatch = items.some(
      (item) => item.title.toLowerCase() === query.toLowerCase()
    );
    const showCreateOption = query.trim() && !hasExactMatch;
    const totalItems = items.length + (showCreateOption ? 1 : 0);

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [items, query]);

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
          container.scrollTop =
            offsetTop + offsetHeight - container.offsetHeight;
        }
      }
    }, [selectedIndex]);

    const selectItem = useCallback(
      (index: number) => {
        if (showCreateOption && index === items.length) {
          // Create new note option selected
          command({ id: "new", title: query.trim() });
        } else {
          const item = items[index];
          if (item) {
            command(item);
          }
        }
      },
      [items, command, query, showCreateOption]
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === "ArrowDown") {
          if (!totalItems) return false;
          setSelectedIndex((prev) => (prev + 1) % totalItems);
          return true;
        }

        if (event.key === "ArrowUp") {
          if (!totalItems) return false;
          setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
          return true;
        }

        if (event.key === "Enter") {
          if (!totalItems) return false;
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }));

    if (!totalItems) {
      return (
        <div className="wiki-link-menu bg-card border border-border rounded-lg shadow-lg p-3 text-sm text-muted-foreground">
          No notes found
        </div>
      );
    }

    return (
      <div
        ref={scrollContainerRef}
        className="wiki-link-menu bg-card border border-border rounded-lg shadow-lg py-1 min-w-[220px] max-h-[280px] overflow-y-auto"
      >
        {/* Existing notes */}
        {items.map((item, index) => {
          const isActive = selectedIndex === index;

          return (
            <button
              key={item.id}
              ref={isActive ? activeItemRef : null}
              onClick={() => selectItem(index)}
              className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                isActive ? "bg-muted" : "hover:bg-muted/50"
              }`}
            >
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-medium text-foreground text-sm truncate">
                {item.title}
              </span>
            </button>
          );
        })}

        {/* Create new option */}
        {showCreateOption && (
          <>
            {items.length > 0 && (
              <div className="border-t border-border my-1" />
            )}
            <button
              ref={selectedIndex === items.length ? activeItemRef : null}
              onClick={() => selectItem(items.length)}
              className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                selectedIndex === items.length ? "bg-muted" : "hover:bg-muted/50"
              }`}
            >
              <Plus className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm">
                <span className="text-muted-foreground">Create </span>
                <span className="font-medium text-foreground">
                  &quot;{query.trim()}&quot;
                </span>
              </span>
            </button>
          </>
        )}
      </div>
    );
  }
);

WikiLinkList.displayName = "WikiLinkList";
