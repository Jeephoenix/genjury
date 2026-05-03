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

// Server-side ENS name cache.
// Stores the result of mainnet reverse lookups so every client benefits from
// resolutions performed by any other client. Updated via POST /api/profile/ens.
export const ensCache = pgTable("ens_cache", {
  address:   text("address").primaryKey(),
  ensName:   text("ens_name").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type EnsCache = typeof ensCache.$inferSelect;
