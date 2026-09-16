import { writeFile, mkdir } from "node:fs/promises";
import { DemoCRM, DemoEmail, DEMO_LENDER } from "../src/providers/demo";
import { executeSegment } from "../src/domain/executor";
import { parseDemo, DEFAULT_QUERY } from "../src/domain/segment";
import { toCsv } from "../src/domain/csv";
const result = await executeSegment(
  parseDemo(DEFAULT_QUERY),
  await new DemoCRM().snapshot(),
  new DemoEmail(),
  [DEMO_LENDER],
);
await mkdir("examples", { recursive: true });
await writeFile("examples/synthetic-segment.csv", toCsv(result.rows));
await writeFile(
  "examples/expected-result.json",
  JSON.stringify(
    {
      counts: result.counts,
      exclusions: result.exclusions,
      rowKeys: result.rows.map((r) => [r.contactId, r.threadId]),
    },
    null,
    2,
  ) + "\n",
);
console.info(
  JSON.stringify({
    event: "synthetic_sample.generated",
    counts: result.counts,
  }),
);
