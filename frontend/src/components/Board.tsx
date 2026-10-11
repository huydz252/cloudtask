import { useCallback, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Circle,
  CircleCheck,
  Clock3,
  LayoutGrid,
  List,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { api, errorMessage } from "../api";
import {
  priorities,
  statuses,
  type Project,
  type Task,
  type User,
  type Status,
} from "../types";
import { Avatar, ErrorBox, Modal, Spinner } from "./ui";
import TaskDrawer from "./TaskDrawer";

export default function Board({
  projectId,
  user,
}: {
  projectId: string;
  user: User;
}) {
  const [view, setView] = useState<"board" | "list">("board"),
    [search, setSearch] = useState(""),
    [assignee, setAssignee] = useState(""),
    [priority, setPriority] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null),
    [create, setCreate] = useState(false),
    [members, setMembers] = useState(false),
    [moveError, setMoveError] = useState("");
  const [dragOver, setDragOver] = useState<Status | null>(null);
  const [createStatus, setCreateStatus] = useState<Status>("TODO");
  const client = useQueryClient();
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () =>
      (await api.get<Project>(`/projects/${projectId}`)).data,
  });
  const tasks = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async () =>
      (await api.get<Task[]>(`/projects/${projectId}/tasks`)).data,
  });
  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) =>
      api.patch(`/tasks/${id}`, { status }),
    onSuccess: (_response, variables) => {
      client.invalidateQueries({ queryKey: ["tasks", projectId] });
      client.invalidateQueries({ queryKey: ["task", variables.id] });
      client.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => setMoveError(errorMessage(error)),
  });
  const closeDrawer = useCallback(() => {
    setTaskId(null);
    setCreate(false);
  }, []);
  const closeMembers = useCallback(() => setMembers(false), []);
  const filtered =
    tasks.data?.filter(
      (t) =>
        t.title.toLowerCase().includes(search.toLowerCase()) &&
        (!assignee ||
          (assignee === "none" ? !t.assigneeId : t.assigneeId === assignee)) &&
        (!priority ||
          (priority === "important"
            ? ["HIGH", "URGENT"].includes(t.priority)
            : t.priority === priority)),
    ) || [];
  if (project.isLoading || tasks.isLoading) return <Spinner />;
  if (project.isError || tasks.isError)
    return <ErrorBox message={errorMessage(project.error || tasks.error)} />;
  if (!project.data) return null;
  const p = project.data;
  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <span className="rounded-md bg-indigo-100 px-2 py-1 text-xs font-bold text-brand">
              {p.key}
            </span>
            <span className="text-xs text-slate-400">
              {p.role === "ADMIN" ? "Quản trị viên" : "Thành viên"}
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{p.title}</h1>
          <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-slate-500">
            {p.description ||
              "Theo dõi công việc và cùng nhóm hoàn thành mục tiêu."}
          </p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary" onClick={() => setMembers(true)}>
            <Users size={17} />
            <span className="hidden sm:inline">Thành viên</span>{" "}
            {p.members?.length}
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              setCreateStatus("TODO");
              setCreate(true);
            }}
          >
            <Plus size={17} /> Tạo công việc
          </button>
        </div>
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            className={`view-button ${view === "board" ? "selected" : ""}`}
            onClick={() => setView("board")}
          >
            <LayoutGrid size={15} /> Kanban
          </button>
          <button
            className={`view-button ${view === "list" ? "selected" : ""}`}
            onClick={() => setView("list")}
          >
            <List size={15} /> Danh sách
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="relative">
            <Search
              size={16}
              className="absolute left-3 top-3 text-slate-400"
            />
            <input
              aria-label="Tìm công việc"
              className="!w-48 !pl-9 !text-xs"
              placeholder="Tìm công việc…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Lọc người phụ trách"
            className="!w-auto !text-xs"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="">Mọi người phụ trách</option>
            <option value={user.id}>Của tôi</option>
            <option value="none">Chưa phân công</option>
            {p.members
              ?.filter((m) => m.user.id !== user.id)
              .map((m) => (
                <option key={m.id} value={m.user.id}>
                  {m.user.fullName}
                </option>
              ))}
          </select>
          <select
            aria-label="Lọc ưu tiên"
            className="!w-auto !text-xs"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="">Mọi mức ưu tiên</option>
            <option value="important">Cao & khẩn cấp</option>
            {Object.entries(priorities).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {moveError && (
        <div className="mb-5">
          <ErrorBox message={moveError} />
        </div>
      )}
      <p className="mb-4 text-xs text-slate-400">
        {filtered.length} công việc
        {view === "board"
          ? " · Kéo thả thẻ để chuyển trạng thái. Bạn cũng có thể đổi trạng thái trong chi tiết."
          : ""}
        {move.isPending ? " · Đang cập nhật…" : ""}
      </p>
      {view === "board" ? (
        <div className="grid items-start gap-5 md:grid-cols-3">
          {(Object.keys(statuses) as Status[]).map((status) => {
            const column = filtered.filter((t) => t.status === status);
            const Icon =
              status === "DONE"
                ? CircleCheck
                : status === "IN_PROGRESS"
                  ? Clock3
                  : Circle;
            return (
              <section
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(status);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const id = e.dataTransfer.getData("text/cloudtask-id");
                  const task = tasks.data?.find((t) => t.id === id);
                  if (task && task.status !== status && !move.isPending) {
                    setMoveError("");
                    move.mutate({ id, status });
                  }
                }}
                className={`min-h-72 rounded-2xl border p-3 ${dragOver === status ? "border-brand bg-indigo-50" : "border-slate-200/70 bg-slate-100/70"}`}
              >
                <div className="mb-4 flex items-center justify-between px-2 pt-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <Icon
                      size={16}
                      className={
                        status === "DONE"
                          ? "text-emerald-500"
                          : status === "IN_PROGRESS"
                            ? "text-brand"
                            : "text-slate-400"
                      }
                    />
                    {statuses[status]}
                    <span className="rounded-md bg-white px-2 py-0.5 text-xs text-slate-400">
                      {column.length}
                    </span>
                  </h2>
                  <button
                    aria-label={`Tạo công việc ${statuses[status]}`}
                    onClick={() => {
                      setCreateStatus(status);
                      setCreate(true);
                    }}
                    className="text-slate-400 hover:text-brand"
                  >
                    <Plus size={17} />
                  </button>
                </div>
                <div className="space-y-3">
                  {column.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      onClick={() => setTaskId(t.id)}
                    />
                  ))}
                </div>
                {column.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-xs text-slate-400">
                    {tasks.data?.length
                      ? "Chưa có công việc phù hợp"
                      : "Tạo công việc để bắt đầu"}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                {[
                  "Công việc",
                  "Trạng thái",
                  "Ưu tiên",
                  "Người phụ trách",
                  "Hạn hoàn thành",
                ].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-5 py-4 font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-indigo-50/40"
                >
                  <td className="max-w-md px-5 py-4">
                    <button
                      className="text-left font-medium hover:text-brand"
                      onClick={() => setTaskId(t.id)}
                    >
                      {t.title}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-xs">
                    {statuses[t.status]}
                  </td>
                  <td className="px-5 py-4">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-xs">
                    {t.assignee?.fullName || "Chưa phân công"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                    {t.dueDate
                      ? new Date(t.dueDate).toLocaleDateString("vi-VN")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="p-10 text-center text-sm text-slate-400">
              Không có công việc phù hợp.
            </div>
          )}
        </div>
      )}
      {(create || taskId) && (
        <TaskDrawer
          key={taskId || "new"}
          taskId={taskId}
          initialStatus={createStatus}
          project={p}
          user={user}
          onClose={closeDrawer}
        />
      )}
      {members && <Members project={p} onClose={closeMembers} />}
    </>
  );
}
export function PriorityBadge({ priority }: { priority: Task["priority"] }) {
  return (
    <span className={`priority priority-${priority.toLowerCase()}`}>
      {priorities[priority]}
    </span>
  );
}
function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const overdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== "DONE";
  return (
    <button
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/cloudtask-id", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onClick}
      className="w-full cursor-grab rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-200 hover:shadow-md active:cursor-grabbing"
    >
      <PriorityBadge priority={task.priority} />
      <h3
        className={`mb-2 mt-3 text-sm font-semibold leading-6 ${task.status === "DONE" ? "text-slate-500" : "text-ink"}`}
      >
        {task.title}
      </h3>
      {task.description && (
        <p className="mb-4 line-clamp-2 text-xs leading-5 text-slate-400">
          {task.description}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          {task.dueDate && (
            <span
              className={`flex items-center gap-1 ${overdue ? "text-red-500" : ""}`}
            >
              <CalendarDays size={12} />
              {new Date(task.dueDate).toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
          )}
          {task._count.comments > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare size={12} />
              {task._count.comments}
            </span>
          )}
          {task._count.attachments > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip size={12} />
              {task._count.attachments}
            </span>
          )}
        </div>
        {task.assignee ? (
          <Avatar name={task.assignee.fullName} small />
        ) : (
          <span className="text-[10px] text-slate-300">Chưa gán</span>
        )}
      </div>
    </button>
  );
}
function Members({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const client = useQueryClient();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.post(`/projects/${project.id}/members`, {
        email: f.get("email"),
        role: f.get("role"),
      });
      await client.invalidateQueries({ queryKey: ["project", project.id] });
      client.invalidateQueries({ queryKey: ["projects"] });
      form.reset();
      setNotice("Đã thêm thành viên.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Thành viên dự án" onClose={onClose}>
      <div className="mb-6 space-y-4">
        {project.members?.map((m) => (
          <div className="flex items-center gap-3" key={m.id}>
            <Avatar name={m.user.fullName} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{m.user.fullName}</p>
              <p className="truncate text-xs text-slate-400">{m.user.email}</p>
            </div>
            <span className="text-xs text-slate-500">
              {m.role === "ADMIN" ? "Quản trị viên" : "Thành viên"}
            </span>
          </div>
        ))}
      </div>
      {project.role === "ADMIN" && (
        <form
          className="space-y-4 border-t border-slate-100 pt-6"
          onSubmit={submit}
        >
          <p className="text-sm font-semibold">
            Thêm thành viên đã có tài khoản
          </p>
          <label className="field-label">
            Email
            <input
              name="email"
              type="email"
              required
              placeholder="thanhvien@congty.com"
            />
          </label>
          <label className="field-label">
            Vai trò
            <select name="role">
              <option value="MEMBER">Thành viên</option>
              <option value="ADMIN">Quản trị viên</option>
            </select>
          </label>
          {error && <ErrorBox message={error} />}
          {notice && (
            <p role="status" className="text-sm text-emerald-600">
              {notice}
            </p>
          )}
          <button disabled={busy} className="btn-primary w-full justify-center">
            {busy ? "Đang thêm…" : "Thêm vào dự án"}
          </button>
        </form>
      )}
    </Modal>
  );
}
