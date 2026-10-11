import { RequestHandler } from "express";
import bcrypt from "bcrypt";
import { db, publicUser } from "../lib/db";
import { AppError } from "../lib/errors";
import {
  accessToken,
  clearRefreshCookie,
  hashToken,
  issueSession,
  newRefresh,
  refreshExpiry,
  setRefreshCookie,
} from "../services/auth";

export const register: RequestHandler = async (req, res) => {
  const { email, password, fullName } = req.body;
  const user = await db.user.create({
    data: { email, fullName, passwordHash: await bcrypt.hash(password, 12) },
    select: publicUser,
  });
  res.status(201).json({ token: await issueSession(user.id, res), user });
};
export const login: RequestHandler = async (req, res) => {
  const user = await db.user.findUnique({ where: { email: req.body.email } });
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash)))
    throw new AppError(401, "Email hoặc mật khẩu không đúng.");
  const { passwordHash: _hash, ...profile } = user;
  res.json({ token: await issueSession(user.id, res), user: profile });
};
export const me: RequestHandler = async (req, res) => {
  const user = await db.user.findUnique({
    where: { id: req.userId },
    select: publicUser,
  });
  if (!user) throw new AppError(401, "Tài khoản không còn tồn tại.");
  res.json(user);
};
export const refresh: RequestHandler = async (req, res) => {
  const oldToken = req.cookies.refreshToken;
  if (typeof oldToken !== "string")
    throw new AppError(401, "Vui lòng đăng nhập.");
  const tokenHash = hashToken(oldToken);
  const replacement = newRefresh();
  // Conditional update prevents two concurrent requests from reusing a refresh token.
  const userId = await db.$transaction(async (tx) => {
    const current = await tx.refreshToken.findUnique({ where: { tokenHash } });
    if (!current || current.revokedAt || current.expiresAt <= new Date())
      throw new AppError(401, "Phiên đăng nhập đã hết hạn.");
    const claimed = await tx.refreshToken.updateMany({
      where: { id: current.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    if (claimed.count !== 1) throw new AppError(401, "Phiên đã được sử dụng.");
    await tx.refreshToken.create({
      data: {
        userId: current.userId,
        tokenHash: hashToken(replacement),
        expiresAt: refreshExpiry(),
      },
    });
    return current.userId;
  });
  setRefreshCookie(res, replacement);
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: publicUser,
  });
  res.json({ token: accessToken(userId), user });
};
export const logout: RequestHandler = async (req, res) => {
  if (typeof req.cookies.refreshToken === "string")
    await db.refreshToken.updateMany({
      where: {
        tokenHash: hashToken(req.cookies.refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  clearRefreshCookie(res);
  res.status(204).send();
};
