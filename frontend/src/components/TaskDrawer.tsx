import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { api, errorMessage } from "../api";
import {
  priorities,
  statuses,
  type Comment,
  type Project,
  type Task,
  type User,
  type Status,
} from "../types";
import { Avatar, ErrorBox, Modal, Spinner } from "./ui";
import TaskAttachments from "./TaskAttachments";

export default function TaskDrawer({
  taskId,
  project,
  user,
  onClose,
  initialStatus = "TODO",
}: {
  taskId: string | null;
  project: Project;
  user: User;
  onClose: () => void;
  initialStatus?: Status;
}) {
  const client = useQueryClient();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [comment, setComment] = useState(""),
    [commentBusy, setCommentBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false),
    [deleteBusy, setDeleteBusy] = useState(false);
  const task = useQuery({
    queryKey: ["task", taskId],
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async () => (await api.get<Task>(`/tasks/${taskId}`)).data,
    enabled: !!taskId,
  });
  const comments = useQuery({
    queryKey: ["comments", taskId],
    queryFn: async () =>
      (await api.get<Comment[]>(`/tasks/${taskId}/comments`)).data,
    enabled: !!taskId,
  });
  const invalidate = () => {
    client.invalidateQueries({ queryKey: ["tasks", project.id] });
    client.invalidateQueries({ queryKey: ["projects"] });
    if (taskId) client.invalidateQueries({ queryKey: ["task", taskId] });
  };
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    const date = String(f.get("dueDate"));
    const body = {
      title: String(f.get("title")).trim(),
      description: f.get("description"),
      status: f.get("status"),
      priority: f.get("priority"),
      assigneeId: f.get("assigneeId") || null,
      dueDate: date ? new Date(`${date}T23:59:00`).toISOString() : null,
    };
    try {
      if (taskId) {
        await api.patch(`/tasks/${taskId}`, body);
        setNotice("Đã lưu thay đổi.");
      } else {
        await api.post(`/projects/${project.id}/tasks`, body);
        onClose();
      }
      invalidate();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function sendComment(e: FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setCommentBusy(true);
    setError("");
    try {
      await api.post(`/tasks/${taskId}/comments`, { content: comment });
      setComment("");
      client.invalidateQueries({ queryKey: ["comments", taskId] });
      invalidate();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCommentBusy(false);
    }
  }
  async function remove() {
    setDeleteBusy(true);
    setError("");
    try {
      await api.delete(`/tasks/${taskId}`);
      invalidate();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }
  const t = task.data;
  const localDate = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  return (
    <Modal
      drawer
      title={taskId ? "Chi tiết công việc" : "Tạo công việc mới"}
      onClose={uploading ? () => {} : onClose}
    >
      {taskId && task.isLoading ? (
        <Spinner />
      ) : taskId && task.isError ? (
        <ErrorBox message={errorMessage(task.error)} />
      ) : (
        <>
          <p className="mb-5 text-xs font-medium text-brand">
            {project.key} / {project.title}
          </p>
          <form onSubmit={save} className="space-y-5">
            <label className="field-label">
              Tiêu đề
              <input
                name="title"
                required
                maxLength={200}
                defaultValue={t?.title}
                placeholder="Cần hoàn thành điều gì?"
              />
            </label>
            <label className="field-label">
              Mô tả
              <textarea
                name="description"
                rows={4}
                maxLength={20000}
                defaultValue={t?.description || ""}
                placeholder="Thêm thông tin, yêu cầu và mục tiêu…"
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="field-label">
                Trạng thái
                <select name="status" defaultValue={t?.status || initialStatus}>
                  {Object.entries(statuses).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Ưu tiên
                <select name="priority" defaultValue={t?.priority || "MEDIUM"}>
                  {Object.entries(priorities).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Người phụ trách
                <select name="assigneeId" defaultValue={t?.assigneeId || ""}>
                  <option value="">Chưa phân công</option>
                  {project.members?.map((m) => (
                    <option key={m.id} value={m.user.id}>
                      {m.user.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Hạn hoàn thành
                <input
                  name="dueDate"
                  type="date"
                  defaultValue={localDate(t?.dueDate)}
                />
              </label>
            </div>
            {error && <ErrorBox message={error} />}
            {notice && (
              <p role="status" className="text-sm text-emerald-600">
                {notice}
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <div>
                {taskId &&
                  (project.role === "ADMIN" || t?.creatorId === user.id) && (
                    <button
                      type="button"
                      className="flex items-center gap-2 text-xs text-red-500 hover:text-red-700"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 size={15} /> Xóa công việc
                    </button>
                  )}
              </div>
              <button disabled={busy || uploading} className="btn-primary">
                {busy ? "Đang lưu…" : taskId ? "Lưu thay đổi" : "Tạo công việc"}
              </button>
            </div>
          </form>
          {confirmDelete && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">
                Bạn có chắc muốn xóa công việc này?
              </p>
              <p className="mt-2 text-xs leading-5 text-red-700">
                Công việc, bình luận và metadata tệp đính kèm sẽ bị xóa khỏi cơ
                sở dữ liệu. Thao tác không thể hoàn tác. Tệp gốc trên S3 được
                giữ lại.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  className="btn-secondary"
                  onClick={() => setConfirmDelete(false)}
                >
                  Giữ lại
                </button>
                <button
                  disabled={deleteBusy || uploading}
                  className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  onClick={remove}
                >
                  {deleteBusy ? "Đang xóa…" : "Xác nhận xóa"}
                </button>
              </div>
            </div>
          )}
          {taskId && (
            <>
              <TaskAttachments
                taskId={taskId}
                projectId={project.id}
                attachments={t?.attachments || []}
                onBusyChange={setUploading}
              />
              <section className="mt-8 border-t border-slate-200 pt-6">
                <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare size={17} /> Bình luận{" "}
                  <span className="text-slate-400">
                    {comments.data?.length || 0}
                  </span>
                </h3>
                {comments.isLoading ? (
                  <Spinner />
                ) : comments.isError ? (
                  <ErrorBox message={errorMessage(comments.error)} />
                ) : (
                  <div className="space-y-5">
                    {comments.data?.map((c) => (
                      <article key={c.id} className="flex gap-3">
                        <Avatar name={c.user.fullName} small />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold">
                              {c.user.fullName}
                            </span>
                            <time className="text-[10px] text-slate-400">
                              {new Date(c.createdAt).toLocaleString("vi-VN")}
                            </time>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                            {c.content}
                          </p>
                        </div>
                      </article>
                    ))}
                    {!comments.data?.length && (
                      <p className="mb-3 text-xs text-slate-400">
                        Bắt đầu cuộc trao đổi với nhóm.
                      </p>
                    )}
                  </div>
                )}
                <form onSubmit={sendComment} className="mt-6">
                  <textarea
                    aria-label="Nội dung bình luận"
                    rows={3}
                    maxLength={10000}
                    placeholder="Viết bình luận…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      disabled={commentBusy || !comment.trim()}
                      className="btn-primary"
                    >
                      <Send size={15} />
                      {commentBusy ? "Đang gửi…" : "Gửi bình luận"}
                    </button>
                  </div>
                </form>
              </section>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
