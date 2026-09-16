"use client";
import { useEffect, useRef } from "react";
import { ArrowUpRight, Mail, Paperclip, ShieldCheck, X } from "lucide-react";
import type { ExportRow } from "@/domain/models";
export function ResultTable({
  rows,
  onSelect,
}: {
  rows: ExportRow[];
  onSelect: (r: ExportRow) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>CONTACT</th>
            <th>ACCOUNT</th>
            <th>CONVERSATION</th>
            <th>LAST ACTIVITY</th>
            <th aria-label="Inspect thread" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.contactId}:${r.threadId}`}>
              <td>
                <button className="contact-cell" onClick={() => onSelect(r)}>
                  <span className={`contact-avatar tone-${i % 4}`}>
                    {r.firstName[0]}
                    {r.lastName[0]}
                  </span>
                  <span>
                    <strong>
                      {r.firstName} {r.lastName}
                    </strong>
                    <small>{r.email}</small>
                  </span>
                </button>
              </td>
              <td>
                <span className="account-name">
                  {r.accountName || "No company"}
                </span>
                <span className="role-tag">Sponsor</span>
              </td>
              <td>
                <button
                  className="conversation-cell"
                  onClick={() => onSelect(r)}
                >
                  <strong>{r.subject}</strong>
                  <small>
                    <Mail size={12} />
                    {r.raw.messages.length} messages<span>Full thread</span>
                  </small>
                </button>
              </td>
              <td className="date-cell">
                {new Date(r.lastActivity).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </td>
              <td>
                <button
                  className="row-open"
                  aria-label={`View thread: ${r.subject}`}
                  onClick={() => onSelect(r)}
                >
                  <ArrowUpRight size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="table-no-results">
          No rows on this page match your filter.
        </p>
      )}
    </div>
  );
}
export function ThreadDrawer({
  row,
  onClose,
}: {
  row: ExportRow;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          'button,a,[tabindex="0"],summary',
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        className="thread-drawer"
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="thread-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">COMPLETE CONVERSATION</p>
            <h2 id="thread-title">{row.subject}</h2>
            <p>
              {row.firstName} {row.lastName} · {row.accountName}
            </p>
          </div>
          <button aria-label="Close thread" onClick={onClose}>
            <X size={21} />
          </button>
        </header>
        <div className="thread-evidence">
          <ShieldCheck size={17} />
          <span>
            {row.qualifyingMessageIds.length} qualifying inbound{" "}
            {row.qualifyingMessageIds.length === 1 ? "message" : "messages"} ·{" "}
            {row.raw.messages.length} total messages preserved
          </span>
        </div>
        <div className="thread-messages">
          {row.raw.messages.map((m) => (
            <article className="message" key={m.providerMessageId}>
              <div className="message-top">
                <span
                  className={
                    m.direction === "inbound"
                      ? "message-avatar"
                      : "message-avatar lender"
                  }
                >
                  {m.from.name?.[0] ?? m.from.email[0]}
                </span>
                <div>
                  <strong>{m.from.name || m.from.email}</strong>
                  <small>{m.from.email}</small>
                </div>
                <span className="message-direction">{m.direction}</span>
              </div>
              <div className="message-meta">
                <span>
                  {new Date(m.timestamp).toLocaleString("en-US", {
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </span>
                {row.qualifyingMessageIds.includes(m.providerMessageId) && (
                  <b>Qualifies</b>
                )}
              </div>
              <p className="recipients">
                To: {m.to.map((p) => p.email).join(", ")}
                {m.cc.length > 0 && (
                  <>
                    <br />
                    CC: {m.cc.map((p) => p.email).join(", ")}
                  </>
                )}
                {m.bcc.length > 0 && (
                  <>
                    <br />
                    BCC: {m.bcc.map((p) => p.email).join(", ")}
                  </>
                )}
              </p>
              <pre className="message-body">
                {m.text || "No readable text body supplied by the provider."}
              </pre>
              {m.attachments.map((a, i) => (
                <div className="attachment" key={i}>
                  <Paperclip size={13} />
                  {a.filename}
                  <small>{Math.ceil(a.size / 1024)} KB · metadata only</small>
                </div>
              ))}
            </article>
          ))}
        </div>
        <details className="raw-json">
          <summary>Inspect normalized JSON</summary>
          <pre>{JSON.stringify(row.raw, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
}
