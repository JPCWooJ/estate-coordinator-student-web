import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const pidFile = resolve(".next", "playwright-server.pid");
const nextBin = resolve("node_modules", "next", "dist", "bin", "next");
const server = spawn(
  process.execPath,
  [nextBin, "start", "--hostname", "127.0.0.1", "--port", "3100"],
  { env: process.env, stdio: "inherit" },
);

writeFileSync(pidFile, String(server.pid));
server.once("exit", (code) => process.exit(code ?? 0));
