"use client";

import { useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { NotesSidebar } from "./NotesSidebar";
import { NoteEditor } from "./NoteEditor";
import { FileText } from "lucide-react";

export function NotesView() {
  const [selectedNoteId, setSelectedNoteId] = useState<Id<"canvasNodes"> | null>(null);

  const handleNavigate = (noteId: Id<"canvasNodes">) => {
    setSelectedNoteId(noteId);
  };

  return (
    <div className="flex h-full">
      <NotesSidebar
        selectedId={selectedNoteId}
        onSelect={setSelectedNoteId}
      />
      
      <div className="flex-1 flex flex-col bg-background">
        {selectedNoteId ? (
          <NoteEditor
            noteId={selectedNoteId}
            onNavigate={handleNavigate}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="flex flex-col items-center">
              <FileText className="w-12 h-12 mb-4 opacity-50" />
              <p>Select a note or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
