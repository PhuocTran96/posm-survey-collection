# POSM Survey System

Hệ thống khảo sát POSM (Point of Sale Materials) cho phép người dùng báo cáo các POSM thiếu hoặc cần thay thế tại các shop.

## Tính năng

### Khảo sát (Survey Flow)
1. **Chọn Leader**: Người dùng chọn leader của mình từ danh sách
2. **Chọn Shop**: Hiển thị danh sách shop thuộc leader đã chọn
3. **Chọn POSM**: 
   - Hiển thị các model với danh sách POSM tương ứng
   - Mỗi model có tùy chọn "Tất cả" để chọn tất cả POSM của model đó
   - Khi chọn "Tất cả", các tùy chọn POSM riêng lẻ sẽ bị ẩn
   - Có thể chọn từng POSM riêng lẻ
4. **Gửi khảo sát**: Lưu kết quả vào MongoDB

### Quản trị (Admin)
- Xem tất cả kết quả khảo sát
- Lọc theo Leader, Shop, ngày tháng
- Thống kê tổng quan
- Xuất dữ liệu ra file CSV

## Cài đặt

### Yêu cầu hệ thống
- Node.js (v14 trở lên)
- MongoDB
- NPM hoặc Yarn

### Bước 1: Cài đặt dependencies
```bash
npm install
```

### Bước 2: Chuẩn bị MongoDB
Đảm bảo MongoDB đang chạy trên máy local:
```bash
# Khởi động MongoDB (Windows)
net start MongoDB

# Hoặc sử dụng MongoDB Compass để kết nối
```

### Bước 3: Chuẩn bị dữ liệu
Đảm bảo file `data.csv` có trong thư mục gốc với cấu trúc:
```csv
shop name,model,leader,posm,posm name
```

### Bước 4: Chạy ứng dụng
```bash
# Chạy server
npm start

# Hoặc chạy với nodemon (development)
npm run dev
```

Server sẽ chạy tại: `http://localhost:3000`

## Sử dụng

### Khảo sát POSM
1. Truy cập: `http://localhost:3000`
2. Làm theo các bước trong giao diện
3. Gửi khảo sát khi hoàn thành

### Quản trị
1. Truy cập: `http://localhost:3000/admin.html`
2. Xem kết quả khảo sát
3. Sử dụng bộ lọc để tìm kiếm
4. Xuất dữ liệu nếu cần

## Cấu trúc dự án

```
survey-posm/
├── public/                 # Frontend files
│   ├── index.html         # Trang khảo sát chính
│   ├── admin.html         # Trang quản trị
│   ├── styles.css         # CSS styles
│   ├── script.js          # JavaScript cho khảo sát
│   └── admin.js           # JavaScript cho admin
├── server.js              # Express server
├── package.json           # Dependencies
├── data.csv              # Dữ liệu POSM
└── README.md             # Hướng dẫn này
```

## API Endpoints

### GET `/api/leaders`
Lấy danh sách tất cả leaders

### GET `/api/shops/:leader`
Lấy danh sách shops theo leader

### GET `/api/models/:leader/:shopName`
Lấy danh sách models và POSM theo leader và shop

### POST `/api/submit`
Gửi kết quả khảo sát
```json
{
  "leader": "Tên leader",
  "shopName": "Tên shop",
  "responses": [
    {
      "model": "Model name",
      "posmSelections": [
        {
          "posmCode": "POSM code",
          "posmName": "POSM name",
          "selected": true
        }
      ],
      "allSelected": false
    }
  ]
}
```

### GET `/api/responses`
Lấy tất cả kết quả khảo sát (cho admin)

## Database Schema

### SurveyResponse Collection
```javascript
{
  leader: String,
  shopName: String,
  responses: [{
    model: String,
    posmSelections: [{
      posmCode: String,
      posmName: String,
      selected: Boolean
    }],
    allSelected: Boolean
  }],
  submittedAt: Date
}
```

## Tính năng nổi bật

1. **Responsive Design**: Hoạt động tốt trên mobile và desktop
2. **Real-time Validation**: Kiểm tra dữ liệu ngay khi nhập
3. **Progressive Enhancement**: Từng bước một, không cho phép bỏ qua
4. **Smart Selection**: Tùy chọn "Tất cả" thông minh
5. **Data Export**: Xuất CSV cho Excel
6. **Admin Dashboard**: Thống kê và quản lý dữ liệu

## Troubleshooting

### Lỗi kết nối MongoDB
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Giải pháp**: Đảm bảo MongoDB đang chạy:
```bash
# Windows
net start MongoDB

# macOS/Linux
sudo systemctl start mongod
```

### Lỗi không tìm thấy data.csv
```
Error: ENOENT: no such file or directory, open 'data.csv'
```
**Giải pháp**: Đảm bảo file `data.csv` có trong thư mục gốc của project

### Port 3000 đã được sử dụng
```
Error: listen EADDRINUSE :::3000
```
**Giải pháp**: Thay đổi port trong `server.js` hoặc dừng process đang sử dụng port 3000

## Phát triển thêm

### Thêm tính năng mới
1. Thêm API endpoint trong `server.js`
2. Cập nhật frontend trong `public/`
3. Test và deploy

### Tùy chỉnh giao diện
- Chỉnh sửa `public/styles.css` cho styling
- Cập nhật `public/index.html` cho layout
- Modify `public/script.js` cho logic

## License

MIT License