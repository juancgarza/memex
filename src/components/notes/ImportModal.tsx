"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Link, Youtube, BookOpen, X, Loader2 } from "lucide-react";

type ImportType = "url" | "youtube" | "readwise";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (noteId: string) => void;
}

export function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const [importType, setImportType] = useState<ImportType>("url");
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createNode = useMutation(api.canvas.createNode);
  const embedNode = useAction(api.embeddings.embedCanvasNode);

  const handleImport = async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Determine endpoint based on import type
      const endpoint =
        importType === "youtube" ? "/api/import/youtube" : "/api/import/url";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Import failed");
      }

      const data = await response.json();

      // Create note in Convex
      const nodeId = await createNode({
        type: "note",
        content: data.content,
        x: 0,
        y: 0,
        sourceType: importType === "youtube" ? "youtube" : "web",
        sourceUrl: data.sourceUrl,
      });

      // Generate embedding
      await embedNode({
        nodeId,
        content: data.content,
      });

      // Success
      setUrl("");
      onSuccess(nodeId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Import Content</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Import Type Tabs */}
        <div className="flex border-b border-border">
          {[
            { type: "url" as const, icon: Link, label: "Web Page" },
            { type: "youtube" as const, icon: Youtube, label: "YouTube" },
            { type: "readwise" as const, icon: BookOpen, label: "Readwise" },
          ].map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => setImportType(type)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                importType === type
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {importType === "readwise" ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Readwise sync coming soon</p>
              <p className="text-sm mt-1">
                Configure READWISE_ACCESS_TOKEN in .env.local
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {importType === "youtube" ? "YouTube URL" : "Web Page URL"}
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={
                    importType === "youtube"
                      ? "https://youtube.com/watch?v=..."
                      : "https://example.com/article"
                  }
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={!url.trim() || isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Import"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
