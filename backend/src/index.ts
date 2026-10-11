import { app } from "./app";
import { config } from "./config";
import { db } from "./lib/db";
const server = app.listen(config.PORT, () =>
  console.log(
    JSON.stringify({
      level: "info",
      message: "CloudTask API started",
      port: config.PORT,
    }),
  ),
);
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(
    JSON.stringify({ level: "info", message: "Graceful shutdown", signal }),
  );
  server.close(async () => {
    await db.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
