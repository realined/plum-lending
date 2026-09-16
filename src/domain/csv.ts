import type { ExportRow } from "./models";
export const CSV_HEADERS = [
  "Email Subject",
  "Email Body",
  "Account Name",
  "First Name",
  "Last Name",
  "Email",
  "Last Activity Date",
  "Raw Communication Data",
] as const;
export function csvCell(input: string): string {
  // Protect spreadsheet formulas even when prefixed with whitespace or control characters.
  const safe =
    /^[\s\u0000-\u001f]*[=+@-]/u.test(input) || /^[\t\r\n]/u.test(input)
      ? `'${input}`
      : input;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function toCsv(rows: ExportRow[]): string {
  const data = rows.map((r) => [
    r.subject,
    r.body,
    r.accountName,
    r.firstName,
    r.lastName,
    r.email,
    r.lastActivity,
    JSON.stringify(r.raw),
  ]);
  return (
    "\uFEFF" +
    [CSV_HEADERS, ...data].map((r) => r.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
