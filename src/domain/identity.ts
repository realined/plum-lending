import { z } from "zod";
export function normalizeEmail(email: string): string {
  return z.email().parse(email.trim().toLowerCase());
}
export function uniqueEmails(emails: string[]): string[] {
  return [...new Set(emails.map(normalizeEmail))].sort();
}
