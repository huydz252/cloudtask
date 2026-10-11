import { RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { db, publicUser } from "../lib/db";
import { AppError } from "../lib/errors";
import { checkAssignee, requireMember, requireTask } from "../services/access";
const include = {
  assignee: { select: publicUser },
  creator: { select: publicUser },
  _count: {
    select: {
      comments: true,
      attachments: { where: { confirmedAt: { not: null } } },
    },
  },
} as const;
export const listTasks: RequestHandler = async (req, res) => {
  await requireMember(req.params.projectId, req.userId);
  const { search, ...filters } = req.query as {
    search?: string;
    status?: Prisma.TaskWhereInput["status"];
    priority?: Prisma.TaskWhereInput["priority"];
    assigneeId?: string;
  };
  const tasks = await db.task.findMany({
    where: {
      projectId: req.params.projectId,
      ...filters,
      ...(search
        ? { title: { contains: search, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include,
  });
  res.json(tasks);
};
export const createTask: RequestHandler = async (req, res) => {
  await requireMember(req.params.projectId, req.userId);
  await checkAssignee(req.params.projectId, req.body.assigneeId);
  res
    .status(201)
    .json(
      await db.task.create({
        data: {
          ...req.body,
          projectId: req.params.projectId,
          creatorId: req.userId,
        },
        include,
      }),
    );
};
export const getTask: RequestHandler = async (req, res) => {
  await requireTask(req.params.id, req.userId);
  res.json(
    await db.task.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        ...include,
        attachments: {
          where: { confirmedAt: { not: null } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  );
};
export const updateTask: RequestHandler = async (req, res) => {
  const { task } = await requireTask(req.params.id, req.userId);
  await checkAssignee(task.projectId, req.body.assigneeId);
  res.json(
    await db.task.update({ where: { id: task.id }, data: req.body, include }),
  );
};
export const deleteTask: RequestHandler = async (req, res) => {
  const { task, membership } = await requireTask(req.params.id, req.userId);
  if (membership.role !== "ADMIN" && task.creatorId !== req.userId)
    throw new AppError(
      403,
      "Chỉ quản trị viên hoặc người tạo có thể xóa công việc.",
    );
  await db.task.delete({ where: { id: task.id } });
  // Do not delete S3 objects here. Storage cleanup is an explicit operator action.
  res.status(204).send();
};
export const listComments: RequestHandler = async (req, res) => {
  await requireTask(req.params.id, req.userId);
  res.json(
    await db.taskComment.findMany({
      where: { taskId: req.params.id },
      include: { user: { select: publicUser } },
      orderBy: { createdAt: "asc" },
    }),
  );
};
export const addComment: RequestHandler = async (req, res) => {
  await requireTask(req.params.id, req.userId);
  res
    .status(201)
    .json(
      await db.taskComment.create({
        data: {
          content: req.body.content,
          taskId: req.params.id,
          userId: req.userId,
        },
        include: { user: { select: publicUser } },
      }),
    );
};
