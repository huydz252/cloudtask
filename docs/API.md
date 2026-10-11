# CloudTask REST API

Base URL `/api/v1`. JSON request, Bearer access token cho các endpoint bảo vệ. Success trả resource hoặc mảng trực tiếp; lỗi `{ "success": false, "message": "...", "errors": {...} }`. Validation 400, session 401, trái quyền 403, không tìm thấy/không có membership 404, trùng dữ liệu 409, rate limit 429, S3 chưa cấu hình 503.

| Method | Path                                            | Body hoặc query                                                      | Kết quả                                                  |
| ------ | ----------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| GET    | `/health` hoặc `/api/v1/health`                 | Không                                                          | status, uptime, dbConnected; 200/503                     |
| POST   | `/auth/register`                                | email, password, fullName                                                   | 201 token, user; refresh cookie                          |
| POST   | `/auth/login`                                   | email, password                                                   | 200 token, user; refresh cookie                          |
| POST   | `/auth/refresh`                                 | `{}`; refresh cookie; Origin                                                     | token, user; xoay cookie                                 |
| POST   | `/auth/logout`                                  | `{}`; refresh cookie; Origin                                                     | 204; thu hồi refresh                                     |
| GET    | `/auth/me`                                      | Bearer                                                         | User không passwordHash                                  |
| GET    | `/projects`                                     | Bearer                                                         | Dự án đang tham gia; role và `_count`                    |
| POST   | `/projects`                                     | title, key, description?                                               | 201 dự án; người tạo ADMIN                               |
| GET    | `/projects/:id`                                 | UUID                                                           | Dự án, role, members kèm user                            |
| POST   | `/projects/:id/members`                         | email, role?                                                      | 201 member; chỉ ADMIN                                    |
| GET    | `/projects/:projectId/tasks`                    | status?, assigneeId?, priority?, search?                                                    | Task[] với assignee, creator, `_count`                   |
| POST   | `/projects/:projectId/tasks`                    | title, description?, status?, priority?, dueDate?, assigneeId? | 201 task                                                 |
| GET    | `/tasks/:id`                                    | UUID                                                           | Task kèm attachment đã confirm                           |
| PATCH  | `/tasks/:id`                                    | Một hoặc nhiều trường task                                     | Task sau cập nhật                                        |
| DELETE | `/tasks/:id`                                    | Bearer; user đã xác nhận                                       | 204; chỉ ADMIN hoặc creator                              |
| GET    | `/tasks/:id/comments`                           | UUID                                                           | Comment[] theo thời gian tăng dần                        |
| POST   | `/tasks/:id/comments`                           | content                                                        | 201 comment kèm user                                     |
| POST   | `/tasks/:id/attachments/presigned-url`          | fileName, mimeType, fileSize                                   | 201 uploadUrl, fileUrl, attachmentId, headers, expiresIn |
| POST   | `/tasks/:id/attachments/:attachmentId/confirm`  | `{}`                                                           | Attachment đã xác minh                                   |
| GET    | `/tasks/:id/attachments/:attachmentId/download` | Bearer                                                         | url presigned GET, expiresIn                             |

## Ví dụ

Đăng ký:

```json
{
  "email": "member@example.com",
  "password": "YourChosenPassword123!",
  "fullName": "Nguyễn Minh Anh"
}
```

Tạo project (key 2–10 ký tự, chỉ chữ số/chữ cái và bắt đầu bằng chữ):

```json
{
  "title": "Website nhóm",
  "key": "WEB",
  "description": "Hoàn thành sản phẩm học kỳ"
}
```

Tạo task:

```json
{
  "title": "Thiết kế trang đăng nhập",
  "status": "TODO",
  "priority": "HIGH",
  "dueDate": "2026-12-01T16:59:00Z",
  "assigneeId": null
}
```

`status` là TODO, IN_PROGRESS, DONE. `priority` là LOW, MEDIUM, HIGH, URGENT. `role` là ADMIN/MEMBER. Deadline cần ISO datetime có timezone, hoặc null. assigneeId là UUID thành viên hoặc null. PATCH không chấp nhận object rỗng hay trường ngoài schema; null xóa giá trị deadline/assignee. Title 1–200, description tối đa 20000, comment 1–10000 ký tự sau trim.

Upload: gửi fileSize là byte thực tế, MIME được hỗ trợ, tên không chứa slash/control char. PUT sang uploadUrl với chính xác headers API trả về, không kèm JWT CloudTask hay cookie. Trình duyệt tự cung cấp Content-Length. Sau PUT thành công mới confirm. Tải xuống gọi endpoint download với JWT rồi dùng URL nhận được. Không dùng upload URL để GET, không coi fileUrl là URL S3 public.

Để thử refresh/logout bằng cURL/Postman, lưu cookie và đặt `Origin: http://localhost:3000` (hoặc production origin). Login/register không cần Origin vì không xác thực bằng cookie. Lỗi đăng nhập không phân biệt email không tồn tại và mật khẩu sai.
