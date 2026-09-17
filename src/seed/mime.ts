import { z } from "zod";
import { assertSeedPlan, type SeedMessage, type SeedPlan } from "./plan";

const base64 = (text: string) =>
  Buffer.from(text, "utf8")
    .toString("base64")
    .match(/.{1,76}/g)
    ?.join("\r\n") ?? "";
const html = (text: string) =>
  `<p>${text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "<br>")}</p>`;

// Generate RFC 2822 content only. Sending/inserting requires a separate writer.
export function renderSeedMessage(
  plan: SeedPlan,
  message: SeedMessage,
  lenderMailbox: string,
) {
  assertSeedPlan(plan);
  const contact = plan.contacts.find(
    (candidate) => candidate.key === message.caseKey,
  );
  const safeHeader = (value: string) => {
    if (/[\r\n\x00]/.test(value)) throw new Error("INVALID_SEED_HEADER");
    return value;
  };
  if (
    !contact ||
    !plan.messages.includes(message) ||
    !z.email().safeParse(lenderMailbox).success
  )
    throw new Error("INVALID_SEED_MESSAGE_INPUT");
  const person = `${safeHeader(contact.firstName)} ${safeHeader(contact.lastName)} <${safeHeader(contact.email)}>`;
  const lender = `BenTech Lending Lab <${safeHeader(lenderMailbox)}>`;
  const alternative = `${safeHeader(plan.namespace)}-${safeHeader(message.key)}-alt`;
  const mixed = `${plan.namespace}-${message.key}-mix`;
  const headers = [
    `From: ${message.direction === "inbound" ? person : lender}`,
    `To: ${message.direction === "inbound" ? lender : person}`,
    ...(message.cc.length
      ? [`Cc: ${message.cc.map(safeHeader).join(", ")}`]
      : []),
    `Date: ${new Date(message.date).toUTCString()}`,
    `Subject: ${safeHeader(message.subject)}`,
    `Message-ID: ${safeHeader(message.rfcMessageId)}`,
    `X-Plum-Poc-Namespace: ${plan.namespace}`,
    ...(message.references.length
      ? [
          `In-Reply-To: ${safeHeader(message.references.at(-1)!)}`,
          `References: ${message.references.map(safeHeader).join(" ")}`,
        ]
      : []),
    "MIME-Version: 1.0",
  ];
  const alternatives = [
    `Content-Type: multipart/alternative; boundary="${alternative}"`,
    "",
    `--${alternative}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64(message.text),
    `--${alternative}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64(html(message.text)),
    `--${alternative}--`,
  ];
  const body = message.attachment
    ? [
        `Content-Type: multipart/mixed; boundary="${mixed}"`,
        "",
        `--${mixed}`,
        ...alternatives,
        `--${mixed}`,
        `Content-Type: text/plain; name="${safeHeader(message.attachment.filename)}"`,
        `Content-Disposition: attachment; filename="${safeHeader(message.attachment.filename)}"`,
        "Content-Transfer-Encoding: base64",
        "",
        base64(message.attachment.text),
        `--${mixed}--`,
      ]
    : alternatives;
  return [...headers, ...body, ""].join("\r\n");
}
