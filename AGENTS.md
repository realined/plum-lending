# Engineering guidance

- Keep eligibility in `src/domain`; providers only translate and retrieve data.
- AI receives the segment query only, returns a constrained schema, and never determines eligibility.
- Use strict TypeScript, Zod at trust boundaries, parameterized database operations, and stable provider IDs.
- Fixtures must be wholly synthetic and use example.test addresses. Owner-approved live-seed exception: CRM contact addresses and their matching Gmail participants use namespaced @example.com addresses because HubSpot rejects .test. Company domains, RFC IDs and other offline fixtures retain example.test. Never copy reference-sheet rows.
- Never log request bodies, correspondence, contact identities, provider responses, or secrets.
- Make a change concrete before asking for credentials. Demo mode must remain usable offline.
- Check changes with `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. Use `pnpm test:e2e` for admin-flow changes.
- Update `docs/checklist.md` and document material assumptions or tradeoffs.
- Bounded independent test expansion and security review may use subagents; main architecture and integration decisions remain in the primary agent.
- Normal application integrations remain read-only; never send email or deploy. The owner explicitly requested a separate controlled synthetic-data seeder for dedicated test accounts. Implement its safety checks/dry-run separately, and wait for approval of records, scopes and cleanup before any provider writes. Owner-approved exception: the selected existing job-search/BenTech mailbox may be used only with seed-only access; unrelated correspondence and all other personal mailboxes remain excluded. See docs/mailbox-isolation.md.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Collaboration protocol

- Treat the owner as the principal engineer. Before a major phase explain purpose/data flow, technical decisions, assumptions and acceptance criteria in plain and technical language.
- At each phase checkpoint report implemented modules, data movement, choices/alternatives, actual validation results, mock/live status, limitations, security, 3–5 interview concepts, and owner actions.
- Maintain `docs/build-journal.md` and update checklist only after verification.
- Pause for major architecture/technology changes, consequential product assumptions, destructive operations, credentials/account configuration, live connections/processing, deployment or material scope expansion.
- Live Gmail + HubSpot ingestion and real-data CSV acceptance are mandatory. Mock/demo success is not completion.
- Never document, print, screenshot, archive, or commit real credentials or correspondence. Keep live acceptance evidence count-only.
