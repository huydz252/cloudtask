import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { AppError } from "../lib/errors";

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}
export const authenticate: RequestHandler = (req, _res, next) => {
  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined;
  try {
    if (!token) throw new Error();
    const payload = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "cloudtask",
      audience: "cloudtask-web",
    });
    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      payload.type !== "access"
    )
      throw new Error();
    req.userId = payload.sub;
    next();
  } catch {
    next(new AppError(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."));
  }
};
export const checkCookieOrigin: RequestHandler = (req, _res, next) => {
  // Cookie-authenticated refresh/logout must be same origin; bearer endpoints are not cookie authenticated.
  if (req.headers.origin !== config.CORS_ORIGIN) {
    next(new AppError(403, "Nguồn yêu cầu không hợp lệ."));
    return;
  }
  next();
};
