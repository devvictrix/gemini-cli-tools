// Create this new file and directory: src/k6/runners/mock-server.runner.ts

import * as fs from "fs/promises";
import * as path from "path";
import { MockServer } from "../services/mock-server.service";

const PID_FILE = path.resolve(process.cwd(), ".mock.pid");

async function start() {
  // Write the PID to a file so the 'stop-mock' command can find it
  await fs.writeFile(PID_FILE, String(process.pid));

  const server = new MockServer();
  await server.start();

  // Graceful shutdown handler
  const shutdown = async () => {
    console.log("\n[Mock Runner] Shutting down mock server...");
    await server.stop();
    await fs.unlink(PID_FILE).catch(() => {}); // Ignore errors if file is gone
    process.exit(0);
  };

  process.on("SIGINT", shutdown); // Catches Ctrl+C
  process.on("SIGTERM", shutdown); // Catches kill signals
}

start().catch((err) => {
  console.error("[Mock Runner] Failed to start:", err);
  process.exit(1);
});
