# Project Overview

This is a Node.js web application for collecting and managing survey data with POSM (Point of Sale Management) integration. It features survey management, an admin dashboard, file uploads to AWS S3, and data import/export capabilities.

**Key Technologies:**

*   **Backend:** Node.js, Express.js
*   **Database:** MongoDB with Mongoose
*   **Authentication:** JWT (JSON Web Tokens)
*   **File Storage:** AWS S3
*   **Frontend:** HTML, CSS, JavaScript

**Architecture:**

The application follows a standard Model-View-Controller (MVC) architecture:

*   **`src/models`:** Defines the database schemas for users, surveys, stores, etc.
*   **`src/controllers`:** Handles incoming API requests, interacts with models, and sends responses.
*   **`src/routes`:** Defines the API endpoints and maps them to the appropriate controllers.
*   **`public`:** Contains the static frontend files (HTML, CSS, JavaScript).
*   **`server.js`:** The main entry point of the application.

# Building and Running

**Installation:**

```bash
npm install
```

**Environment Variables:**

Create a `.env` file in the root directory with the following variables:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/posm-surveys
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET=your_s3_bucket_name
AWS_REGION=your_aws_region
JWT_ACCESS_SECRET=your_jwt_secret
```

**Running the Application:**

*   **Development:** `npm run dev` (starts the server with nodemon for automatic restarts)
*   **Production:** `npm start`

**Data Management Scripts:**

The `package.json` file includes several scripts for managing data:

*   `npm run upload-posm`: Upload POSM data from a CSV file.
*   `npm run upload-posm-clear`: Clear existing data and then upload.
*   `npm run upload-posm-upsert`: Update existing data and insert new data.
*   `npm run import-users`: Import users from a file.
*   `npm run create-super-admin`: Create a super admin user.

# Development Conventions

*   **Linting:** The project uses ESLint for code quality. Run `npm run lint` to check for issues and `npm run lint:fix` to automatically fix them.
*   **Formatting:** Prettier is used for code formatting. Run `npm run format` to format the code.
*   **Authentication:** API routes are protected using JWT. The `src/middleware/routeAuth.js` file contains the authentication middleware.
*   **Error Handling:** The `src/middleware/errorHandler.js` file contains middleware for handling errors.
*   **Database:** The application uses Mongoose to interact with a MongoDB database. Models are defined in the `src/models` directory.
*   **File Uploads:** File uploads are handled using `multer` and stored in AWS S3. The S3 helper functions are in `src/utils/s3Helper.js`.
