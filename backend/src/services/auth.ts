import { createHash, randomBytes } from "node:crypto";
import { Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import { db } from "../lib/db";
import { config } from "../config";

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newRefresh = () => randomBytes(48).toString("base64url");
export const refreshExpiry = () =>
  new Date(Date.now() + config.REFRESH_TOKEN_DAYS * 86400000);
export function accessToken(userId: string) {
  return jwt.sign({ type: "access" }, config.JWT_SECRET, {
    subject: userId,
    algorithm: "HS256",
    issuer: "cloudtask",
    audience: "cloudtask-web",
    expiresIn: config.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}
const cookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/v1/auth",
};
export function setRefreshCookie(res: Response, token: string) {
  res.cookie("refreshToken", token, {
    ...cookieOptions,
    maxAge: config.REFRESH_TOKEN_DAYS * 86400000,
  });
}
export function clearRefreshCookie(res: Response) {
  res.clearCookie("refreshToken", cookieOptions);
}
export async function issueSession(userId: string, res: Response) {
  const token = newRefresh();
  await db.refreshToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: refreshExpiry() },
  });
  setRefreshCookie(res, token);
  return accessToken(userId);
}
