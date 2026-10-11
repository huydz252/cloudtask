export type Status = "TODO" | "IN_PROGRESS" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
}
export interface Member {
  id: string;
  role: "ADMIN" | "MEMBER";
  user: User;
}
export interface Project {
  id: string;
  title: string;
  description?: string;
  key: string;
  role: "ADMIN" | "MEMBER";
  members?: Member[];
  _count?: { tasks: number; members: number };
}
export interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  mimeType: string;
}
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  projectId: string;
  creatorId: string;
  assigneeId: string | null;
  assignee: User | null;
  creator: User;
  _count: { comments: number; attachments: number };
  attachments?: Attachment[];
}
export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: User;
}
export const statuses: Record<Status, string> = {
  TODO: "Cần làm",
  IN_PROGRESS: "Đang thực hiện",
  DONE: "Hoàn thành",
};
export const priorities: Record<Priority, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};
