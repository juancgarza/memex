import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Verify conversation belongs to user
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== identity.subject) {
      return [];
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const message = await ctx.db.get(args.id);
    if (!message) return null;

    // Verify conversation belongs to user
    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation || conversation.userId !== identity.subject) {
      return null;
    }

    return message;
  },
});

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Verify conversation belongs to user
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== identity.subject) {
      throw new Error("Not found");
    }

    const now = Date.now();

    // Update conversation timestamp
    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
    });

    return await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      createdAt: now,
    });
  },
});

export const updateEmbedding = mutation({
  args: {
    id: v.id("messages"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const message = await ctx.db.get(args.id);
    if (!message) throw new Error("Not found");

    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation || conversation.userId !== identity.subject) {
      throw new Error("Not found");
    }

    await ctx.db.patch(args.id, {
      embedding: args.embedding,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const message = await ctx.db.get(args.id);
    if (!message) throw new Error("Not found");

    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation || conversation.userId !== identity.subject) {
      throw new Error("Not found");
    }

    await ctx.db.delete(args.id);
  },
});
