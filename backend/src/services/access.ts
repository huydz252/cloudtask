import { db } from "../lib/db";
import { AppError } from "../lib/errors";

export async function requireMember(
  projectId: string,
  userId: string,
  admin = false,
) {
  const membership = await db.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (!membership)
    throw new AppError(
      404,
      "Không tìm thấy dự án hoặc bạn không có quyền truy cập.",
    );
  if (admin && membership.role !== "ADMIN")
    throw new AppError(403, "Chỉ quản trị viên dự án có quyền thực hiện.");
  return membership;
}
export async function requireTask(taskId: string, userId: string) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) throw new AppError(404, "Không tìm thấy công việc.");
  const membership = await requireMember(task.projectId, userId);
  return { task, membership };
}
export async function checkAssignee(
  projectId: string,
  assigneeId?: string | null,
) {
  if (
    assigneeId &&
    !(await db.projectMember.findUnique({
      where: { userId_projectId: { userId: assigneeId, projectId } },
    }))
  ) {
    throw new AppError(400, "Người được giao phải là thành viên dự án.");
  }
}
