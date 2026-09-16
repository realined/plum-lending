import {
  pgTable,
  text,
  jsonb,
  integer,
  timestamp,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { SegmentSpec } from "@/domain/segment";
import type { Counts, ExportRow, Failure } from "@/domain/models";
const now = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const connections = pgTable("connections", {
  id: text().primaryKey(),
  provider: text().notNull(),
  generation: text().notNull().default(""),
  status: text().notNull(),
  encryptedToken: text("encrypted_token"),
  mailbox: text(),
  lastSync: timestamp("last_sync", { withTimezone: true }),
  cursor: jsonb(),
  createdAt: now(),
});
export const companies = pgTable("companies", {
  id: text().primaryKey(),
  name: text().notNull(),
  data: jsonb().notNull(),
});
export const contacts = pgTable("contacts", {
  id: text().primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text().notNull(),
  data: jsonb().notNull(),
});
export const identities = pgTable(
  "contact_identities",
  {
    contactId: text("contact_id")
      .references(() => contacts.id, { onDelete: "cascade" })
      .notNull(),
    email: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.email] })],
);
export const deals = pgTable("deals", {
  id: text().primaryKey(),
  status: text().notNull(),
  data: jsonb().notNull(),
});
export const contactCompanies = pgTable(
  "contact_companies",
  {
    contactId: text("contact_id")
      .references(() => contacts.id, { onDelete: "cascade" })
      .notNull(),
    companyId: text("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.companyId] })],
);
export const contactDeals = pgTable(
  "contact_deals",
  {
    contactId: text("contact_id")
      .references(() => contacts.id, { onDelete: "cascade" })
      .notNull(),
    dealId: text("deal_id")
      .references(() => deals.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.dealId] })],
);
export const threads = pgTable("threads", {
  id: text().primaryKey(),
  provider: text().notNull(),
  data: jsonb().notNull(),
});
export const messages = pgTable("messages", {
  id: text().primaryKey(),
  threadId: text("thread_id")
    .references(() => threads.id, { onDelete: "cascade" })
    .notNull(),
  position: integer().notNull(),
  timestamp: timestamp({ withTimezone: true }).notNull(),
  data: jsonb().notNull(),
});
export const participants = pgTable(
  "participants",
  {
    messageId: text("message_id")
      .references(() => messages.id, { onDelete: "cascade" })
      .notNull(),
    role: text().notNull(),
    email: text().notNull(),
    name: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.role, t.email] })],
);
export const segments = pgTable("segment_requests", {
  id: text().primaryKey(),
  query: text().notNull(),
  spec: jsonb().$type<SegmentSpec>().notNull(),
  assumptions: jsonb().$type<string[]>().notNull(),
  source: text().notNull(),
  createdAt: now(),
});
export const jobs = pgTable(
  "export_jobs",
  {
    id: text().primaryKey(),
    segmentId: text("segment_id")
      .references(() => segments.id, { onDelete: "cascade" })
      .notNull(),
    status: text().notNull(),
    stage: text().notNull(),
    progress: integer().notNull().default(0),
    attempts: integer().notNull().default(0),
    leaseOwner: text("lease_owner"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    mode: text().notNull(),
    scenario: text().notNull(),
    counts: jsonb().$type<Counts>().notNull(),
    failures: jsonb().$type<Failure[]>().notNull(),
    exclusions: jsonb().$type<Record<string, number>>().notNull(),
    error: text(),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("one_export_per_segment").on(t.segmentId)],
);
export const results = pgTable(
  "export_results",
  {
    jobId: text("job_id")
      .references(() => jobs.id, { onDelete: "cascade" })
      .notNull(),
    contactId: text("contact_id").notNull(),
    threadId: text("thread_id").notNull(),
    data: jsonb().$type<ExportRow>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.jobId, t.contactId, t.threadId] })],
);
export const syncJobs = pgTable("sync_jobs", {
  id: text().primaryKey(),
  exportJobId: text("export_job_id")
    .references(() => jobs.id, { onDelete: "cascade" })
    .notNull(),
  status: text().notNull(),
  cursor: jsonb(),
  createdAt: now(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
