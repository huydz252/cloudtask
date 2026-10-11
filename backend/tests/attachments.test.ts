import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.hoisted(() => {
  process.env.AWS_S3_BUCKET_NAME = "cloudtask-test-private-bucket";
});
vi.mock("../src/lib/db", () => ({
  db: {
    task: { findUnique: vi.fn() },
    projectMember: { findUnique: vi.fn() },
    attachment: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  },
  publicUser: {},
}));
vi.mock("../src/services/storage", () => ({
  s3: { send: vi.fn() },
  allowedMimeTypes: ["application/pdf"],
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));
import { app } from "../src/app";
import { db } from "../src/lib/db";
import { s3 } from "../src/services/storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../src/config";
const userId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const id = "33333333-3333-4333-8333-333333333333";
const token = jwt.sign({ type: "access" }, config.JWT_SECRET, {
  subject: userId,
  issuer: "cloudtask",
  audience: "cloudtask-web",
  expiresIn: "15m",
});
const base = `/api/v1/tasks/${taskId}/attachments`;
const record = () => ({
  id,
  taskId,
  uploaderId: userId,
  objectKey: `projects/test/tasks/${taskId}/${id}`,
  fileName: "test.pdf",
  mimeType: "application/pdf",
  fileSize: 100,
  confirmedAt: null,
  uploadExpiresAt: new Date(Date.now() + 300000),
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.task.findUnique).mockResolvedValue({
    id: taskId,
    projectId: id,
  } as never);
  vi.mocked(db.projectMember.findUnique).mockResolvedValue({
    role: "MEMBER",
  } as never);
  vi.mocked(getSignedUrl).mockResolvedValue(
    "https://test.s3.amazonaws.com/signed-test",
  );
});
describe("private S3 upload protocol (mocked S3, no external uploads)", () => {
  it("returns upload headers and saves pending metadata with unique object key", async () => {
    vi.mocked(db.attachment.create).mockResolvedValue(record() as never);
    const r = await request(app)
      .post(`${base}/presigned-url`)
      .auth(token, { type: "bearer" })
      .send({
        fileName: "test.pdf",
        mimeType: "application/pdf",
        fileSize: 100,
      });
    expect(r.status).toBe(201);
    expect(r.body.headers["Content-Type"]).toBe("application/pdf");
    expect(r.body.headers["x-amz-meta-attachment-id"]).toBe(
      r.body.attachmentId,
    );
    expect(r.body.fileUrl).toContain("/download");
    expect(r.body.expiresIn).toBe(300);
    const saved = vi.mocked(db.attachment.create).mock.calls[0][0].data;
    expect(saved.uploaderId).toBe(userId);
    expect(saved.confirmedAt).toBeUndefined();
    expect(saved.objectKey).toContain(`tasks/${taskId}/`);
  });
  it("rejects unsafe filename, unsupported type and oversized files before signing", async () => {
    for (const body of [
      { fileName: "../test.pdf", mimeType: "application/pdf", fileSize: 100 },
      { fileName: "test.html", mimeType: "text/html", fileSize: 100 },
      { fileName: "test.pdf", mimeType: "application/pdf", fileSize: 10485761 },
    ]) {
      expect(
        (
          await request(app)
            .post(`${base}/presigned-url`)
            .auth(token, { type: "bearer" })
            .send(body)
        ).status,
      ).toBe(400);
    }
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
  it("requires the uploader when confirming", async () => {
    vi.mocked(db.attachment.findFirst).mockResolvedValueOnce(null);
    expect(
      (
        await request(app)
          .post(`${base}/${id}/confirm`)
          .auth(token, { type: "bearer" })
          .send({})
      ).status,
    ).toBe(404);
    expect(
      vi.mocked(db.attachment.findFirst).mock.calls[0][0]?.where,
    ).toMatchObject({ uploaderId: userId, taskId });
    expect(s3.send).not.toHaveBeenCalled();
  });
  it("rejects expired upload requests and unuploaded files", async () => {
    vi.mocked(db.attachment.findFirst).mockResolvedValueOnce({
      ...record(),
      uploadExpiresAt: new Date(0),
    } as never);
    expect(
      (
        await request(app)
          .post(`${base}/${id}/confirm`)
          .auth(token, { type: "bearer" })
          .send({})
      ).status,
    ).toBe(410);
    vi.mocked(db.attachment.findFirst).mockResolvedValueOnce(record() as never);
    vi.mocked(s3.send).mockRejectedValueOnce({
      $metadata: { httpStatusCode: 404 },
    } as never);
    expect(
      (
        await request(app)
          .post(`${base}/${id}/confirm`)
          .auth(token, { type: "bearer" })
          .send({})
      ).status,
    ).toBe(409);
    expect(db.attachment.update).not.toHaveBeenCalled();
  });
  it("does not confirm when S3 metadata differs", async () => {
    vi.mocked(db.attachment.findFirst).mockResolvedValueOnce(record() as never);
    vi.mocked(s3.send).mockResolvedValueOnce({
      ContentLength: 101,
      ContentType: "application/pdf",
      Metadata: { "attachment-id": id },
    } as never);
    expect(
      (
        await request(app)
          .post(`${base}/${id}/confirm`)
          .auth(token, { type: "bearer" })
          .send({})
      ).status,
    ).toBe(400);
    expect(db.attachment.update).not.toHaveBeenCalled();
  });
  it("confirms exact metadata and repeats idempotently", async () => {
    const confirmed = { ...record(), confirmedAt: new Date() };
    vi.mocked(db.attachment.findFirst)
      .mockResolvedValueOnce(record() as never)
      .mockResolvedValueOnce(confirmed as never);
    vi.mocked(s3.send).mockResolvedValueOnce({
      ContentLength: 100,
      ContentType: "application/pdf",
      Metadata: { "attachment-id": id },
    } as never);
    vi.mocked(db.attachment.update).mockResolvedValueOnce(confirmed as never);
    expect(
      (
        await request(app)
          .post(`${base}/${id}/confirm`)
          .auth(token, { type: "bearer" })
          .send({})
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`${base}/${id}/confirm`)
          .auth(token, { type: "bearer" })
          .send({})
      ).status,
    ).toBe(200);
    expect(s3.send).toHaveBeenCalledTimes(1);
    expect(db.attachment.update).toHaveBeenCalledTimes(1);
  });
  it("issues short private download URLs only for confirmed files", async () => {
    vi.mocked(db.attachment.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...record(), confirmedAt: new Date() } as never);
    expect(
      (
        await request(app)
          .get(`${base}/${id}/download`)
          .auth(token, { type: "bearer" })
      ).status,
    ).toBe(404);
    const r = await request(app)
      .get(`${base}/${id}/download`)
      .auth(token, { type: "bearer" });
    expect(r.status).toBe(200);
    expect(r.body.expiresIn).toBe(60);
    expect(
      vi.mocked(db.attachment.findFirst).mock.calls[1][0]?.where,
    ).toMatchObject({ confirmedAt: { not: null } });
  });
});
