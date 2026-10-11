import { RequestHandler } from "express";
import { db, publicUser } from "../lib/db";
import { requireMember } from "../services/access";
import { AppError } from "../lib/errors";

export const listProjects: RequestHandler = async (req, res) => {
  const projects = await db.project.findMany({
    where: { members: { some: { userId: req.userId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      members: { where: { userId: req.userId }, select: { role: true } },
      _count: {
        select: {
          tasks: { where: { status: { not: "DONE" } } },
          members: true,
        },
      },
    },
  });
  res.json(
    projects.map(({ members, ...project }) => ({
      ...project,
      role: members[0].role,
    })),
  );
};
export const createProject: RequestHandler = async (req, res) => {
  const project = await db.project.create({
    data: {
      ...req.body,
      members: { create: { userId: req.userId, role: "ADMIN" } },
    },
  });
  res.status(201).json(project);
};
export const getProject: RequestHandler = async (req, res) => {
  const membership = await requireMember(req.params.id, req.userId);
  const project = await db.project.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      members: {
        include: { user: { select: publicUser } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  res.json({ ...project, role: membership.role });
};
export const addMember: RequestHandler = async (req, res) => {
  await requireMember(req.params.id, req.userId, true);
  const user = await db.user.findUnique({
    where: { email: req.body.email },
    select: publicUser,
  });
  if (!user)
    throw new AppError(
      404,
      "Người dùng cần đăng ký tài khoản trước khi được thêm vào dự án.",
    );
  const member = await db.projectMember.create({
    data: { projectId: req.params.id, userId: user.id, role: req.body.role },
    include: { user: { select: publicUser } },
  });
  res.status(201).json(member);
};
