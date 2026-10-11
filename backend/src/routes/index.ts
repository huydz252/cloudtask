import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import * as auth from "../controllers/auth";
import * as projects from "../controllers/projects";
import * as tasks from "../controllers/tasks";
import * as attachments from "../controllers/attachments";
import { asyncHandler as wrap, validate } from "../middlewares/http";
import { authenticate, checkCookieOrigin } from "../middlewares/auth";
import {
  registerSchema,
  loginSchema,
  projectSchema,
  memberSchema,
  taskSchema,
  taskPatchSchema,
  taskQuerySchema,
  commentSchema,
  idParams,
} from "../lib/validation";
import { allowedMimeTypes } from "../services/storage";
import { config } from "../config";

export const router = Router();
const limit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau.",
  },
});
router.post(
  "/auth/register",
  limit,
  validate(registerSchema),
  wrap(auth.register),
);
router.post("/auth/login", limit, validate(loginSchema), wrap(auth.login));
router.post(
  "/auth/refresh",
  limit,
  checkCookieOrigin,
  validate(z.object({}).strict()),
  wrap(auth.refresh),
);
router.post(
  "/auth/logout",
  checkCookieOrigin,
  validate(z.object({}).strict()),
  wrap(auth.logout),
);
router.get("/auth/me", authenticate, wrap(auth.me));
router.use(authenticate);
router.get("/projects", wrap(projects.listProjects));
router.post("/projects", validate(projectSchema), wrap(projects.createProject));
router.get(
  "/projects/:id",
  validate(idParams("id"), "params"),
  wrap(projects.getProject),
);
router.post(
  "/projects/:id/members",
  validate(idParams("id"), "params"),
  validate(memberSchema),
  wrap(projects.addMember),
);
router.get(
  "/projects/:projectId/tasks",
  validate(idParams("projectId"), "params"),
  validate(taskQuerySchema, "query"),
  wrap(tasks.listTasks),
);
router.post(
  "/projects/:projectId/tasks",
  validate(idParams("projectId"), "params"),
  validate(taskSchema),
  wrap(tasks.createTask),
);
router.get(
  "/tasks/:id",
  validate(idParams("id"), "params"),
  wrap(tasks.getTask),
);
router.patch(
  "/tasks/:id",
  validate(idParams("id"), "params"),
  validate(taskPatchSchema),
  wrap(tasks.updateTask),
);
router.delete(
  "/tasks/:id",
  validate(idParams("id"), "params"),
  wrap(tasks.deleteTask),
);
router.get(
  "/tasks/:id/comments",
  validate(idParams("id"), "params"),
  wrap(tasks.listComments),
);
router.post(
  "/tasks/:id/comments",
  validate(idParams("id"), "params"),
  validate(commentSchema),
  wrap(tasks.addComment),
);
const attachmentParams = z.object({
  id: z.string().uuid(),
  attachmentId: z.string().uuid(),
});
router.post(
  "/tasks/:id/attachments/presigned-url",
  validate(idParams("id"), "params"),
  validate(
    z
      .object({
        fileName: z
          .string()
          .trim()
          .min(1)
          .max(255)
          .refine((s) => !/[\x00-\x1f/\\]/.test(s), "Tên tệp không hợp lệ."),
        mimeType: z
          .string()
          .refine(
            (s) => allowedMimeTypes.includes(s),
            "Định dạng tệp không được hỗ trợ.",
          ),
        fileSize: z.number().int().min(1).max(config.MAX_UPLOAD_BYTES),
      })
      .strict(),
  ),
  wrap(attachments.presignUpload),
);
router.post(
  "/tasks/:id/attachments/:attachmentId/confirm",
  validate(attachmentParams, "params"),
  validate(z.object({}).strict()),
  wrap(attachments.confirmUpload),
);
router.get(
  "/tasks/:id/attachments/:attachmentId/download",
  validate(attachmentParams, "params"),
  wrap(attachments.download),
);
