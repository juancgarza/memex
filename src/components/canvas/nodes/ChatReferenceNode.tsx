"use client";

import { Handle, Position, NodeProps } from "@xyflow/react";
import { Id } from "../../../../convex/_generated/dataModel";

interface ChatReferenceNodeData {
  content: string;
  messageId?: Id<"messages">;
  conversationId?: Id<"conversations">;
  onDelete: () => void;
  onFindRelated: () => void;
}

export function ChatReferenceNode({ data }: NodeProps) {
  const { content, onDelete, onFindRelated } = data as unknown as ChatReferenceNodeData;

  return (
    <div className="group relative bg-gradient-to-br from-[hsl(var(--node-chat-from))] to-[hsl(var(--node-chat-to))] border-2 border-[hsl(var(--node-chat-border))] rounded-lg p-3 min-w-[200px] max-w-[400px] shadow-md hover:shadow-lg transition-shadow">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[hsl(var(--node-chat-to))] !w-3 !h-3"
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
          className="w-4 h-4 text-[hsl(var(--node-chat-accent))]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <span className="text-xs text-[hsl(var(--node-chat-accent))] font-medium">From Chat</span>
      </div>

      <div className="text-[hsl(var(--node-chat-foreground))] text-sm whitespace-pre-wrap line-clamp-6">
        {content}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[hsl(var(--node-chat-to))] !w-3 !h-3"
      />
    </div>
  );
}
