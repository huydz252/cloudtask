import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import { db } from "./lib/db";
import { router } from "./routes";
import { errorHandler } from "./middlewares/http";

export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", config.TRUST_PROXY);
app.use(helmet());
app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "128kb" }));
app.use(cookieParser());
app.get(["/health", "/api/v1/health"], async (_req, res) => {
  let dbConnected = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbConnected = true;
  } catch {
    /* Readiness returns 503 when DB is unavailable. */
  }
  res
    .status(dbConnected ? 200 : 503)
    .json({
      status: dbConnected ? "ok" : "degraded",
      uptime: process.uptime(),
      dbConnected,
    });
});
app.use(
  "/api/v1",
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      success: false,
      message: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
    },
  }),
  router,
);
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Không tìm thấy endpoint." });
});
app.use(errorHandler);
