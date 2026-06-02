import http from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { setupSocketHandlers } from "./game/socketHandler.js";
import { setupYesNoHandlers } from "./game/yesnoHandler.js";
import { setupBombHandlers } from "./game/bombHandler.js";
import { setupBomb2Handlers } from "./game/bomb2Handler.js";
import { setupDotsHandlers } from "./game/dotsHandler.js";
import { loadConfusionEntries } from "./game/confusionStore.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  path: "/api/socket.io",
});

setupSocketHandlers(io);
setupYesNoHandlers(io);
setupBombHandlers(io);
setupBomb2Handlers(io);
setupDotsHandlers(io);

loadConfusionEntries().catch((err: Error) => {
  console.error(
    "[Supabase] CRITICAL: Failed to load confusion entries on startup:",
    err.message,
  );
  console.error(
    "[Supabase] Game will run WITHOUT confusion entries. Verify SUPABASE_URL and SUPABASE_ANON_KEY secrets.",
  );
  // Do NOT fall back to fake/sample data — fail loudly so the problem is visible
});

server.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
