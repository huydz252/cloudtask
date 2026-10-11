import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../src/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
    projectMember: { findUnique: vi.fn() },
    task: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
  publicUser: { id: true, email: true, fullName: true, avatarUrl: true },
}));
import { app } from "../src/app";
import { db } from "../src/lib/db";
import { config } from "../src/config";
import {
  taskPatchSchema,
  registerSchema,
  projectSchema,
} from "../src/lib/validation";
const userId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";
const token = () =>
  jwt.sign({ type: "access" }, config.JWT_SECRET, {
    subject: userId,
    issuer: "cloudtask",
    audience: "cloudtask-web",
    expiresIn: "15m",
  });
beforeEach(() => vi.clearAllMocks());
describe("validation and security boundaries", () => {
  it("rejects unknown mutation fields and empty task updates", () => {
    expect(taskPatchSchema.safeParse({}).success).toBe(false);
    expect(taskPatchSchema.safeParse({ creatorId: userId }).success).toBe(
      false,
    );
    expect(taskPatchSchema.safeParse({ status: "DONE" }).success).toBe(true);
  });
  it("normalizes emails and project keys; rejects oversized bcrypt passwords", () => {
    expect(
      registerSchema.parse({
        email: " DEMO@EXAMPLE.COM ",
        password: "password123",
        fullName: "Demo User",
      }).email,
    ).toBe("demo@example.com");
    expect(
      registerSchema.safeParse({
        email: "a@b.com",
        password: "😀".repeat(20),
        fullName: "Demo",
      }).success,
    ).toBe(false);
    expect(projectSchema.parse({ title: "Test", key: "dev" }).key).toBe("DEV");
  });
  it("requires bearer authentication", async () => {
    const response = await request(app).get("/api/v1/projects");
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
  it("rejects tokens with wrong audience and expired tokens", async () => {
    const wrong = jwt.sign({ type: "access" }, config.JWT_SECRET, {
      subject: userId,
      issuer: "cloudtask",
      audience: "wrong",
      expiresIn: "15m",
    });
    const expired = jwt.sign({ type: "access" }, config.JWT_SECRET, {
      subject: userId,
      issuer: "cloudtask",
      audience: "cloudtask-web",
      expiresIn: -1,
    });
    expect(
      (
        await request(app)
          .get("/api/v1/projects")
          .auth(wrong, { type: "bearer" })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .get("/api/v1/projects")
          .auth(expired, { type: "bearer" })
      ).status,
    ).toBe(401);
  });
  it("prevents foreign-origin refresh and logout", async () => {
    expect(
      (
        await request(app)
          .post("/api/v1/auth/refresh")
          .set("Origin", "https://evil.example")
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (await request(app).post("/api/v1/auth/logout").send({})).status,
    ).toBe(403);
  });
  it("returns readiness 503 when database is unavailable", async () => {
    vi.mocked(db.$queryRaw).mockRejectedValueOnce(new Error("offline"));
    const r = await request(app).get("/health");
    expect(r.status).toBe(503);
    expect(r.body.dbConnected).toBe(false);
    vi.mocked(db.$queryRaw).mockResolvedValueOnce([{ result: 1 }]);
    expect((await request(app).get("/health")).status).toBe(200);
  });
  it("blocks non-members from changing tasks", async () => {
    vi.mocked(db.task.findUnique).mockResolvedValueOnce({
      id: taskId,
      projectId,
    } as never);
    vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce(null);
    const r = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .auth(token(), { type: "bearer" })
      .send({ status: "DONE" });
    expect(r.status).toBe(404);
    expect(db.task.update).not.toHaveBeenCalled();
  });
  it("blocks ordinary members from deleting another creator task (mock DB only)", async () => {
    vi.mocked(db.task.findUnique).mockResolvedValueOnce({
      id: taskId,
      projectId,
      creatorId: "other",
    } as never);
    vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce({
      role: "MEMBER",
    } as never);
    const r = await request(app)
      .delete(`/api/v1/tasks/${taskId}`)
      .auth(token(), { type: "bearer" });
    expect(r.status).toBe(403);
    expect(db.task.delete).not.toHaveBeenCalled();
  });
  it("rejects malformed IDs, malformed JSON and extra query params", async () => {
    expect(
      (
        await request(app)
          .get("/api/v1/projects/not-a-uuid")
          .auth(token(), { type: "bearer" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/v1/auth/login")
          .set("Content-Type", "application/json")
          .send("{broken")
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .get(`/api/v1/projects/${projectId}/tasks?unknown=1`)
          .auth(token(), { type: "bearer" })
      ).status,
    ).toBe(400);
  });
});
