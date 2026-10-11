import { S3Client } from "@aws-sdk/client-s3";
import { config } from "../config";
export const s3 = new S3Client({
  region: config.AWS_REGION,
  requestChecksumCalculation: "WHEN_REQUIRED",
});
export const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
