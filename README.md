# CloudTask

Ứng dụng quản lý dự án và công việc theo yêu cầu trong `promt_context.docx`. Backend Express/TypeScript, Prisma/PostgreSQL, frontend React/Vite/Tailwind, TanStack Query, Axios và Lucide. Có Docker riêng cho API và giao diện, migration SQL, seed và kiểm thử.

## Chạy ngay bằng Docker

Mở http://localhost:3000, chọn **Đăng ký** để tạo tài khoản của bạn. API tại http://localhost:5000/api/v1. Kiểm tra sẵn sàng tại http://localhost:5000/health. Dữ liệu PostgreSQL lưu trong volume `cloudtask_pgdata`, tồn tại khi container dừng.

Khi chuyển mã nguồn sang máy khác, mở Docker Desktop trước, dùng Node 22 LTS hoặc mới hơn phù hợp dependency, rồi:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
docker compose up -d --build
```

Script setup chỉ tạo file cấu hình nếu chưa tồn tại, không ghi đè cấu hình có sẵn. Không chạy `docker compose down -v`, `prisma migrate reset`, `git clean` hoặc lệnh xóa volume nếu chưa được chủ dự án cho phép.

## Chạy để phát triển

```powershell
npm ci
npm run db:generate
docker compose up -d postgres
npm run db:migrate
npm run dev
```

Nếu backend/frontend container đang chiếm 5000/3000, dừng riêng chúng bằng `docker compose stop backend frontend` trước khi chạy dev. Lệnh stop không xóa dữ liệu. Vite proxy `/api` sang Express, access token giữ trong RAM, refresh token trong cookie HTTP-only. Không cần cấu hình URL API trong frontend.

Tạo dự án → thêm thành viên đã đăng ký → tạo và phân công công việc → kéo thả thẻ hoặc sửa trạng thái trong chi tiết → bình luận. Có tìm theo tiêu đề, lọc người phụ trách, lọc ưu tiên và chuyển Kanban/danh sách. Không có mật khẩu mặc định cho tài khoản cá nhân.

## Dữ liệu mẫu tùy chọn

```powershell
$env:SEED_PASSWORD = 'ChonMatKhauCuaBan123!'
npm run db:seed
$env:SEED_PASSWORD = $null
```

Mặc định email `demo@cloudtask.local`; có thể đặt `SEED_EMAIL`. Seed không đổi mật khẩu người dùng đã có và không sửa/xóa dự án DEMO hiện hữu.

## Lệnh kiểm tra

```powershell
npm run typecheck
npm run build
npm test
npm audit
```

`npm test` chạy kiểm thử bảo mật; bài integration chỉ chạy khi có `TEST_DATABASE_URL`. Để chạy PostgreSQL integration lần đầu:

```powershell
docker compose exec -T postgres psql -U postgres -d postgres -c 'CREATE DATABASE cloudtask_test'
powershell -ExecutionPolicy Bypass -File scripts/test-integration.ps1
```

Nếu database `cloudtask_test` đã có thì bỏ lệnh CREATE. Bài kiểm thử tạo email/mã dự án ngẫu nhiên, giữ lại bản ghi sau khi chạy và không xóa/reset DB. Kiểm thử xóa task chỉ dùng DB giả để xác minh yêu cầu trái quyền bị chặn.

## Quyền truy cập

| Hành động                               | ADMIN dự án | MEMBER dự án      | Người ngoài |
| --------------------------------------- | ----------- | ----------------- | ----------- |
| Xem dự án, công việc, bình luận, tệp    | Có          | Có                | Không       |
| Tạo và sửa công việc, bình luận, upload | Có          | Có                | Không       |
| Thêm thành viên, chọn vai trò           | Có          | Không             | Không       |
| Xóa task                                | Có          | Chỉ task mình tạo | Không       |

Người tạo dự án tự động là ADMIN. Người được giao phải thuộc dự án. Vai trò là theo từng dự án, không phải quyền quản trị toàn hệ thống. UI yêu cầu xác nhận riêng trước khi xóa task. API DELETE là thao tác xóa thật trong DB; chỉ gọi khi người dùng đã quyết định xóa. Không tự xóa object S3.

## Upload S3

Đặt bucket/region trong `.env` khi dùng Compose, hoặc `backend/.env` khi dùng dev. Trên máy cá nhân có thể dùng AWS credential chain; với Compose các biến AWS key tùy chọn đã được truyền. Trên AWS ưu tiên IAM role, không đưa key vào frontend.

Luồng: xin presigned PUT URL 5 phút → trình duyệt PUT file thẳng lên S3 với header được trả về → gọi endpoint confirm → API kiểm tra HEAD (size, MIME, metadata) → lưu `confirmedAt`. File chưa xác nhận không xuất hiện trong chi tiết. Download yêu cầu quyền dự án rồi trả presigned GET 60 giây; bucket không cần public. S3 chưa được cấu hình trả 503 rõ ràng.

Cho phép PNG/JPEG/WebP, PDF, TXT, CSV, ZIP, DOCX, XLSX; mặc định 10 MB. API có `MAX_UPLOAD_BYTES`; giới hạn UI hiện cũng 10 MB. Thay đổi cả hai nếu muốn mức khác. MIME/header không thay thế quét virus: triển khai thực tế nên bổ sung quét độc hại trước khi phát hành tệp. Cấu hình IAM và CORS trong `infra/` và hướng dẫn `docs/AWS.md`.

## Cấu trúc

```text
backend/
  prisma/              schema, migration, seed
  src/controllers/     auth, projects, tasks, attachments
  src/services/        quyền truy cập, session, S3
  src/middlewares/     JWT, validation, lỗi
  src/routes/          REST /api/v1
  tests/               kiểm thử bảo mật và PostgreSQL
frontend/
  src/components/      Auth, Board, TaskDrawer, UI
  nginx.conf           reverse proxy và SPA fallback
docs/                  API, AWS, thiết kế và vận hành
infra/                 IAM, S3 CORS, production Compose override
scripts/               setup và integration test trên Windows
docker-compose.yml     PostgreSQL + API + frontend
```

## Cấu hình và giới hạn

- Prisma 6.19 được cố định để bám sát schema `prisma-client-js` trong đặc tả; dependency phụ bị cảnh báo đã được override lên bản vá và kiểm tra tương thích bằng migration/build/test. `package-lock.json` được lưu để cài đặt lặp lại.
- Compose mặc định dùng `NODE_ENV=development` để refresh cookie hoạt động trên HTTP localhost; image vẫn chỉ cài production dependencies. Deploy HTTPS phải dùng production override để cookie Secure và kiểm tra secret.
- Access JWT mặc định 15 phút thay cho ví dụ 7 ngày của tài liệu, refresh session 7 ngày. Logout thu hồi refresh token; access token đã phát hành còn hiệu lực đến hết TTL. Muốn thu hồi tức thời cần thêm denylist/session validation.
- Không có sửa/xóa dự án, xóa thành viên, reset password hay thông báo email vì không nằm trong yêu cầu gốc.
- Chưa có pagination; GET task/comment trả dữ liệu của dự án/task. Với dự án rất lớn cần bổ sung phân trang/cursor và giới hạn số bản ghi.
- Chưa cung cấp tài nguyên AWS thực tế hay domain/HTTPS: cần account, region, VPC, bucket và domain của chủ dự án. Các file triển khai chuẩn bị sẵn, không tạo chi phí cloud trong quá trình xây dựng.
- Tệp S3 còn lại sau xóa task và yêu cầu upload hết hạn cần quy trình dọn dẹp được chủ dự án chấp thuận. Không cấu hình tự động xóa dữ liệu.

Xem `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/AWS.md` và `docs/OPERATIONS.md` để biết chi tiết.
