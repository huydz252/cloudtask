# Upload và xem ảnh trong task

## Sử dụng

Mở task đã tạo, tới Ảnh và tệp đính kèm, chọn hoặc kéo thả JPG, PNG hoặc WebP. Mỗi ảnh tối đa 10 MB, mỗi lần chọn tối đa 10 tệp. Các tệp được tải lần lượt, có tiến độ và báo kết quả riêng. Ảnh xác nhận thành công xuất hiện trong task; nhấn ảnh để phóng to/thu nhỏ hoặc bấm biểu tượng tải xuống. Định dạng tài liệu trước đây vẫn được hỗ trợ.

Khi PUT đã thành công nhưng API confirm lỗi tạm thời, nút Thử lại chỉ gửi lại confirm, tránh tải thêm một bản trùng. Nếu yêu cầu đã hết hạn, lần thử tiếp theo xin URL mới. Không tự xóa object hoặc metadata của lần thử cũ. Trong lúc upload, drawer giữ mở để người dùng theo dõi kết quả.

## Quyền và URL

Bucket vẫn private. API yêu cầu quyền thành viên dự án cho upload, confirm, preview và download. Route mới `GET /api/v1/tasks/:id/attachments/:attachmentId/preview` chỉ chấp nhận JPEG/PNG/WebP đã confirm và trả URL GET ký tạm 300 giây, Content-Disposition inline, Content-Type đúng định dạng đã đăng ký. API không cache URL; frontend có nút tải lại khi ảnh lỗi/hết hạn. Không đưa AWS credential vào bundle frontend.

## Cấu hình EC2 dùng PM2

Backend chạy với cwd `/home/ubuntu/cloudtask/backend`, nên đọc `/home/ubuntu/cloudtask/backend/.env`. Cấu hình trong `.env` gốc dùng cho Docker Compose không tự chuyển sang tiến trình PM2.

Các biến cần có ở backend: `AWS_S3_BUCKET_NAME=cloudtask-storage`, `AWS_REGION=ap-southeast-1` và credential hợp lệ qua IAM instance role hoặc AWS credential chain. Với access key, đặt `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (và `AWS_SESSION_TOKEN` nếu dùng credential tạm) trong cấu hình máy chủ, không commit Git. Sau khi đổi `.env`, restart `cloudtask-api` từ PM2. Nếu cấu hình env trực tiếp trong PM2 cũng được đổi, dùng `--update-env` theo cách quản lý môi trường hiện tại.

Lỗi đã xác định ngày 04/11/2026: backend EC2 và backend local thiếu bucket/credential trong `.env` backend, dù bucket đã tồn tại. Cấu hình đã được bổ sung, bản cũ giữ ở thư mục backup ngoài repository trên EC2. Không đổi DATABASE_URL/JWT hoặc tạo lại bucket.

## CORS và hiển thị ảnh

Bucket cần cho phép origin FE, PUT/GET/HEAD và header `Content-Type`, `x-amz-meta-attachment-id` cho presigned upload. Khi dùng Nginx Docker, CSP đã thêm ảnh từ `blob:` (xem trước local) và S3 HTTPS. Khi host bằng Render Static Site, nếu có CSP tự cấu hình thì cũng cần cho phép những nguồn ảnh này. Không cần bật public read bucket.

## Kiểm tra triển khai

Triển khai cả BE và FE để có route preview và giao diện ảnh mới. Không cần migration hoặc dependency mới. Nên kiểm tra upload trên đúng domain FE và kiểm tra sau khi đóng/mở lại task. Các bài unit S3 dùng mock, không xóa dữ liệu. Kiểm thử trên bucket thật dùng object mới duy nhất và giữ lại; không dọn object tự động.

Tham khảo [AWS presigned upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html), [S3 CORS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html) và [GetObject response headers](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html).
