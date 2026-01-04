import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Internal mutation to update message embedding
// Note: Internal mutations are only called by actions that have already verified auth
export const updateMessageEmbedding = internalMutation({
  args: {
    id: v.id("messages"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      embedding: args.embedding,
    });
  },
});

// Internal mutation to update canvas node embedding
export const updateNodeEmbedding = internalMutation({
  args: {
    id: v.id("canvasNodes"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      embedding: args.embedding,
    });
  },
});

// Action to embed a message (called from frontend after saving)
export const embedMessage = action({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify message belongs to user via the query (which has auth checks)
    const message = await ctx.runQuery(api.messages.getById, {
      id: args.messageId,
    });
    if (!message) throw new Error("Message not found or unauthorized");

    // Call OpenAI embedding API
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: args.content,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);
      throw new Error(data.error?.message ?? "Failed to generate embedding");
    }

    const embedding = data.data[0].embedding;

    // Store the embedding
    await ctx.runMutation(internal.embeddings.updateMessageEmbedding, {
      id: args.messageId,
      embedding,
    });

    return { success: true };
  },
});

// Action to embed a canvas node
export const embedCanvasNode = action({
  args: {
    nodeId: v.id("canvasNodes"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify node belongs to user via the query (which has auth checks)
    const node = await ctx.runQuery(api.canvas.getNodeById, { id: args.nodeId });
    if (!node) throw new Error("Node not found or unauthorized");

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: args.content,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);
      throw new Error(data.error?.message ?? "Failed to generate embedding");
    }

    const embedding = data.data[0].embedding;

    await ctx.runMutation(internal.embeddings.updateNodeEmbedding, {
      id: args.nodeId,
      embedding,
    });

    return { success: true };
  },
});

// Types for the findRelated return value
interface RelatedMessage {
  _id: string;
  content: string;
  role: string;
  conversationId: string;
  createdAt: number;
  score: number;
  type: "message";
}

interface RelatedNode {
  _id: string;
  content: string;
  type: "node";
  score: number;
  x: number;
  y: number;
  createdAt: number;
}

interface FindRelatedResult {
  messages: (RelatedMessage | null)[];
  nodes: (RelatedNode | null)[];
}

// Find related content based on text query
export const findRelated = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<FindRelatedResult> => {
    // Get embedding for query
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: args.query,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);
      throw new Error(data.error?.message ?? "Failed to generate embedding");
    }

    const embedding = data.data[0].embedding;

    // Search messages
    const messageResults = await ctx.vectorSearch("messages", "by_embedding", {
      vector: embedding,
      limit: args.limit ?? 5,
    });

    // Search canvas nodes
    const nodeResults = await ctx.vectorSearch("canvasNodes", "by_embedding", {
      vector: embedding,
      limit: args.limit ?? 5,
    });

    // Fetch full documents and filter by user ownership using auth-checked queries
    const messages: (RelatedMessage | null)[] = await Promise.all(
      messageResults.map(async (r: { _id: Id<"messages">; _score: number }) => {
        // Use the auth-checked query - will return null if not user's message
        const msg = await ctx.runQuery(api.messages.getById, { id: r._id });
        return msg
          ? {
              ...msg,
              _id: msg._id as string,
              conversationId: msg.conversationId as string,
              score: r._score,
              type: "message" as const,
            }
          : null;
      })
    );

    const nodes: (RelatedNode | null)[] = await Promise.all(
      nodeResults.map(async (r: { _id: Id<"canvasNodes">; _score: number }) => {
        // Use the auth-checked query - will return null if not user's node
        const node = await ctx.runQuery(api.canvas.getNodeById, { id: r._id });
        return node
          ? {
              ...node,
              _id: node._id as string,
              score: r._score,
              type: "node" as const,
            }
          : null;
      })
    );

    return {
      messages: messages.filter(Boolean),
      nodes: nodes.filter(Boolean),
    };
  },
});
