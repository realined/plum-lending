import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import type { Status } from "./workspace-types";

export function SetupPanel({ status }: { status: Status }) {
  return (
    <section className="panel setup-panel" aria-labelledby="setup-title">
      <div className="panel-title">
        <div>
          <h2 id="setup-title">Live account setup</h2>
          <p>
            Prepare locally, connect explicitly, then review your first live
            run.
          </p>
        </div>
        <a
          className="secondary"
          href="https://github.com/realined/plum-lending/blob/main/docs/live-setup.md"
          target="_blank"
          rel="noreferrer"
        >
          Full setup guide <ExternalLink size={14} />
        </a>
      </div>
      <p className="setup-boundary">
        {status.mode === "demo"
          ? "This workspace uses synthetic data and example-wording rules. No accounts are connected, and no AI requests are sent."
          : "Configuration checks do not contact providers. Saved connections are verified at connection time and exercised when you run an export."}
      </p>
      <p className="setup-boundary" role="status">
        Worker:{" "}
        {status.worker.state === "ready"
          ? "heartbeat received"
          : status.worker.state === "stale"
            ? "heartbeat is stale"
            : "not observed yet"}
        {" · "}
        {status.workerMode === "external"
          ? "separate process"
          : "embedded demo process"}
        .
        {status.worker.state !== "ready" &&
          " Start pnpm worker in a second terminal using the same configuration, then refresh this page."}{" "}
        A heartbeat proves the worker is running; it does not prove provider
        access.
      </p>
      <ol className="setup-checks">
        {status.setup.map((check) => (
          <li key={check.id}>
            {check.configured ? (
              <CheckCircle2 size={18} />
            ) : (
              <Circle size={18} />
            )}
            <div>
              <strong>{check.label}</strong>
              <p>{check.detail}</p>
            </div>
            <span>
              {check.configured ? "Configured · not tested" : "Needs setup"}
            </span>
          </li>
        ))}
        <li>
          <Circle size={18} />
          <div>
            <strong>HubSpot property and private app</strong>
            <p>
              Confirm the contact property {status.sponsorProperty} and internal
              value {status.sponsorValue}. Configure the read-only token
              privately using the local setup guide, then verify access before
              creating test records.
            </p>
          </div>
          <span>
            {status.mode === "live" &&
            status.connections.some((c) => c.id === "hubspot")
              ? "Connection saved"
              : "Owner setup"}
          </span>
        </li>
      </ol>
      <details className="setup-instructions">
        <summary>Local startup steps</summary>
        <p>
          From the project folder, run <code>pnpm setup:live</code> once, then
          edit the private <code>.env</code> locally. The command refuses to
          overwrite an existing file. Do not paste credentials into chat or
          commit them.
        </p>
        <pre>
          {
            "docker compose up -d postgres\npnpm config:check\npnpm db:migrate\npnpm build\npnpm start\n# In a second terminal:\npnpm worker"
          }
        </pre>
        <p>
          The web app and worker must use the same configuration. Restart both
          after changes. Opening this checklist never changes mode or grants
          account access.
        </p>
      </details>
      <p className="setup-boundary">
        Before the live run, approve the fictional dataset and its expected
        results. Test-only access requires message IDs recorded by the seeder;
        unrelated correspondence must never be added. The representative query
        excludes the most recent three months. Live acceptance is still
        required.
      </p>
    </section>
  );
}
