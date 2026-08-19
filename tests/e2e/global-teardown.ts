import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const PID_FILE = resolve(".next", "playwright-server.pid");

export default function globalTeardown() {
  try {
    const pid = Number.parseInt(readFileSync(PID_FILE, "utf8"), 10);
    if (Number.isInteger(pid)) process.kill(pid, "SIGKILL");
  } catch {
    // The server may already have exited.
  } finally {
    rmSync(PID_FILE, { force: true });
  }
}
