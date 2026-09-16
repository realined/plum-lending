export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { config } = await import("./server/config");
    if (config().embeddedWorker) {
      const { startWorker } = await import("./server/worker");
      startWorker();
    }
  }
}
