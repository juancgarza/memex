import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listNodes = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("canvasNodes").collect();
  },
});

export const getNodeById = query({
  args: { id: v.id("canvasNodes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listEdges = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("canvasEdges").collect();
  },
});

export const createNode = mutation({
  args: {
    type: v.union(
      v.literal("text"),
      v.literal("chat_reference"),
      v.literal("note"),
    ),
    content: v.string(),
    x: v.number(),
    y: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    messageId: v.optional(v.id("messages")),
    conversationId: v.optional(v.id("conversations")),
    // Zettelkasten source tracking
    sourceType: v.optional(
      v.union(
        v.literal("manual"),
        v.literal("voice"),
        v.literal("chat"),
        v.literal("ai_extracted")
      )
    ),
    sourceId: v.optional(v.id("voiceNotes")),
    parentNodeId: v.optional(v.id("canvasNodes")),
    outgoingLinks: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("canvasNodes", {
      type: args.type,
      content: args.content,
      x: args.x,
      y: args.y,
      width: args.width ?? 300,
      height: args.height ?? 150,
      messageId: args.messageId,
      conversationId: args.conversationId,
      sourceType: args.sourceType ?? "manual",
      sourceId: args.sourceId,
      parentNodeId: args.parentNodeId,
      outgoingLinks: args.outgoingLinks,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateNode = mutation({
  args: {
    id: v.id("canvasNodes"),
    content: v.optional(v.string()),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined),
    );

    await ctx.db.patch(id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

export const updateNodeEmbedding = mutation({
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

export const deleteNode = mutation({
  args: { id: v.id("canvasNodes") },
  handler: async (ctx, args) => {
    // Delete connected edges
    const sourceEdges = await ctx.db
      .query("canvasEdges")
      .withIndex("by_source", (q) => q.eq("source", args.id))
      .collect();

    const targetEdges = await ctx.db
      .query("canvasEdges")
      .withIndex("by_target", (q) => q.eq("target", args.id))
      .collect();

    for (const edge of [...sourceEdges, ...targetEdges]) {
      await ctx.db.delete(edge._id);
    }

    await ctx.db.delete(args.id);
  },
});

export const createEdge = mutation({
  args: {
    source: v.id("canvasNodes"),
    target: v.id("canvasNodes"),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("canvasEdges", {
      source: args.source,
      target: args.target,
      label: args.label,
      createdAt: Date.now(),
    });
  },
});

export const deleteEdge = mutation({
  args: { id: v.id("canvasEdges") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Get backlinks for a node (nodes that link TO this node)
export const getBacklinks = query({
  args: { nodeId: v.id("canvasNodes") },
  handler: async (ctx, args) => {
    // Get edges where this node is the target
    const incomingEdges = await ctx.db
      .query("canvasEdges")
      .withIndex("by_target", (q) => q.eq("target", args.nodeId))
      .collect();

    // Get source nodes with edge labels
    const sourceNodes = await Promise.all(
      incomingEdges.map(async (edge) => {
        const node = await ctx.db.get(edge.source);
        return node ? { ...node, edgeLabel: edge.label } : null;
      })
    );

    return sourceNodes.filter(Boolean);
  },
});

// Get nodes created from a voice note
export const getNodesByVoiceNote = query({
  args: { voiceNoteId: v.id("voiceNotes") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("canvasNodes")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", args.voiceNoteId))
      .collect();
  },
});
