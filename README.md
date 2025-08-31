# POSM Survey Collection System

A Node.js web application for collecting and managing survey data with POSM (Point of Sale Management) integration.

## Features

- **Survey Management**: Create, view, and manage surveys with image uploads
- **Admin Dashboard**: Administrative interface for data management
- **File Upload**: Support for image uploads with AWS S3 integration
- **Data Import/Export**: CSV data import and management tools
- **Store Management**: Track and manage store information
- **Responsive UI**: Mobile-friendly interface for field data collection

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **File Storage**: AWS S3
- **Frontend**: HTML, CSS, JavaScript
- **Development**: Nodemon for hot reloading

## Project Structure

```
src/
├── config/           # Configuration management
├── controllers/      # Request handlers
├── middleware/       # Express middleware
├── models/          # Database schemas
├── routes/          # API routes
├── services/        # Business logic
└── utils/           # Helper functions

public/              # Static files (HTML, CSS, JS)
uploads/            # Temporary file uploads
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd posm-survey-collection
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file with the following variables:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/posm-surveys
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET=your_s3_bucket_name
AWS_REGION=your_aws_region
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Data Management
```bash
# Upload POSM data from CSV
npm run upload-posm

# Clear existing data and upload
npm run upload-posm-clear

# Upsert mode (update existing, insert new)
npm run upload-posm-upsert
```

## API Endpoints

### Survey Routes
- `GET /api/surveys` - Get all surveys
- `POST /api/surveys` - Create new survey
- `GET /api/surveys/:id` - Get specific survey
- `PUT /api/surveys/:id` - Update survey
- `DELETE /api/surveys/:id` - Delete survey

### Admin Routes
- `GET /api/admin/dashboard` - Admin dashboard data
- `GET /api/admin/stores` - Get all stores
- `POST /api/admin/stores` - Create store

### Upload Routes
- `POST /api/upload/image` - Upload image files
- `POST /api/upload/csv` - Upload CSV data

## Development

The application follows a modular architecture with:

- **Controllers**: Handle HTTP requests/responses
- **Services**: Contain business logic
- **Models**: Define data schemas
- **Routes**: Define API endpoints
- **Middleware**: Handle cross-cutting concerns

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.