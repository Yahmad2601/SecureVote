import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("observer"), // super_admin, election_officer, observer
  fullName: text("full_name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const voters = pgTable("voters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voterId: text("voter_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  fingerprintHash: text("fingerprint_hash").notNull(),
  hasVoted: boolean("has_voted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const candidates = pgTable("candidates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  party: text("party").notNull(),
  position: integer("position").notNull(),
  active: boolean("active").default(true),
});

export const devices = pgTable("devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: text("device_id").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("offline"), // online, offline, warning
  batteryLevel: integer("battery_level").default(0),
  lastSync: timestamp("last_sync"),
  location: text("location"),
  firmwareVersion: text("firmware_version"),
});

export const votes = pgTable("votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voterId: text("voter_id").notNull(),
  candidateId: varchar("candidate_id").references(() => candidates.id),
  deviceId: varchar("device_id").references(() => devices.id),
  fingerprintHash: text("fingerprint_hash").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  verified: boolean("verified").default(true),
});

export const securityLogs = pgTable("security_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // duplicate_attempt, unregistered_fingerprint, device_tampering, login_attempt
  severity: text("severity").notNull().default("medium"), // low, medium, high, critical
  deviceId: varchar("device_id").references(() => devices.id),
  voterId: text("voter_id"),
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  resolved: boolean("resolved").default(false),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // vote_cast, voter_registered, device_sync, user_login
  description: text("description").notNull(),
  userId: varchar("user_id").references(() => users.id),
  deviceId: varchar("device_id").references(() => devices.id),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertVoterSchema = createInsertSchema(voters).omit({
  id: true,
  hasVoted: true,
  createdAt: true,
});

export const insertCandidateSchema = createInsertSchema(candidates).omit({
  id: true,
});

export const insertDeviceSchema = createInsertSchema(devices).omit({
  id: true,
  lastSync: true,
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  timestamp: true,
  verified: true,
});

export const insertSecurityLogSchema = createInsertSchema(securityLogs).omit({
  id: true,
  timestamp: true,
  resolved: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  timestamp: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertVoter = z.infer<typeof insertVoterSchema>;
export type Voter = typeof voters.$inferSelect;
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidates.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votes.$inferSelect;
export type InsertSecurityLog = z.infer<typeof insertSecurityLogSchema>;
export type SecurityLog = typeof securityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
