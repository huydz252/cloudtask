import { useState, type FormEvent } from "react";
import { z } from "zod";
import {
  Cloud,
  ArrowRight,
  Check,
  Layers3,
  ShieldCheck,
  Users,
} from "lucide-react";
import { sessionApi, setToken, errorMessage } from "../api";
import type { User } from "../types";
import { ErrorBox } from "./ui";
export default function Auth({ onLogin }: { onLogin: (user: User) => void }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const body = {
      email: String(form.get("email")).trim().toLowerCase(),
      password: String(form.get("password")),
      ...(register ? { fullName: String(form.get("fullName")).trim() } : {}),
    };
    const result = z
      .object({
        email: z.string().email("Email không hợp lệ."),
        password: z
          .string()
          .min(register ? 8 : 1, "Mật khẩu cần ít nhất 8 ký tự.")
          .refine(
            (s) => new TextEncoder().encode(s).length <= 72,
            "Mật khẩu tối đa 72 byte.",
          ),
        fullName: register
          ? z.string().min(2, "Họ tên cần ít nhất 2 ký tự.")
          : z.string().optional(),
      })
      .safeParse(body);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const { data } = await sessionApi.post(
        `/auth/${register ? "register" : "login"}`,
        body,
      );
      setToken(data.token);
      onLogin(data.user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-ink p-16 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 top-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative flex items-center gap-3 text-xl font-bold">
          <span className="rounded-xl bg-white/10 p-2">
            <Cloud />
          </span>{" "}
          CloudTask
        </div>
        <div className="relative max-w-lg">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs text-indigo-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> KHÔNG GIAN
            LÀM VIỆC CỦA NHÓM
          </span>
          <h1 className="text-5xl font-semibold leading-tight tracking-tight">
            Từ ý tưởng
            <br />
            đến hoàn thành.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-300">
            Kết nối con người, dự án và công việc. Giữ mọi ưu tiên rõ ràng để cả
            nhóm cùng tiến về phía trước.
          </p>
          <div className="mt-10 space-y-4 text-sm text-slate-200">
            {[
              [Layers3, "Theo dõi tiến độ với bảng Kanban"],
              [Users, "Cộng tác và phân công trong một nơi"],
              [ShieldCheck, "Dữ liệu dự án được bảo vệ theo quyền"],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof Layers3;
              return (
                <div key={i} className="flex items-center gap-3">
                  <I size={18} className="text-indigo-300" />
                  {text as string}
                </div>
              );
            })}
          </div>
        </div>
        <p className="relative text-xs text-slate-400">
          CloudTask · Không gian để làm việc hiệu quả
        </p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2 text-xl font-bold text-brand lg:hidden">
            <Cloud />
            CloudTask
          </div>
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-brand">
            <Check size={25} />
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-ink">
            {register ? "Bắt đầu cùng CloudTask" : "Chào mừng trở lại"}
          </h2>
          <p className="mb-8 mt-3 text-sm text-slate-500">
            {register
              ? "Tạo tài khoản để cùng nhóm hoàn thành công việc."
              : "Đăng nhập để tiếp tục công việc của bạn."}
          </p>
          <form onSubmit={submit} className="space-y-5">
            {register && (
              <label className="field-label">
                Họ và tên
                <input
                  name="fullName"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Nguyễn Minh Anh"
                />
              </label>
            )}
            <label className="field-label">
              Email
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                placeholder="ban@congty.com"
              />
            </label>
            <label className="field-label">
              Mật khẩu
              <input
                name="password"
                type="password"
                required
                minLength={register ? 8 : 1}
                autoComplete={register ? "new-password" : "current-password"}
                placeholder={register ? "Tối thiểu 8 ký tự" : "Nhập mật khẩu"}
              />
            </label>
            {error && <ErrorBox message={error} />}
            <button
              disabled={busy}
              className="btn-primary w-full justify-center"
            >
              {busy ? "Đang xử lý…" : register ? "Tạo tài khoản" : "Đăng nhập"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="mt-7 text-center text-sm text-slate-500">
            {register ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
            <button
              className="font-semibold text-brand"
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register ? "Đăng nhập" : "Đăng ký"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
