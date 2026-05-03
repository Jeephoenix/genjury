import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playerProfiles = pgTable(
  "player_profiles",
  {
    address:      text("address").primaryKey(),
    username:     text("username").notNull(),
    usernameLower: text("username_lower").notNull(),
    avatarUrl:    text("avatar_url").notNull().default(""),
    color:        text("color").notNull().default("#a259ff"),
    registeredAt: timestamp("registered_at").defaultNow(),
  },
  (table) => [uniqueIndex("player_profiles_username_lower_idx").on(table.usernameLower)],
);

export const insertPlayerProfileSchema = createInsertSchema(playerProfiles).omit({
  registeredAt: true,
});
export type InsertPlayerProfile = z.infer<typeof insertPlayerProfileSchema>;
export type PlayerProfile = typeof playerProfiles.$inferSelect;
