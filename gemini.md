## Project Overview

This is a Node.js web application for collecting and managing survey data with POSM (Point of Sale Management) integration. It uses an Express.js backend, a MongoDB database, and AWS S3 for file storage. The frontend is built with HTML, CSS, and JavaScript.

The application features survey management, an admin dashboard, file uploads, data import/export, and store management. It has a modular architecture with a clear separation of concerns between controllers, services, models, and routes.

## Building and Running

### Prerequisites

- Node.js
- MongoDB
- AWS S3 Bucket

### Installation

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Set up environment variables by creating a `.env` file in the root of the project with the following content:
    ```
    PORT=3000
    MONGODB_URI=mongodb://localhost:27017/posm-surveys
    AWS_ACCESS_KEY_ID=your_aws_access_key
    AWS_SECRET_ACCESS_KEY=your_aws_secret_key
    AWS_S3_BUCKET=your_s3_bucket_name
    AWS_REGION=your_aws_region
    ```

### Running the Application

- **Development:**
  ```bash
  npm run dev
  ```
- **Production:**
  ```bash
  npm start
  ```

### Data Management

- Upload POSM data from CSV:
  ```bash
  npm run upload-posm
  ```
- Clear existing data and upload:
  ```bash
  npm run upload-posm-clear
  ```
- Upsert mode (update existing, insert new):
  ```bash
  npm run upload-posm-upsert
  ```

## Development Conventions

### Linting and Formatting

- **Lint:**
  ```bash
  npm run lint
  ```
- **Lint and fix:**
  ```bash
  npm run lint:fix
  ```
- **Format:**
  ```bash
  npm run format
  ```
- **Check formatting:**
  ```bash
  npm run format:check
  ```

### API Endpoints

- **Survey Routes:**
  - `GET /api/surveys`: Get all surveys
  - `POST /api/surveys`: Create new survey
  - `GET /api/surveys/:id`: Get specific survey
  - `PUT /api/surveys/:id`: Update survey
  - `DELETE /api/surveys/:id`: Delete survey
- **Admin Routes:**
  - `GET /api/admin/dashboard`: Admin dashboard data
  - `GET /api/admin/stores`: Get all stores
  - `POST /api/admin/stores`: Create store
- **Upload Routes:**
  - `POST /api/upload/image`: Upload image files
  - `POST /api/upload/csv`: Upload CSV data
- **Authentication Routes:**
  - `POST /api/auth/login`: User login
  - `POST /api/auth/admin-login`: Admin login
  - `POST /api/auth/logout`: User logout
  - `GET /api/auth/profile`: Get user profile
  - `POST /api/auth/change-password`: Change password
- **User Management Routes:**
  - `GET /api/users`: Get all users
  - `POST /api/users`: Create a new user
  - `GET /api/users/:id`: Get a user by ID
  - `PUT /api/users/:id`: Update a user
  - `DELETE /api/users/:id`: Delete a user
- **Store Management Routes:**
  - `GET /api/stores`: Get all stores
  - `POST /api/stores`: Create a new store
  - `GET /api/stores/:id`: Get a store by ID
  - `PUT /api/stores/:id`: Update a store
  - `DELETE /api/stores/:id`: Delete a store
- **Display Management Routes:**
  - `GET /api/displays`: Get all displays
  - `POST /api/displays`: Create a new display
  - `GET /api/displays/:id`: Get a display by ID
  - `PUT /api/displays/:id`: Update a display
  - `DELETE /api/displays/:id`: Delete a display
- **Progress Tracking Routes:**
  - `GET /api/progress`: Get progress data
- **Survey History Routes:**
  - `GET /api/survey-history`: Get survey history
- **Data Upload Routes:**
  - `POST /api/data-upload`: Upload data
