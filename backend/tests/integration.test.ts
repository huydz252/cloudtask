import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../src/app";
import { db } from "../src/lib/db";

// Tests create unique records and preserve all rows. No delete/reset/cleanup is performed.
const enabled = !!process.env.TEST_DATABASE_URL;
describe.skipIf(!enabled)("PostgreSQL end-to-end API", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  let adminToken: string, memberToken: string, outsiderToken: string;
  let memberId: string, projectId: string, taskId: string;
  let firstRefresh = "",
    rotatedRefresh = "";
  const email = `admin-${suffix}@test.cloudtask.local`;
  const memberEmail = `member-${suffix}@test.cloudtask.local`;
  const headers = { Origin: "http://localhost:3000" };
  beforeAll(async () => {
    await db.$connect();
  });
  afterAll(async () => {
    await db.$disconnect();
  });
  it("registers three users; refresh cookie is HTTP-only; passwords are not returned", async () => {
    for (const [kind, addr] of [
      ["admin", email],
      ["member", memberEmail],
      ["outsider", `outsider-${suffix}@test.cloudtask.local`],
    ]) {
      const r = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: addr,
          password: "IntegrationTest!123",
          fullName: `${kind} Test`,
        });
      expect(r.status).toBe(201);
      expect(r.body.user.passwordHash).toBeUndefined();
      if (kind === "admin") {
        adminToken = r.body.token;
        firstRefresh = String(r.headers["set-cookie"][0]).split(";")[0];
        expect(r.headers["set-cookie"][0]).toContain("HttpOnly");
      }
      if (kind === "member") {
        memberToken = r.body.token;
        memberId = r.body.user.id;
      }
      if (kind === "outsider") outsiderToken = r.body.token;
    }
  });
  it("handles duplicate email and wrong password; logs in and gets profile", async () => {
    expect(
      (
        await request(app)
          .post("/api/v1/auth/register")
          .send({ email, password: "IntegrationTest!123", fullName: "Test" })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post("/api/v1/auth/login")
          .send({ email, password: "wrong" })
      ).status,
    ).toBe(401);
    const r = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "IntegrationTest!123" });
    expect(r.status).toBe(200);
    expect(
      (
        await request(app)
          .get("/api/v1/auth/me")
          .auth(adminToken, { type: "bearer" })
      ).body.email,
    ).toBe(email);
  });
  it("creates a project with admin membership; isolates outsiders", async () => {
    const r = await request(app)
      .post("/api/v1/projects")
      .auth(adminToken, { type: "bearer" })
      .send({
        title: "Integration project",
        key: `T${suffix}`,
        description: "Preserved test records",
      });
    expect(r.status).toBe(201);
    projectId = r.body.id;
    const detail = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .auth(adminToken, { type: "bearer" });
    expect(detail.body.role).toBe("ADMIN");
    expect(detail.body.members).toHaveLength(1);
    expect(
      (
        await request(app)
          .get(`/api/v1/projects/${projectId}`)
          .auth(outsiderToken, { type: "bearer" })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get("/api/v1/projects")
          .auth(outsiderToken, { type: "bearer" })
      ).body,
    ).toEqual([]);
  });
  it("adds members only as admin; rejects non-member assignee", async () => {
    const bad = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .auth(adminToken, { type: "bearer" })
      .send({ title: "Bad assignee", assigneeId: memberId });
    expect(bad.status).toBe(400);
    expect(
      (
        await request(app)
          .post(`/api/v1/projects/${projectId}/members`)
          .auth(adminToken, { type: "bearer" })
          .send({ email: memberEmail, role: "MEMBER" })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(app)
          .post(`/api/v1/projects/${projectId}/members`)
          .auth(memberToken, { type: "bearer" })
          .send({ email: "missing@test.com" })
      ).status,
    ).toBe(403);
  });
  it("creates tasks, changes Kanban status, filters and lists detail", async () => {
    const r = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .auth(adminToken, { type: "bearer" })
      .send({
        title: "Review integration",
        priority: "HIGH",
        assigneeId: memberId,
        dueDate: "2026-12-01T10:00:00Z",
      });
    expect(r.status).toBe(201);
    taskId = r.body.id;
    expect(r.body.assignee.id).toBe(memberId);
    expect(
      (
        await request(app)
          .patch(`/api/v1/tasks/${taskId}`)
          .auth(memberToken, { type: "bearer" })
          .send({ status: "IN_PROGRESS" })
      ).status,
    ).toBe(200);
    const list = await request(app)
      .get(
        `/api/v1/projects/${projectId}/tasks?status=IN_PROGRESS&priority=HIGH&assigneeId=${memberId}&search=review`,
      )
      .auth(adminToken, { type: "bearer" });
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(taskId);
    expect(
      (
        await request(app)
          .get(`/api/v1/tasks/${taskId}`)
          .auth(outsiderToken, { type: "bearer" })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch(`/api/v1/tasks/${taskId}`)
          .auth(memberToken, { type: "bearer" })
          .send({ assigneeId: null, dueDate: null, status: "DONE" })
      ).body.status,
    ).toBe("DONE");
  });
  it("creates and reads comments without leaking credentials", async () => {
    expect(
      (
        await request(app)
          .post(`/api/v1/tasks/${taskId}/comments`)
          .auth(memberToken, { type: "bearer" })
          .send({ content: "Kiểm thử thành công" })
      ).status,
    ).toBe(201);
    const list = await request(app)
      .get(`/api/v1/tasks/${taskId}/comments`)
      .auth(adminToken, { type: "bearer" });
    expect(list.body[0].content).toBe("Kiểm thử thành công");
    expect(list.body[0].user.passwordHash).toBeUndefined();
    expect(
      (
        await request(app)
          .post(`/api/v1/tasks/${taskId}/comments`)
          .auth(outsiderToken, { type: "bearer" })
          .send({ content: "forbidden" })
      ).status,
    ).toBe(404);
  });
  it("validates uploads and fails clearly if S3 is not configured", async () => {
    expect(
      (
        await request(app)
          .post(`/api/v1/tasks/${taskId}/attachments/presigned-url`)
          .auth(adminToken, { type: "bearer" })
          .send({
            fileName: "x.pdf",
            mimeType: "application/pdf",
            fileSize: 10485761,
          })
      ).status,
    ).toBe(400);
    if (!process.env.AWS_S3_BUCKET_NAME)
      expect(
        (
          await request(app)
            .post(`/api/v1/tasks/${taskId}/attachments/presigned-url`)
            .auth(adminToken, { type: "bearer" })
            .send({
              fileName: "x.pdf",
              mimeType: "application/pdf",
              fileSize: 100,
            })
        ).status,
      ).toBe(503);
  });
  it("rotates refresh tokens and prevents replay; logout revokes current token", async () => {
    const r = await request(app)
      .post("/api/v1/auth/refresh")
      .set(headers)
      .set("Cookie", firstRefresh)
      .send({});
    expect(r.status).toBe(200);
    rotatedRefresh = String(r.headers["set-cookie"][0]).split(";")[0];
    expect(
      (
        await request(app)
          .post("/api/v1/auth/refresh")
          .set(headers)
          .set("Cookie", firstRefresh)
          .send({})
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/v1/auth/logout")
          .set(headers)
          .set("Cookie", rotatedRefresh)
          .send({})
      ).status,
    ).toBe(204);
    expect(
      (
        await request(app)
          .post("/api/v1/auth/refresh")
          .set(headers)
          .set("Cookie", rotatedRefresh)
          .send({})
      ).status,
    ).toBe(401);
  });
  it("returns database-backed health and no open tasks after completion", async () => {
    const health = await request(app).get("/health");
    expect(health.status).toBe(200);
    expect(health.body.dbConnected).toBe(true);
    const projects = await request(app)
      .get("/api/v1/projects")
      .auth(adminToken, { type: "bearer" });
    expect(
      projects.body.find((p: { id: string }) => p.id === projectId)._count
        .tasks,
    ).toBe(0);
  });
});
