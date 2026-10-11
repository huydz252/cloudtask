# Triển khai CloudTask lên AWS

## Phương án kiến trúc

Đồ án nhỏ: EC2 Linux chạy hai container ứng dụng sau reverse proxy HTTPS, PostgreSQL đặt tại RDS; S3 private bucket lưu tệp. Phương án mở rộng: ALB → ECS Fargate frontend/API → RDS PostgreSQL trong private subnet. Có thể cho ALB route tất cả request về frontend Nginx để giữ API cùng origin; Nginx chuyển `/api` đến API qua ECS Service Connect hoặc DNS nội bộ `backend`. Nginx hiện dùng hostname `backend`, phải cấu hình service discovery đúng tên hoặc sửa upstream.

## RDS

Tạo PostgreSQL 15+, subnet group private, security group chỉ nhận 5432 từ backend security group. Database `cloudtask_db`, bật backup tự động, TLS và alarm kết nối/dung lượng. Đặt DATABASE_URL với URL-encoded password và `sslmode=require` cùng cấu hình certificate verification phù hợp driver/môi trường; kiểm tra thực tế với CA RDS. Không dùng port PostgreSQL public.

Migrate là job riêng trước rollout trong ECS: `npm run db:migrate -w backend`. Image local vẫn migrate khi khởi động để tiện đồ án; khi scale production nhiều replica nên chạy migration một lần trong release job và override CMD thành `node backend/dist/index.js`. Prisma migrations đã được version hóa; không dùng db push/reset ở production.

## S3 và IAM

Bucket trong cùng region, Block Public Access bật, bật encryption và versioning theo yêu cầu lưu trữ. Không dùng public-read ACL. Thay tên bucket trong `infra/s3-iam-policy.json`, gắn policy vào ECS task role hoặc EC2 instance role. `s3:GetObject` phục vụ cả HEAD kiểm tra và signed download. Nếu dùng SSE-KMS cần thêm quyền KMS tương ứng vào role và key policy.

Thay origin mẫu trong `infra/s3-cors.json` bằng domain thật; giữ localhost nếu cần thử local. AWS CLI mẫu (chỉ thực hiện sau khi chọn bucket đúng):

```bash
aws s3api put-bucket-cors --bucket YOUR_BUCKET --cors-configuration '{"CORSRules": [...]}'
```

File CORS lưu mảng như giao diện S3 Console; CLI cần bọc mảng vào `{ "CORSRules": [...] }`. Presigned URL là credential tạm thời; không ghi toàn bộ URL vào log. Upload URL có hạn 300 giây, download 60 giây. Không có policy tự xóa object trong dự án này.

## Image và ECS

Build từ root workspace, đẩy vào ECR của bạn, dùng tag hoặc digest cố định:

```bash
docker build -f backend/Dockerfile -t cloudtask-api .
docker build -f frontend/Dockerfile -t cloudtask-web .
```

Đặt DATABASE_URL/JWT_SECRET qua Secrets Manager/SSM; region/bucket/origin qua env. Task role là quyền S3; execution role là quyền pull ECR/logs/secrets. Backend port 5000, frontend 8080, image chạy non-root. Bật CloudWatch Logs và retention. Health API `/health`, success code 200, startup grace đủ thời gian migration/kết nối DB. Health frontend `/nginx-health` chỉ kiểm tra Nginx; readiness DB theo API target.

ACM certificate và ALB HTTPS 443; redirect 80→443; `NODE_ENV=production`, `CORS_ORIGIN=https://your-domain`, `TRUST_PROXY` bằng đúng số proxy tin cậy. Ví dụ ALB→Nginx→API là 2. Giới hạn security group backend chỉ nhận request từ frontend/service để client không giả mạo X-Forwarded-For. Xem Express trust proxy docs khi topology khác.

## EC2 với RDS

Không chạy PostgreSQL service của local Compose cho production RDS. Tạo compose riêng hai service bằng cùng Dockerfile, env DATABASE_URL RDS và task/instance role. File `infra/compose.production.yml` chỉ là override cookie/origin cho cấu hình local sau proxy, không tự chuyển DB sang RDS. Không công bố `.env`/ports 5000 hoặc 5432 ra Internet.

## Checklist trước khi sử dụng thật

HTTPS và origin chính xác; IAM least privilege; secret ngẫu nhiên; backup và restore thử; healthchecks; log không credential; S3 upload/confirm/download với bucket thật; giới hạn file và quét malware; tải đồng thời; giám sát 5xx/latency; cập nhật dependency định kỳ. Tài nguyên AWS chưa được tạo do chưa có thông tin account/domain/bucket của người dùng.

## Tài liệu tham khảo chính thức

- [AWS S3 presigned upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [AWS S3 presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
- [Prisma deployment OS v6](https://www.prisma.io/docs/orm/v6/prisma-client/deployment/deploy-to-a-different-os)
- [Prisma migrate CLI](https://docs.prisma.io/docs/cli/migrate)
