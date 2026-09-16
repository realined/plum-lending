import { Workspace } from "@/components/workspace";
import { Suspense } from "react";
export default function Home() {
  return (
    <Suspense
      fallback={
        <p role="status" className="loading">
          Opening your workspace…
        </p>
      }
    >
      <Workspace />
    </Suspense>
  );
}
