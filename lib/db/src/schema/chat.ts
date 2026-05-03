import { pgTable, text, bigint, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  roomCode: text("room_code").notNull(),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  avatar: text("avatar").default(""),
  color: text("color").default(""),
  text: text("text").notNull(),
  kind: text("kind").notNull().default("taunt"),
  ts: bigint("ts", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatReactions = pgTable("chat_reactions", {
  msgId: text("msg_id").notNull(),
  emoji: text("emoji").notNull(),
  userId: text("user_id").notNull(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const insertChatReactionSchema = createInsertSchema(chatReactions);
export type InsertChatReaction = z.infer<typeof insertChatReactionSchema>;
export type ChatReaction = typeof chatReactions.$inferSelect;
