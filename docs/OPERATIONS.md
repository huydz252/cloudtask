# Vận hành và xử lý lỗi

## Kiểm tra trạng thái

```powershell
docker compose ps
docker compose logs --tail 100 backend
docker compose logs --tail 100 frontend
Invoke-RestMethod http://localhost:5000/health
```

API trả `status=ok`, `dbConnected=true` khi DB sẵn sàng. Khi DATABASE_URL sai/DB dừng, health 503. PostgreSQL và API startup healthcheck giúp frontend không khởi động trước API.

## Dừng và khởi động lại

```powershell
docker compose stop
docker compose start
```

Dừng container không xóa volume. Không dùng lệnh xóa volume, reset DB hay dọn Docker toàn máy khi chưa được người dùng chấp thuận. Khi thay schema, tạo migration mới, kiểm tra trên DB riêng rồi deploy; không sửa migration đã chạy.

## Sao lưu

Ví dụ sao lưu DB vào file mới (không ghi đè bản backup cũ):

```powershell
$taskBackupName = 'cloudtask-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.sql'
docker compose exec -T postgres pg_dump -U postgres cloudtask_db | Out-File -Encoding utf8 $taskBackupName
```

Kiểm tra file và thử restore vào DB mới. Restore đè DB có thể mất dữ liệu, cần đồng ý trước khi thực hiện. Backup PostgreSQL không gồm object S3; dùng S3 versioning/backup theo chính sách chủ dự án. Database backup chứa email/password hashes, phải bảo vệ như dữ liệu nhạy cảm.

## Lỗi thường gặp

| Triệu chứng                 | Kiểm tra                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| Docker pipe unavailable     | Mở Docker Desktop, đợi Linux engine Ready                                                           |
| Port 3000/5000/5432 đã dùng | Dừng đúng process/container của CloudTask hoặc đổi cả port/origin/proxy; không tự tắt ứng dụng khác |
| 401 sau tải lại             | Refresh cookie có được lưu không; origin/HTTPS/NODE_ENV đúng không                                  |
| Refresh 403                 | Header Origin khác CORS_ORIGIN hoặc gọi CLI thiếu Origin                                            |
| S3 503                      | AWS_S3_BUCKET_NAME chưa được đặt                                                                    |
| S3 PUT 403                  | Credential/role quyền PutObject, region, hết hạn và signed headers                                  |
| PUT bị CORS                 | AllowedOrigins, AllowedHeaders và AllowedMethods của bucket                                         |
| Confirm 409                 | PUT chưa thành công hoặc HEAD không thấy object                                                     |
| Confirm 400                 | Size/MIME/attachment-id metadata không khớp                                                         |
| 409 khi tạo project         | Key đã tồn tại; chọn mã khác                                                                        |
| Thêm thành viên 404         | Email chưa đăng ký tài khoản hoặc không có quyền dự án                                              |

## Các tác vụ không tự động thực hiện

Xóa tệp, xóa DB/test data/volume, dọn refresh token cũ, xóa object mồ côi trên S3, reset dữ liệu và triển khai tài nguyên tính phí phải theo quyết định chủ dự án. Giao diện DELETE task có màn xác nhận; việc tạo mã nguồn endpoint này không đồng nghĩa đã xóa task của người dùng.
