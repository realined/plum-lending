import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { config } from "./config";
import {
  HttpError,
  requireAuth,
  requireOrigin,
  readBody,
  constantEqual,
  signSession,
  cookieOptions,
} from "./auth";
import { interpret } from "./parser";
import { db } from "./database";
import {
  connectionList,
  enqueue,
  getJob,
  getRows,
  listJobs,
  purgeLocalData,
  saveSegment,
} from "./repository";
import { connectHubSpot, revokeGoogle } from "./connections";
import { startOAuth, finishOAuth } from "./oauth";
import { toCsv, CSV_HEADERS, csvCell } from "@/domain/csv";
import { DEMO_LENDER } from "@/providers/demo";
const uuid = z.uuid();
let loginFailures = 0,
  loginWindow = 0;
function safeJob(job: Awaited<ReturnType<typeof listJobs>>[number]) {
  const copy = { ...job };
  delete (copy as Partial<typeof copy>).lease_owner;
  return copy;
}
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function api(req: NextRequest) {
  try {
    const { mode } = config(),
      path = req.nextUrl.pathname.replace(/^\/api\//, "");
    if (!["GET", "HEAD"].includes(req.method)) requireOrigin(req);
    if (path === "login" && req.method === "POST") {
      if (Date.now() - loginWindow > 60000) {
        loginFailures = 0;
        loginWindow = Date.now();
      }
      if (loginFailures >= 10)
        throw new HttpError(429, "Too many sign-in attempts. Wait one minute.");
      const { password } = z
        .object({ password: z.string().max(500) })
        .strict()
        .parse(await readBody(req));
      if (
        mode !== "demo" &&
        !constantEqual(password, process.env.ADMIN_PASSWORD ?? "")
      ) {
        loginFailures++;
        throw new HttpError(401, "Incorrect administrator password.");
      }
      const res = json({ ok: true });
      res.cookies.set("plum_session", signSession(), cookieOptions());
      return res;
    }
    requireAuth(req);
    if (path === "logout" && req.method === "POST") {
      const res = json({ ok: true });
      res.cookies.set("plum_session", "", { ...cookieOptions(), maxAge: 0 });
      return res;
    }
    if (path === "status" && req.method === "GET") {
      const jobs = await listJobs(),
        last = jobs.find((j) => j.status === "succeeded");
      const connections =
        mode === "demo"
          ? [
              {
                id: "gmail",
                provider: "gmail",
                status: "demo",
                mailbox: DEMO_LENDER,
                lastSync: last?.updated_at ?? null,
              },
              {
                id: "hubspot",
                provider: "hubspot",
                status: "demo",
                mailbox: null,
                lastSync: last?.updated_at ?? null,
              },
            ]
          : await connectionList();
      return json({
        mode,
        connections,
        jobs: jobs.map(safeJob),
        workerMode: config().embeddedWorker ? "embedded" : "external",
        sponsorProperty: process.env.HUBSPOT_SPONSOR_PROPERTY ?? "contact_type",
        sponsorValue: process.env.HUBSPOT_SPONSOR_VALUE ?? "Sponsor",
      });
    }
    if (path === "interpret" && req.method === "POST") {
      const { query } = z
        .object({ query: z.string().trim().min(20).max(2000) })
        .strict()
        .parse(await readBody(req));
      let parsed;
      try {
        parsed = await interpret(query);
      } catch (e) {
        const safe =
          e instanceof Error &&
          (e.message.startsWith("Demo mode") ||
            e.message.startsWith("This slice") ||
            e.message.startsWith("Configure OPENAI"));
        throw new HttpError(
          422,
          safe
            ? (e as Error).message
            : "The request could not be validated. Use the example and ensure the lookback is longer than the excluded period.",
        );
      }
      return json(
        await saveSegment(
          query,
          parsed.spec,
          parsed.assumptions,
          parsed.source,
        ),
      );
    }
    if (path === "jobs" && req.method === "POST") {
      const body = z
        .object({
          segmentId: uuid,
          scenario: z
            .enum(["standard", "partial", "empty", "outage"])
            .default("standard"),
        })
        .strict()
        .parse(await readBody(req));
      if (mode === "live") {
        const c = await connectionList();
        if (
          !c.some((x) => x.id === "gmail" && x.status === "connected") ||
          (!c.some((x) => x.id === "hubspot" && x.status === "connected") &&
            !process.env.HUBSPOT_PRIVATE_APP_TOKEN)
        )
          throw new HttpError(409, "Connect Gmail and HubSpot before running.");
      }
      const active = await (
        await db()
      ).query(
        "SELECT id FROM export_jobs WHERE status IN ('queued','running')",
      );
      if (active.length >= 3)
        throw new HttpError(
          429,
          "Wait for an active run to finish before starting another.",
        );
      return json(
        {
          id: await enqueue(
            body.segmentId,
            mode,
            mode === "demo" ? body.scenario : "standard",
          ),
        },
        202,
      );
    }
    const jobRoute = path.match(/^jobs\/([^/]+)(?:\/(csv))?$/);
    if (jobRoute && req.method === "GET") {
      const id = uuid.parse(jobRoute[1]),
        job = await getJob(id);
      if (!job) throw new HttpError(404, "Run not found.");
      if (jobRoute[2] === "csv") {
        if (!["succeeded", "partial"].includes(job.status))
          throw new HttpError(409, "The export is not ready.");
        // Fetch pages as the client consumes them; no giant CSV string is held in memory.
        let offset = 0;
        let started = false;
        const stream = new ReadableStream({
          async pull(controller) {
            try {
              if (!started) {
                controller.enqueue(
                  new TextEncoder().encode(
                    "\uFEFF" + CSV_HEADERS.map(csvCell).join(",") + "\r\n",
                  ),
                );
                started = true;
              }
              const rows = await getRows(id, 100, offset);
              if (!rows.length) {
                controller.close();
                return;
              }
              offset += rows.length;
              const csv = toCsv(rows).split("\r\n").slice(1).join("\r\n");
              controller.enqueue(new TextEncoder().encode(csv));
            } catch {
              controller.error(new Error("Export stream interrupted."));
            }
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="plum-segment-${id.slice(0, 8)}.csv"`,
            "Cache-Control": "no-store",
          },
        });
      }
      const offset = z.coerce
        .number()
        .int()
        .min(0)
        .max(1000000)
        .parse(req.nextUrl.searchParams.get("offset") ?? 0);
      const rows = await getRows(id, 25, offset),
        [{ count }] = await (
          await db()
        ).query<{ count: number }>(
          "SELECT count(*)::integer as count FROM export_results WHERE job_id=$1",
          [id],
        );
      return json({ job: safeJob(job), rows, totalRows: count, offset });
    }
    if (path === "connections/gmail/start" && req.method === "GET") {
      if (mode !== "live")
        throw new HttpError(
          400,
          "Set APP_MODE=live and restart to connect your account.",
        );
      return startOAuth();
    }
    if (path === "connections/gmail/callback" && req.method === "GET")
      return finishOAuth(req);
    if (path === "connections/hubspot" && req.method === "POST") {
      if (mode !== "live")
        throw new HttpError(400, "Set APP_MODE=live to connect your account.");
      const { token } = z
        .object({ token: z.string().trim().min(10).max(1000) })
        .strict()
        .parse(await readBody(req));
      try {
        await connectHubSpot(token);
      } catch {
        throw new HttpError(
          422,
          "HubSpot validation failed. Check the token scopes and configured Sponsor property.",
        );
      }
      return json({ ok: true });
    }
    if (
      /^connections\/(gmail|hubspot)$/.test(path) &&
      req.method === "DELETE"
    ) {
      if (mode !== "live")
        throw new HttpError(400, "Demo connections are synthetic.");
      const provider = path.split("/")[1];
      const revoked = provider === "gmail" ? await revokeGoogle() : true;
      await (
        await db()
      ).transaction(async (tx) => {
        await tx.query("DELETE FROM connections WHERE id=$1", [provider]);
        await purgeLocalData(tx);
      });
      return json({
        ok: true,
        message:
          provider === "hubspot"
            ? "Local credentials and derived data removed. Revoke the private-app token in HubSpot and remove any bootstrap token from .env."
            : revoked
              ? "Gmail grant revoked; local credentials and derived data removed."
              : "Local data removed. Google revocation failed; revoke access in your Google Account security settings.",
      });
    }
    if (path === "data" && req.method === "DELETE") {
      await (await db()).transaction(purgeLocalData);
      return json({
        ok: true,
        message:
          "Local requests, exports, and normalized data deleted. Connections remain available.",
      });
    }
    throw new HttpError(404, "Endpoint not found.");
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError)
      return json(
        { error: "Invalid request. Check the required fields." },
        400,
      );
    console.warn(JSON.stringify({ event: "api.request_failed" }));
    return json(
      {
        error:
          "The operation could not be completed. Check local configuration and try again.",
      },
      500,
    );
  }
}
