"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Link2, LogOut, Clock3 } from "lucide-react";
import type { Status, WorkspaceTab } from "./workspace-types";

export function AccountMenu({
  status,
  onNavigate,
  onSignOut,
}: {
  status: Status | null;
  onNavigate: (tab: WorkspaceTab) => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const choose = (action: () => void) => {
    setOpen(false);
    trigger.current?.focus();
    action();
  };
  return (
    <div
      className="account-control"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="account-trigger"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="top-avatar">PL</span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div
          ref={menu}
          id="account-menu"
          role="menu"
          aria-label="Account actions"
          className="account-dropdown"
          onKeyDown={(event) => {
            const items = Array.from(
              menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
            );
            const index = items.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            if (event.key === "Escape") {
              event.preventDefault();
              choose(() => {});
            }
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? items.length - 1
                    : (index +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        items.length) %
                      items.length;
              items[next]?.focus();
            }
          }}
        >
          <div className="account-summary">
            <strong>Plum administrator</strong>
            <small>
              {status?.mode === "live"
                ? "Live workspace"
                : "Demo workspace · synthetic data"}
            </small>
          </div>
          <button
            role="menuitem"
            onClick={() => choose(() => onNavigate("connections"))}
          >
            <Link2 size={15} />
            Connections & setup
          </button>
          <button
            role="menuitem"
            onClick={() => choose(() => onNavigate("history"))}
          >
            <Clock3 size={15} />
            Run history
          </button>
          {status?.mode === "live" && (
            <button role="menuitem" onClick={() => choose(onSignOut)}>
              <LogOut size={15} />
              Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
