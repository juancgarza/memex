"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ChevronDown, ChevronRight, Link2 } from "lucide-react";
import { useState } from "react";

interface BacklinksPanelProps {
  noteTitle: string;
  currentNoteId: Id<"canvasNodes">;
  onNavigate: (noteId: Id<"canvasNodes">) => void;
}

export function BacklinksPanel({
  noteTitle,
  currentNoteId,
  onNavigate,
}: BacklinksPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const backlinks = useQuery(
    api.canvas.getWikiLinkBacklinks,
    noteTitle ? { noteTitle } : "skip"
  );

  // Filter out the current note from backlinks
  const filteredBacklinks = backlinks?.filter(
    (note) => note._id !== currentNoteId
  );

  // Don't render anything if there are no backlinks
  if (!filteredBacklinks || filteredBacklinks.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-border bg-muted/30">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <Link2 className="h-4 w-4" />
        <span>
          {filteredBacklinks.length} Backlink
          {filteredBacklinks.length !== 1 ? "s" : ""}
        </span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          <ul className="space-y-1">
            {filteredBacklinks.map((note) => (
              <li key={note._id}>
                <button
                  onClick={() => onNavigate(note._id)}
                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-foreground/80 hover:text-foreground"
                >
                  {note.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
