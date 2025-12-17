"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface SearchResult {
  _id: string;
  content: string;
  score: number;
  type: "message" | "node";
}

export function SemanticSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const findRelated = useAction(api.embeddings.findRelated);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setIsExpanded(true);
    try {
      const searchResults = await findRelated({ query, limit: 10 });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messageItems = (searchResults.messages as any[])
        .filter((m) => m !== null)
        .map((m) => ({
          _id: m._id as string,
          content: m.content as string,
          score: m.score as number,
          type: "message" as const,
        }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodeItems = (searchResults.nodes as any[])
        .filter((n) => n !== null)
        .map((n) => ({
          _id: n._id as string,
          content: n.content as string,
          score: n.score as number,
          type: "node" as const,
        }));

      const combined: SearchResult[] = [...messageItems, ...nodeItems].sort(
        (a, b) => b.score - a.score
      );

      setResults(combined);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="bg-card border-b border-border">
      <div className="p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              onFocus={() => results.length > 0 && setIsExpanded(true)}
              placeholder="Search your knowledge semantically..."
              className="w-full pl-10 pr-4 py-2 bg-secondary border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors text-sm"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="px-4 py-2 bg-accent hover:bg-accent/90 text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {isSearching ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              "Find"
            )}
          </button>
        </div>
      </div>

      {isExpanded && results.length > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              {results.length} related items found
            </span>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Hide
            </button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.map((result) => (
              <div
                key={result._id}
                className="p-3 bg-secondary/50 hover:bg-secondary rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      result.type === "message"
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-[hsl(var(--node-note-accent))]/20 text-[hsl(var(--node-note-accent))] border border-[hsl(var(--node-note-accent))]/30"
                    }`}
                  >
                    {result.type === "message" ? "Chat" : "Canvas"}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {(result.score * 100).toFixed(0)}% match
                  </span>
                </div>
                <p className="text-sm text-foreground line-clamp-2">
                  {result.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
