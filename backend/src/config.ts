import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/)
    .default("15m"),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  TRUST_PROXY: z.coerce.number().int().min(0).max(3).default(0),
  AWS_REGION: z.string().default("ap-southeast-1"),
  AWS_S3_BUCKET_NAME: z.string().optional(),
  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(104857600)
    .default(10485760),
});
export const config = schema.parse(process.env);
if (
  config.NODE_ENV === "production" &&
  config.JWT_SECRET.includes("replace_with")
) {
  throw new Error("Set a secure JWT_SECRET before starting production.");
}
