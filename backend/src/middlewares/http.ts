import { ErrorRequestHandler, RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError, ZodTypeAny } from "zod";
import { AppError } from "../lib/errors";

export const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
export const validate =
  (
    schema: ZodTypeAny,
    target: "body" | "query" | "params" = "body",
  ): RequestHandler =>
  (req, _res, next) => {
    try {
      req[target] = schema.parse(req[target]);
      next();
    } catch (error) {
      next(error);
    }
  };
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res
      .status(400)
      .json({
        success: false,
        message: "Dữ liệu không hợp lệ.",
        errors: error.flatten(),
      });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    res
      .status(409)
      .json({
        success: false,
        message: "Email, mã dự án hoặc thành viên đã tồn tại.",
      });
    return;
  }
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ success: false, message: "JSON không hợp lệ." });
    return;
  }
  if (error?.type === "entity.too.large") {
    res
      .status(413)
      .json({ success: false, message: "Nội dung vượt giới hạn." });
    return;
  }
  console.error(
    JSON.stringify({
      level: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    }),
  );
  res
    .status(500)
    .json({ success: false, message: "Lỗi máy chủ. Vui lòng thử lại." });
};
