import { ArrowUpRight, Mail, Plus } from "lucide-react";
import type { Status, WorkspaceTab } from "./workspace-types";
import { HubspotMark } from "./brand";
export function ConnectionCards({
  status,
  tab,
  onConnectHubSpot,
  onDisconnect,
}: {
  status: Status;
  tab: WorkspaceTab;
  onConnectHubSpot: () => void;
  onDisconnect: (provider: string) => void;
}) {
  return (
    <section className="connections-grid" aria-label="Data connections">
      {["gmail", "hubspot"].map((provider) => {
        const c = status.connections.find((c) => c.id === provider);
        const connected = c?.status === "connected" || c?.status === "demo";
        return (
          <div className="connection-card" key={provider}>
            <div className={`provider-icon ${provider}`}>
              {provider === "gmail" ? <Mail size={23} /> : <HubspotMark />}
            </div>
            <div className="connection-info">
              <h3>
                {provider === "gmail" ? "Gmail" : "HubSpot"}
                <span className="small-label">
                  {provider === "gmail" ? "EMAIL" : "CRM"}
                </span>
              </h3>
              <p>
                {provider === "gmail"
                  ? (c?.mailbox ?? "Connect your lender mailbox")
                  : connected
                    ? status.mode === "demo"
                      ? "Synthetic contact & deal records"
                      : "Contacts, companies & deals"
                    : "Connect your CRM workspace"}
              </p>
              <small>
                {c?.lastSync
                  ? `Last successful sync · ${new Date(c.lastSync).toLocaleString()}`
                  : "No completed sync yet"}
              </small>
            </div>
            <div className="connection-actions">
              <span
                className={`connection-status ${connected ? "connected" : ""}`}
              >
                <i />
                {status.mode === "demo"
                  ? "Demo ready"
                  : connected
                    ? "Connected"
                    : "Not connected"}
              </span>
              {status.mode === "live" &&
                !connected &&
                (provider === "gmail" ? (
                  <button
                    className="text-button"
                    onClick={() =>
                      // OAuth requires document navigation so the server can redirect to Google.
                      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                      window.location.assign("/api/connections/gmail/start")
                    }
                  >
                    Connect <ArrowUpRight size={14} />
                  </button>
                ) : (
                  <button className="text-button" onClick={onConnectHubSpot}>
                    Connect <Plus size={14} />
                  </button>
                ))}
              {status.mode === "live" && connected && tab === "connections" && (
                <button
                  className="danger-link"
                  onClick={() => onDisconnect(provider)}
                >
                  Disconnect & delete
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
