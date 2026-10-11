import { randomUUID } from "node:crypto";
import { RequestHandler } from "express";
import {
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config";
import { db } from "../lib/db";
import { AppError } from "../lib/errors";
import { requireTask } from "../services/access";
import { s3 } from "../services/storage";

function bucket() {
  if (!config.AWS_S3_BUCKET_NAME)
    throw new AppError(
      503,
      "Chưa cấu hình AWS S3. Vui lòng liên hệ quản trị viên.",
    );
  return config.AWS_S3_BUCKET_NAME;
}
export const presignUpload: RequestHandler = async (req, res) => {
  const { task } = await requireTask(req.params.id, req.userId);
  const Bucket = bucket();
  const { fileName, mimeType, fileSize } = req.body;
  const id = randomUUID();
  const objectKey = `projects/${task.projectId}/tasks/${task.id}/${id}`;
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket,
      Key: objectKey,
      ContentType: mimeType,
      ContentLength: fileSize,
      Metadata: { "attachment-id": id },
    }),
    {
      expiresIn: 300,
      signableHeaders: new Set(["content-type", "content-length"]),
      unhoistableHeaders: new Set(["x-amz-meta-attachment-id"]),
    },
  );
  // Bucket remains private; fileUrl is a stable API route that issues a signed GET after authorization.
  const fileUrl = `/api/v1/tasks/${task.id}/attachments/${id}/download`;
  await db.attachment.create({
    data: {
      id,
      taskId: task.id,
      fileName,
      mimeType,
      fileSize,
      objectKey,
      fileUrl,
      uploaderId: req.userId,
      uploadExpiresAt: new Date(Date.now() + 300000),
    },
  });
  res
    .status(201)
    .json({
      uploadUrl,
      fileUrl,
      attachmentId: id,
      headers: { "Content-Type": mimeType, "x-amz-meta-attachment-id": id },
      expiresIn: 300,
    });
};
export const confirmUpload: RequestHandler = async (req, res) => {
  await requireTask(req.params.id, req.userId);
  const attachment = await db.attachment.findFirst({
    where: {
      id: req.params.attachmentId,
      taskId: req.params.id,
      uploaderId: req.userId,
    },
  });
  if (!attachment) throw new AppError(404, "Không tìm thấy yêu cầu upload.");
  if (attachment.confirmedAt) {
    res.json(attachment);
    return;
  }
  if (attachment.uploadExpiresAt < new Date())
    throw new AppError(410, "Yêu cầu upload đã hết hạn. Vui lòng upload lại.");
  let head;
  try {
    head = await s3.send(
      new HeadObjectCommand({ Bucket: bucket(), Key: attachment.objectKey }),
    );
  } catch (error) {
    if (
      (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode === 404
    )
      throw new AppError(409, "Tệp chưa được tải lên S3.");
    throw error;
  }
  if (
    head.ContentLength !== attachment.fileSize ||
    head.ContentType !== attachment.mimeType ||
    head.Metadata?.["attachment-id"] !== attachment.id
  )
    throw new AppError(400, "Tệp trên S3 không khớp thông tin đã đăng ký.");
  res.json(
    await db.attachment.update({
      where: { id: attachment.id },
      data: { confirmedAt: new Date() },
    }),
  );
};
export const download: RequestHandler = async (req, res) => {
  await requireTask(req.params.id, req.userId);
  const attachment = await db.attachment.findFirst({
    where: {
      id: req.params.attachmentId,
      taskId: req.params.id,
      confirmedAt: { not: null },
    },
  });
  if (!attachment) throw new AppError(404, "Không tìm thấy tệp.");
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket(),
      Key: attachment.objectKey,
      ResponseContentDisposition: `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    }),
    { expiresIn: 60 },
  );
  res.json({ url, expiresIn: 60 });
};
