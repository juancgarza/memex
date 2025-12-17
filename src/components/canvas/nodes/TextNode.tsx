"use client";

import { Handle, Position, NodeProps } from "@xyflow/react";
import { useState } from "react";

interface TextNodeData {
  content: string;
  onContentChange: (content: string) => void;
  onDelete: () => void;
  onFindRelated: () => void;
}

export function TextNode({ data }: NodeProps) {
  const { content, onContentChange, onDelete, onFindRelated } =
    data as unknown as TextNodeData;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  const handleBlur = () => {
    setIsEditing(false);
    if (editContent !== content) {
      onContentChange(editContent);
    }
  };

  return (
    <div className="group relative bg-card border-2 border-border rounded-lg p-3 min-w-[200px] max-w-[400px] shadow-md hover:shadow-lg transition-shadow">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-primary !w-3 !h-3"
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

      {isEditing ? (
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onBlur={handleBlur}
          autoFocus
          className="w-full bg-background text-foreground text-sm p-2 rounded border border-input focus:outline-none focus:ring-2 focus:ring-ring resize-none"
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
        className="!bg-primary !w-3 !h-3"
      />
    </div>
  );
}
