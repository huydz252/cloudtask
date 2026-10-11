# Kết quả kiểm tra và bàn giao

Ngày 12/10/2026, múi giờ Asia/Saigon. Mã nguồn tại `D:\nam4\Ki_1\ICloud\project\cloudtask`, đặc tả nguồn `D:\nam4\Ki_1\ICloud\project\promt_context.docx`. File đặc tả chỉ được đọc, không chỉnh sửa. SHA-256 tại bàn giao: `24317EDD004E1268267C9670AC07DBFDEC9FE5CAC8D577C4C38EC6664F63BC98`.

## Phạm vi đã thực hiện

| Yêu cầu                                    | Kết quả                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Node/Express/TypeScript, Prisma/PostgreSQL | Có mã nguồn theo module, migration SQL đã deploy trên PostgreSQL 15                |
| JWT, bcrypt, refresh token                 | Có access token 15 phút, cookie HTTP-only, rotation bằng transaction và hash token |
| Project và membership ADMIN/MEMBER         | Có danh sách, tạo, chi tiết, thêm thành viên, phân quyền theo dự án                |
| Task CRUD và bộ lọc                        | Có tạo/sửa/xóa có phân quyền, status/priority/assignee/search                      |
| Kanban kéo thả và table view               | Có; đã kiểm tra thao tác kéo thả trên trình duyệt                                  |
| Task detail, bình luận                     | Có drawer, form sửa, deadline, phân công, bình luận                                |
| S3 presigned upload                        | Có code PUT, progress, confirm HEAD, download private GET; kiểm thử bằng mock      |
| Helmet, CORS, rate limit, Zod              | Có middleware tập trung và format lỗi thống nhất                                   |
| Docker đa giai đoạn                        | Cả API và frontend đã build; ba container local hoạt động                          |
| Hướng dẫn AWS                              | Có RDS, IAM, S3 CORS, ECS/EC2, ALB, HTTPS và secret configuration                  |
| CI                                         | Có workflow GitHub Actions; chưa chạy trên GitHub vì chưa có repository remote     |

## Bằng chứng kiểm tra

- `npm run db:generate`: thành công với Prisma 6.19.
- `npm run typecheck`: cả backend và frontend qua.
- `npm run build`: TypeScript API và Vite frontend build thành công.
- `npm test`: 16 bài qua (9 bảo mật + 7 giao thức attachment); 9 bài PostgreSQL được skip khi không đặt TEST_DATABASE_URL.
- `scripts/test-integration.ps1`: 9 bài PostgreSQL qua với database riêng `cloudtask_test`. Tổng cộng 25 bài qua ở hai lượt kiểm tra; không gọi chúng là 25 bài qua trong lượt mặc định npm test.
- `npm audit`: 0 lỗ hổng được báo ở thời điểm kiểm tra; không thay thế audit định kỳ.
- Backend Docker image build bằng Node 22 Alpine và chỉ production dependencies; frontend image Nginx non-root build thành công.
- `/health` trực tiếp API và qua proxy frontend trả `status: ok`, `dbConnected: true`.
- PostgreSQL/API/frontend đều có trạng thái healthy.
- Trình duyệt: đăng nhập demo, dashboard, mở board, sửa trạng thái, gửi bình luận, đổi table view, tìm tiêu đề và kéo thả sang DONE thành công; giao diện đã xem ở viewport nhỏ và desktop 1280 px.
- Kiểm tra hồi quy: sau khi mở/đóng drawer rồi kéo thả, mở lại chi tiết ngay trả đúng DONE; sửa cơ chế cache để không hiển thị trạng thái cũ. Nút tạo ở cột Hoàn thành điền mặc định DONE. Tải lại trang tự khôi phục phiên đăng nhập qua refresh cookie.

Kiểm thử S3 giả lập kiểm tra header, metadata pending, định dạng/kích thước/tên file, quyền người upload, upload hết hạn, object chưa có, metadata sai, confirm idempotent và private download. Không có file nào được upload lên tài khoản AWS thật trong quá trình kiểm tra.

## Dùng ngay trên máy này

Ứng dụng chạy tại http://localhost:3000; API http://localhost:5000/api/v1. Có thể tự đăng ký tài khoản mới.

Tài khoản demo local:

```text
Email: demo@cloudtask.local
Mật khẩu: CloudTaskDemo!2026
```

Demo chỉ dùng cho localhost, không sử dụng tài khoản/mật khẩu này cho production. Seed có 3 task minh họa và một bình luận kiểm tra giao diện. Các tài khoản/bản ghi integration được lưu trong `cloudtask_test`, tách khỏi database ứng dụng. Không xóa task thật để thử DELETE; chỉ xác minh trái quyền bằng DB mock.

## Cấu hình được tạo

`.env` ở root chứa mật khẩu PostgreSQL và JWT secret ngẫu nhiên. `backend/.env` dành cho dev tương ứng. Hai file này giữ trên máy, được gitignore và không đưa vào ZIP mã nguồn. Nếu chuyển máy, dùng setup script để tạo secret mới. Không đưa secret vào frontend hoặc docs.

## Phần chưa xác minh

- Upload/confirm/download với S3 thật do chưa có bucket/IAM/credential được cung cấp.
- Chưa provision/deploy AWS, domain, TLS hoặc RDS thật; không phát sinh tài nguyên cloud tính phí.
- Chưa kiểm thử tải, malware scanning, pagination, restore disaster recovery hoặc GitHub CI thực tế.
- DELETE task thành công trên DB thật cố ý không thực hiện theo yêu cầu phải hỏi trước khi xóa.

Các giới hạn vận hành khác được ghi trong README và tài liệu AWS/OPERATIONS. Bộ mã nguồn có thể chạy local ngay và có nền tảng triển khai AWS; không tuyên bố đã được kiểm định production trên cloud.

## Dữ liệu được giữ lại

Tài liệu gốc, database ứng dụng, database kiểm thử và volume PostgreSQL được giữ nguyên trong môi trường bàn giao. Không chạy lệnh xóa/reset/dọn dữ liệu. Các thao tác quản lý dependency và rebuild container chỉ phục vụ xây dựng ứng dụng; không dọn file hay dữ liệu người dùng.
