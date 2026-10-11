import { z } from "zod";
export const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((s) => s.toLowerCase());
export const password = z
  .string()
  .min(8)
  .refine(
    (s) => Buffer.byteLength(s, "utf8") <= 72,
    "Mật khẩu tối đa 72 byte.",
  );
export const registerSchema = z
  .object({ email, password, fullName: z.string().trim().min(2).max(100) })
  .strict();
export const loginSchema = z
  .object({ email, password: z.string().min(1).max(200) })
  .strict();
export const projectSchema = z
  .object({
    title: z.string().trim().min(2).max(150),
    description: z.string().max(5000).optional(),
    key: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z][A-Z0-9]{1,9}$/),
  })
  .strict();
export const memberSchema = z
  .object({ email, role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER") })
  .strict();
export const taskSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(20000).nullable().optional(),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).default("TODO"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
    dueDate: z.string().datetime({ offset: true }).nullable().optional(),
    assigneeId: z.string().uuid().nullable().optional(),
  })
  .strict();
export const taskPatchSchema = taskSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Cần ít nhất một trường.");
export const taskQuerySchema = z
  .object({
    status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    assigneeId: z.string().uuid().optional(),
    search: z.string().trim().max(200).optional(),
  })
  .strict();
export const commentSchema = z
  .object({ content: z.string().trim().min(1).max(10000) })
  .strict();
export const idParams = (key: string) => z.object({ [key]: z.string().uuid() });
