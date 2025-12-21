"use client";

import { Id } from "../../../convex/_generated/dataModel";
import { NoteEditor } from "./NoteEditor";
import { FileText } from "lucide-react";

interface NotesViewProps {
  selectedNoteId: Id<"canvasNodes"> | null;
  onSelectNote: (id: Id<"canvasNodes">) => void;
  isMobile?: boolean;
  onOpenSidebar?: () => void;
}

export function NotesView({ selectedNoteId, onSelectNote, isMobile, onOpenSidebar }: NotesViewProps) {
  const handleNavigate = (noteId: Id<"canvasNodes">) => {
    onSelectNote(noteId);
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col bg-background">
        {selectedNoteId ? (
          <NoteEditor
            noteId={selectedNoteId}
            onNavigate={handleNavigate}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="flex flex-col items-center gap-4">
              <FileText className="w-12 h-12 opacity-50" />
              <p className="text-center">
                {isMobile
                  ? "Tap the menu to select a note"
                  : "Select a note or create a new one"}
              </p>
              {isMobile && onOpenSidebar && (
                <button
                  onClick={onOpenSidebar}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
                >
                  Open Notes
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
