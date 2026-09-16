import {
  Database,
  Link2,
  LoaderCircle,
  Mail,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { Status } from "./workspace-types";
import { HubspotMark } from "./brand";
import { SetupPanel } from "./setup-panel";
export function ConnectionDetails({
  status,
  busy,
  onDeleteData,
}: {
  status: Status;
  busy: string | null;
  onDeleteData: () => void;
}) {
  return (
    <>
      <SetupPanel status={status} />
      <section className="panel connection-details">
        <div className="panel-title">
          <ShieldCheck size={21} />
          <div>
            <h2>Built around your data boundaries</h2>
            <p>
              Read-only integrations. Explicit interpretation. Deterministic
              results.
            </p>
          </div>
        </div>
        <div className="security-grid">
          <div>
            <Mail />
            <h3>Read-only email access</h3>
            <p>
              Gmail connections request gmail.readonly. Your mailbox is never
              modified, and no emails are sent.
            </p>
          </div>
          <div>
            <Database />
            <h3>Server-side credentials</h3>
            <p>
              Provider tokens are encrypted at rest. Disconnecting removes local
              credentials and all derived data.
            </p>
          </div>
          <div>
            <Sparkles />
            <h3>Minimal AI exposure</h3>
            <p>
              Only the segmentation request goes to OpenAI. Contact records and
              correspondence stay in the pipeline.
            </p>
          </div>
        </div>
        {status.mode === "demo" && (
          <div className="demo-explainer">
            <strong>You’re exploring the demo environment.</strong>
            <p>
              All people and conversations here are synthetic. To connect real
              accounts, follow docs/live-setup.md and restart with
              APP_MODE=live.
            </p>
          </div>
        )}
        <div className="danger-zone">
          <div>
            <strong>Delete local workspace data</strong>
            <p>
              Remove requests, normalized records, and exports. Provider
              accounts are not changed.
            </p>
          </div>
          <button
            className="secondary"
            disabled={Boolean(busy)}
            onClick={onDeleteData}
          >
            <Trash2 size={14} />
            Delete data
          </button>
        </div>
      </section>
    </>
  );
}

export function HubSpotDialog({
  status,
  token,
  busy,
  error,
  onTokenChange,
  onClose,
  onConnect,
}: {
  status: Status | null;
  token: string;
  busy: string | null;
  error: string;
  onTokenChange: (value: string) => void;
  onClose: () => void;
  onConnect: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hubspot-title"
      >
        <button
          className="close-button"
          aria-label="Close connection dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <div className="provider-icon hubspot">
          <HubspotMark />
        </div>
        <h2 id="hubspot-title">Connect HubSpot</h2>
        <p>
          Enter your private-app token. It is validated on the server and stored
          encrypted.
        </p>
        <label htmlFor="hubspot-token">Private-app token</label>
        <input
          id="hubspot-token"
          autoFocus
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => onTokenChange(e.target.value)}
        />
        <small>
          Required: contact, company, and deal read access. Sponsor property:{" "}
          <b>{status?.sponsorProperty}</b>.
        </small>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <button
          className="primary"
          disabled={Boolean(busy) || !token}
          onClick={onConnect}
        >
          {busy === "hubspot" ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Link2 size={16} />
          )}
          Validate & connect
        </button>
      </section>
    </div>
  );
}
