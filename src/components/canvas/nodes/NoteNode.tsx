"use client";

import { Handle, Position, NodeProps } from "@xyflow/react";
import { useState } from "react";

interface NoteNodeData {
  content: string;
  onContentChange: (content: string) => void;
  onDelete: () => void;
  onFindRelated: () => void;
}

export function NoteNode({ data }: NodeProps) {
  const { content, onContentChange, onDelete, onFindRelated } =
    data as unknown as NoteNodeData;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  const handleBlur = () => {
    setIsEditing(false);
    if (editContent !== content) {
      onContentChange(editContent);
    }
  };

  return (
    <div className="group relative bg-[hsl(var(--node-note-bg))] border-2 border-[hsl(var(--node-note-border))] rounded-lg p-3 min-w-[200px] max-w-[400px] shadow-md hover:shadow-lg transition-shadow">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[hsl(var(--node-note-accent))] !w-3 !h-3"
      />

      {/* Action buttons */}
      <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={onFindRelated}
          className="p-1 bg-accent hover:bg-accent/80 rounded-full"
          title="Find related"
        >
          <svg
            className="w-3 h-3 text-accent-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="p-1 bg-destructive hover:bg-destructive/80 rounded-full"
          title="Delete"
        >
          <svg
            className="w-3 h-3 text-destructive-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <svg
          className="w-4 h-4 text-[hsl(var(--node-note-accent))]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        <span className="text-xs text-[hsl(var(--node-note-accent))] font-medium">Note</span>
      </div>

      {isEditing ? (
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onBlur={handleBlur}
          autoFocus
          className="w-full bg-background text-foreground text-sm p-2 rounded border border-[hsl(var(--node-note-border))]/50 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--node-note-accent))] resize-none"
          rows={4}
        />
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className="text-foreground text-sm cursor-text whitespace-pre-wrap"
        >
          {content}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[hsl(var(--node-note-accent))] !w-3 !h-3"
      />
    </div>
  );
}
