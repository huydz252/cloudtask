import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Cloud,
  LayoutDashboard,
  LogOut,
  Plus,
  ArrowUpRight,
  FolderKanban,
  Users,
  Search,
  Menu,
  X,
} from "lucide-react";
import { api, sessionApi, restoreSession, setToken, errorMessage } from "./api";
import type { Project, User } from "./types";
import Auth from "./components/Auth";
import Board from "./components/Board";
import { Avatar, ErrorBox, Modal, Spinner } from "./components/ui";

export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null),
    [create, setCreate] = useState(false),
    [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(""),
    [sessionError, setSessionError] = useState("");
  const client = useQueryClient();
  useEffect(() => {
    let alive = true;
    restoreSession()
      .then((data) => {
        if (alive) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    const expired = () => {
      setUser(null);
      setProjectId(null);
      client.clear();
    };
    window.addEventListener("session-expired", expired);
    return () => {
      alive = false;
      window.removeEventListener("session-expired", expired);
    };
  }, [client]);
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<Project[]>("/projects")).data,
    enabled: !!user,
  });
  const closeCreate = useCallback(() => setCreate(false), []);
  async function logout() {
    setSessionError("");
    try {
      await sessionApi.post("/auth/logout", {});
      setToken(null);
      setUser(null);
      setProjectId(null);
      client.clear();
    } catch (error) {
      setSessionError(errorMessage(error));
    }
  }
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        <Spinner />
      </div>
    );
  if (!user)
    return (
      <Auth
        onLogin={(u) => {
          setUser(u);
          client.clear();
        }}
      />
    );
  const active = projects.data?.find((p) => p.id === projectId);
  const choose = (id: string | null) => {
    setProjectId(id);
    setMobile(false);
  };
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white p-5 transition-transform lg:translate-x-0 ${mobile ? "translate-x-0 shadow-xl" : "-translate-x-full"}`}
      >
        <div className="mb-10 flex items-center gap-3 px-2 text-xl font-bold">
          <span className="rounded-xl bg-brand p-2 text-white">
            <Cloud size={22} />
          </span>
          CloudTask
          <button
            className="ml-auto lg:hidden"
            aria-label="Đóng menu"
            onClick={() => setMobile(false)}
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">
          Không gian làm việc
        </p>
        <button
          className={`nav-item ${!projectId ? "active" : ""}`}
          onClick={() => choose(null)}
        >
          <LayoutDashboard size={18} /> Tổng quan
        </button>
        <div className="mb-3 mt-8 flex items-center justify-between px-3">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">
            Dự án của bạn
          </p>
          <button
            aria-label="Tạo dự án"
            onClick={() => setCreate(true)}
            className="text-slate-400 hover:text-brand"
          >
            <Plus size={16} />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {projects.data?.map((p) => (
            <button
              key={p.id}
              className={`nav-item w-full ${projectId === p.id ? "active" : ""}`}
              onClick={() => choose(p.id)}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-indigo-50 text-[10px] font-bold text-brand">
                {p.key.slice(0, 2)}
              </span>
              <span className="truncate">{p.title}</span>
            </button>
          ))}
        </nav>
        <div className="mt-5 border-t border-slate-100 pt-5">
          <div className="flex items-center gap-3 px-2">
            <Avatar name={user.fullName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.fullName}</p>
              <p className="truncate text-[11px] text-slate-400">
                {user.email}
              </p>
            </div>
            <button
              aria-label="Đăng xuất"
              title="Đăng xuất"
              className="text-slate-400 hover:text-red-600"
              onClick={logout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="lg:ml-64">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 md:px-10">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden"
              aria-label="Mở menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <span className="text-sm text-slate-400">Không gian làm việc</span>
            <span className="text-slate-300">/</span>
            <span className="max-w-40 truncate text-sm font-medium">
              {active?.title || "Tổng quan"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 sm:block">
              Sẵn sàng cộng tác
            </span>
            <Avatar name={user.fullName} />
          </div>
        </header>
        <main className="px-5 py-8 md:px-10 md:py-10">
          {sessionError && (
            <div className="mb-5">
              <ErrorBox message={sessionError} />
            </div>
          )}
          {projectId ? (
            <Board key={projectId} projectId={projectId} user={user} />
          ) : (
            <>
              <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand">
                    Tổng quan
                  </p>
                  <h1 className="text-3xl font-semibold tracking-tight">
                    Dự án của bạn
                  </h1>
                  <p className="mt-3 text-sm text-slate-500">
                    Một nơi để sắp xếp ưu tiên và cùng nhóm tiến về phía trước.
                  </p>
                </div>
                <button className="btn-primary" onClick={() => setCreate(true)}>
                  <Plus size={18} /> Tạo dự án
                </button>
              </div>
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  [
                    FolderKanban,
                    "Dự án đang tham gia",
                    projects.data?.length || 0,
                  ],
                  [
                    LayoutDashboard,
                    "Công việc đang mở",
                    projects.data?.reduce(
                      (n, p) => n + (p._count?.tasks || 0),
                      0,
                    ) || 0,
                  ],
                  [
                    Users,
                    "Dự án bạn quản lý",
                    projects.data?.filter((p) => p.role === "ADMIN").length ||
                      0,
                  ],
                ].map(([Icon, label, count], i) => {
                  const I = Icon as typeof Users;
                  return (
                    <div
                      className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5"
                      key={i}
                    >
                      <span className="rounded-xl bg-indigo-50 p-3 text-brand">
                        <I size={21} />
                      </span>
                      <div>
                        <p className="text-2xl font-semibold">
                          {count as number}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {label as string}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="font-semibold">
                  Tất cả dự án{" "}
                  <span className="ml-2 text-sm font-normal text-slate-400">
                    {projects.data?.length || 0}
                  </span>
                </h2>
                <label className="relative max-w-64">
                  <Search
                    size={16}
                    className="absolute left-3 top-3 text-slate-400"
                  />
                  <input
                    aria-label="Tìm dự án"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="!pl-9 !text-xs"
                    placeholder="Tìm dự án…"
                  />
                </label>
              </div>
              {projects.isLoading ? (
                <Spinner />
              ) : projects.isError ? (
                <ErrorBox message={errorMessage(projects.error)} />
              ) : projects.data?.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center">
                  <FolderKanban
                    size={38}
                    className="mx-auto mb-5 text-indigo-300"
                  />
                  <h2 className="text-lg font-semibold">
                    Bắt đầu với dự án đầu tiên
                  </h2>
                  <p className="mb-6 mt-2 text-sm text-slate-500">
                    Tạo dự án, mời thành viên và chia nhỏ mục tiêu thành công
                    việc.
                  </p>
                  <button
                    className="btn-primary mx-auto"
                    onClick={() => setCreate(true)}
                  >
                    <Plus size={17} /> Tạo dự án
                  </button>
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {projects.data
                    ?.filter((p) =>
                      `${p.title} ${p.key}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => choose(p.id)}
                        className="group rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50"
                      >
                        <div className="mb-5 flex items-center justify-between">
                          <span className="rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-brand">
                            {p.key}
                          </span>
                          <ArrowUpRight
                            size={19}
                            className="text-slate-300 group-hover:text-brand"
                          />
                        </div>
                        <h3 className="truncate text-lg font-semibold">
                          {p.title}
                        </h3>
                        <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">
                          {p.description || "Chưa có mô tả dự án."}
                        </p>
                        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
                          <span>{p._count?.tasks || 0} công việc đang mở</span>
                          <span className="flex items-center gap-1">
                            <Users size={14} />
                            {p._count?.members || 1} thành viên
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
      {create && (
        <CreateProject
          onClose={closeCreate}
          onCreated={(id) => {
            client.invalidateQueries({ queryKey: ["projects"] });
            setCreate(false);
            choose(id);
          }}
        />
      )}
    </div>
  );
}
function CreateProject({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/projects", {
        title: f.get("title"),
        key: String(f.get("key")).toUpperCase(),
        description: f.get("description"),
      });
      onCreated(data.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Tạo dự án mới" onClose={onClose}>
      <form className="space-y-5" onSubmit={submit}>
        <label className="field-label">
          Tên dự án
          <input
            name="title"
            required
            minLength={2}
            maxLength={150}
            placeholder="Ví dụ: Ra mắt sản phẩm"
            autoFocus
          />
        </label>
        <label className="field-label">
          Mã dự án
          <input
            name="key"
            required
            pattern="[A-Za-z][A-Za-z0-9]{1,9}"
            maxLength={10}
            placeholder="PRJ"
          />
          <span className="text-xs font-normal text-slate-400">
            2–10 ký tự, bắt đầu bằng chữ, chỉ chữ và số.
          </span>
        </label>
        <label className="field-label">
          Mô tả
          <textarea
            name="description"
            rows={3}
            maxLength={5000}
            placeholder="Mục tiêu của dự án…"
          />
        </label>
        {error && <ErrorBox message={error} />}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Hủy
          </button>
          <button disabled={busy} className="btn-primary">
            {busy ? "Đang tạo…" : "Tạo dự án"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
