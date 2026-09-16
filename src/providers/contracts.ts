import type {
  CRMSnapshot,
  Thread,
  Contact,
  Company,
  Deal,
} from "@/domain/models";
import type { SegmentSpec } from "@/domain/segment";
export interface EmailProvider {
  readonly name: "gmail" | "demo" | "outlook";
  validateConnection(): Promise<{ mailbox: string; cursor?: string }>;
  searchThreads(
    spec: SegmentSpec,
    senderEmails: string[],
  ): AsyncIterable<string>;
  getThread(id: string): Promise<Thread>;
  synchronize(cursor: string): Promise<{
    threadIds: string[];
    deletedMessageIds: string[];
    nextCursor: string;
    requiresFullSync: boolean;
  }>;
}
export interface CRMProvider {
  readonly name: "hubspot" | "demo" | "salesforce";
  validateConnection(): Promise<void>;
  searchContacts(): Promise<Contact[]>;
  getCompanies(): Promise<Company[]>;
  getDeals(): Promise<Deal[]>;
  getAssociations(
    contactId: string,
  ): Promise<{ companyIds: string[]; dealIds: string[] }>;
  snapshot(): Promise<CRMSnapshot>;
}
