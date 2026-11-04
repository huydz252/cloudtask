import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../src/lib/db", () => ({
  db: {
    projectMember: { findUnique: vi.fn() },
    project: { findUniqueOrThrow: vi.fn(), delete: vi.fn() },
  },
  publicUser: {},
}));
import { app } from "../src/app";
import { db } from "../src/lib/db";
import { config } from "../src/config";

const projectId = "33333333-3333-4333-8333-333333333333";
const token = jwt.sign({ type: "access" }, config.JWT_SECRET, {
  subject: "11111111-1111-4111-8111-111111111111",
  issuer: "cloudtask",
  audience: "cloudtask-web",
  expiresIn: "15m",
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.project.findUniqueOrThrow).mockResolvedValue({
    key: "DEMO",
  } as never);
});
describe("project deletion (mock database only; no real data deleted)", () => {
  it("requires authentication", async () => {
    expect(
      (
        await request(app)
          .delete(`/api/v1/projects/${projectId}`)
          .send({ confirmationKey: "DEMO" })
      ).status,
    ).toBe(401);
    expect(db.project.delete).not.toHaveBeenCalled();
  });
  it("rejects outsiders and ordinary members", async () => {
    vi.mocked(db.projectMember.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ role: "MEMBER" } as never);
    for (const status of [404, 403]) {
      expect(
        (
          await request(app)
            .delete(`/api/v1/projects/${projectId}`)
            .auth(token, { type: "bearer" })
            .send({ confirmationKey: "DEMO" })
        ).status,
      ).toBe(status);
    }
    expect(db.project.delete).not.toHaveBeenCalled();
  });
  it("requires an explicit matching confirmation key", async () => {
    vi.mocked(db.projectMember.findUnique).mockResolvedValue({
      role: "ADMIN",
    } as never);
    for (const body of [
      {},
      { confirmationKey: "WRONG" },
      { confirmationKey: "demo" },
    ]) {
      expect(
        (
          await request(app)
            .delete(`/api/v1/projects/${projectId}`)
            .auth(token, { type: "bearer" })
            .send(body)
        ).status,
      ).toBe(400);
    }
    expect(db.project.delete).not.toHaveBeenCalled();
  });
  it("allows confirmed admin deletion and returns 204", async () => {
    vi.mocked(db.projectMember.findUnique).mockResolvedValue({
      role: "ADMIN",
    } as never);
    vi.mocked(db.project.delete).mockResolvedValue({ id: projectId } as never);
    const response = await request(app)
      .delete(`/api/v1/projects/${projectId}`)
      .auth(token, { type: "bearer" })
      .send({ confirmationKey: "DEMO" });
    expect(response.status).toBe(204);
    expect(db.project.delete).toHaveBeenCalledExactlyOnceWith({
      where: { id: projectId },
    });
  });
  it("validates UUIDs before querying", async () => {
    expect(
      (
        await request(app)
          .delete("/api/v1/projects/invalid")
          .auth(token, { type: "bearer" })
          .send({ confirmationKey: "DEMO" })
      ).status,
    ).toBe(400);
    expect(db.projectMember.findUnique).not.toHaveBeenCalled();
    expect(db.project.delete).not.toHaveBeenCalled();
  });
});
