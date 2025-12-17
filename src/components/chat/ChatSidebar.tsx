"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Plus, Trash2 } from "lucide-react";

interface ChatSidebarProps {
  selectedId: Id<"conversations"> | null;
  onSelect: (id: Id<"conversations">) => void;
}

export function ChatSidebar({ selectedId, onSelect }: ChatSidebarProps) {
  const conversations = useQuery(api.conversations.list);
  const createConversation = useMutation(api.conversations.create);
  const removeConversation = useMutation(api.conversations.remove);

  const handleNew = async () => {
    const id = await createConversation({});
    onSelect(id);
  };

  const handleDelete = async (
    e: React.MouseEvent,
    id: Id<"conversations">
  ) => {
    e.stopPropagation();
    await removeConversation({ id });
    if (selectedId === id) {
      onSelect(conversations?.[0]?._id ?? null!);
    }
  };

  return (
    <div className="w-72 md:w-64 bg-card border-r border-border flex flex-col h-full max-h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <button
          onClick={handleNew}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 md:py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors active:scale-95"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {conversations?.length === 0 && (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No conversations yet
          </div>
        )}
        {conversations?.map(
          (conv: {
            _id: Id<"conversations">;
            title: string;
            updatedAt: number;
          }) => (
            <div
              key={conv._id}
              onClick={() => onSelect(conv._id)}
              className={`group px-4 py-4 md:py-3 cursor-pointer border-b border-border hover:bg-muted transition-colors active:bg-muted/80 ${
                selectedId === conv._id ? "bg-muted" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground truncate flex-1">
                  {conv.title}
                </span>
                <button
                  onClick={(e) => handleDelete(e, conv._id)}
                  className="opacity-0 group-hover:opacity-100 md:group-hover:opacity-100 p-2 md:p-1 hover:bg-destructive/10 rounded transition-all flex-shrink-0"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(conv.updatedAt).toLocaleDateString()}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
