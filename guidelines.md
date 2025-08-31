# AI and New Developer Guidelines

Welcome to the POSM Survey Collection System! This document provides a comprehensive guide for developers and AI agents to understand, run, and contribute to the project.

## 1. Project Overview

This is a full-stack web application designed for collecting and managing Point of Sale Material (POSM) survey data. It features separate interfaces for standard users (who conduct surveys) and administrators (who manage data, users, and view results).

The core workflow involves users selecting a store they are assigned to, choosing one or more product models, indicating which POSM items are missing or need replacement, and uploading a photo as evidence. Administrators can then view, filter, and export this collected data.

### 1.1. Key Features

-   **User Authentication & Authorization:** JWT-based authentication with role-based access control (RBAC)
-   **Hierarchical User Management:** Support for organizational hierarchy (TDL → TDS → PRT/User)
-   **Store Assignment System:** Users are assigned specific stores they can survey
-   **Multi-step Survey Process:** Intuitive two-step survey flow with dynamic model selection
-   **Image Upload & Processing:** Automatic image compression and AWS S3 storage integration
-   **Real-time Data Validation:** Comprehensive frontend and backend validation
-   **Admin Dashboard:** Complete CRUD operations for users, stores, and display data
-   **Data Export:** Excel export functionality for survey results
-   **Bulk Data Import:** CSV import for stores and POSM data
-   **Responsive Design:** Mobile-first design optimized for field survey work

### 1.2. Technology Stack

-   **Backend:** Node.js with Express.js for the web server and REST API
-   **Database:** MongoDB with Mongoose ODM for data modeling and validation
-   **Authentication:** JWT with refresh token strategy, bcrypt for password hashing (12 salt rounds)
-   **File Storage:** AWS S3 for cloud storage with automatic image compression via Sharp
-   **Image Processing:** Sharp for automatic resizing (max 1024px width) and JPEG compression (80% quality)
-   **Frontend:** Vanilla HTML5, CSS3, and ES6+ JavaScript (no frameworks for simplicity)
-   **CSS Architecture:** Custom CSS with CSS variables, responsive design, mobile-first approach
-   **Development Tools:** 
    -   Nodemon for development server auto-restart
    -   ESLint for code linting and quality checks
    -   Prettier for consistent code formatting
    -   Puppeteer for testing automation
-   **Production:** Environment-based configuration with proper error handling and logging

## 2. Detailed Project Structure

```
.
├── .claude/                    # Claude Code IDE configuration
│   └── settings.local.json     # Local IDE settings
├── .vscode/                    # VS Code configuration
│   └── settings.json          # VS Code workspace settings
├── node_modules/               # NPM dependencies (ignored in git)
├── uploads/                    # Local temporary upload directory
│   ├── csv/                   # CSV file uploads
│   └── temp/                  # Temporary file processing
│
├── public/                     # All static frontend files (HTML, CSS, JS)
│   ├── index.html              # Main survey page for standard users
│   ├── script.js               # Core SurveyApp class logic for index.html
│   ├── login.html              # Login page for standard users
│   │
│   ├── admin.html              # Admin landing page (redirects to survey-results)
│   ├── admin-login.html        # Login page for admins
│   ├── survey-results.html     # Admin dashboard to view survey results
│   ├── admin.js                # AdminApp class logic for survey-results.html
│   ├── admin-dashboard.html    # Alternative admin dashboard
│   ├── admin-dashboard.js      # Logic for admin-dashboard.html
│   │
│   ├── user-management.html    # Admin page for CRUD operations on users
│   ├── user-management.js      # UserManagement class for user CRUD
│   ├── store-management.html   # Admin page for CRUD operations on stores
│   ├── store-management.js     # StoreManagement class for store CRUD
│   ├── display-management.html # Admin page for CRUD operations on displays
│   ├── display-management.js   # DisplayManagement class for display CRUD
│   ├── display-management-standalone.html # Standalone display management
│   │
│   ├── data-upload.html        # Admin page for bulk CSV uploads
│   ├── data-upload.js          # DataUpload class for bulk import functionality
│   │
│   ├── survey-history.html     # Page for users to see their submission history
│   ├── survey-history.js       # SurveyHistory class for personal history
│   ├── pagination-component.js # Reusable pagination component
│   │
│   ├── styles.css              # General styles for login and history pages
│   ├── styles-admin.css        # Styles specific to admin pages
│   └── styles-survey.css       # Styles specific to the survey form page
│
├── src/                        # All backend source code
│   ├── config/
│   │   ├── database.js         # MongoDB connection with event handling
│   │   └── index.js            # Environment configuration and validation
│   ├── controllers/            # Business logic controllers
│   │   ├── authController.js   # Authentication (login, verify, logout)
│   │   ├── surveyController.js # Survey submission and retrieval
│   │   ├── surveyHistoryController.js # Personal survey history
│   │   ├── userController.js   # User CRUD operations
│   │   ├── storeController.js  # Store CRUD operations
│   │   ├── displayController.js # Display management
│   │   ├── uploadController.js # File upload handling
│   │   ├── dataUploadController.js # Bulk CSV data imports
│   │   └── adminController.js  # Admin-specific operations
│   ├── middleware/
│   │   ├── auth.js             # JWT generation, verification, RBAC
│   │   ├── errorHandler.js     # Global error handling with consistent responses
│   │   └── routeAuth.js        # HTML page protection middleware
│   ├── models/                 # Mongoose data models
│   │   ├── index.js           # Model exports aggregation
│   │   ├── User.js            # User schema with authentication and hierarchy
│   │   ├── Store.js           # Store schema with geographic data
│   │   ├── Display.js         # Display tracking schema
│   │   ├── ModelPosm.js       # Model-POSM relationship schema
│   │   └── SurveyResponse.js  # Survey response schema with nested data
│   ├── routes/                # Express route definitions
│   │   ├── index.js           # Main route aggregator
│   │   ├── authRoutes.js      # Authentication endpoints (/api/auth/*)
│   │   ├── surveyRoutes.js    # Survey endpoints (/api/surveys, /api/submit)
│   │   ├── surveyHistoryRoutes.js # History endpoints (/api/survey-history/*)
│   │   ├── userRoutes.js      # User management (/api/users/*)
│   │   ├── storeRoutes.js     # Store management (/api/stores/*)
│   │   ├── displayRoutes.js   # Display management (/api/displays/*)
│   │   ├── uploadRoutes.js    # File upload (/api/upload/*)
│   │   ├── dataUploadRoutes.js # Bulk import (/api/data-upload/*)
│   │   └── adminRoutes.js     # Admin operations (/api/admin/*)
│   ├── services/
│   │   └── dataInitializer.js # Database initialization and seeding
│   └── utils/
│       └── s3Helper.js        # AWS S3 integration and image processing
│
├── uploads/                    # Local directory for temporary file uploads
├── .env                        # (Must be created) Environment variables
├── .eslintrc.json             # ESLint configuration
├── .prettierrc.json           # Prettier formatting configuration
├── .gitignore                 # Git ignore patterns
├── server.js                  # Main Express application entry point
├── package.json               # NPM dependencies and scripts
├── package-lock.json          # NPM lockfile for dependencies
├── import-users.js            # Script for bulk user import
├── upload-posm-data.js        # Script for POSM data import
└── guidelines.md              # This comprehensive development guide
```

## 3. Getting Started

### 3.1. Prerequisites

-   Node.js (v16 or higher recommended)
-   MongoDB (local instance or a connection string to a cloud provider like MongoDB Atlas)
-   AWS S3 Bucket and credentials

### 3.2. Installation and Setup

1.  **Clone the repository.**
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up Environment Variables:**
    Create a `.env` file in the project root. This file is critical for configuring the application.

    ```env
    # Server Configuration
    NODE_ENV=development
    PORT=3000

    # Database Configuration
    MONGODB_URI=mongodb://localhost:27017/posm-survey
    # For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/posm-survey

    # JWT Authentication Secrets (CHANGE IN PRODUCTION)
    JWT_ACCESS_SECRET=your_super_secret_access_key_for_jwt_change_this_in_production
    JWT_REFRESH_SECRET=your_super_secret_refresh_key_for_jwt_change_this_in_production

    # AWS S3 Configuration for File Uploads
    AWS_ACCESS_KEY_ID=your_aws_access_key_id
    AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
    AWS_REGION=ap-southeast-1
    AWS_S3_BUCKET=your-posm-survey-bucket
    ```

4.  **Database Setup:**
    - Ensure MongoDB is running locally OR configure MongoDB Atlas connection
    - The application will automatically create required collections and indexes
    - Run data initialization:
        ```bash
        npm run create-super-admin  # Create initial admin user
        ```

5.  **AWS S3 Setup:**
    - Create an S3 bucket for image storage
    - Configure bucket permissions for public read access on uploaded images
    - Ensure your AWS credentials have S3 PutObject and GetObject permissions

6.  **Run the development server:**
    ```bash
    npm run dev
    ```
    This uses `nodemon` to automatically restart the server when you make changes to the code. The server will be available at `http://localhost:3000`.

### 3.3. Important NPM Scripts

**Development & Production:**
-   `npm start`: Starts the server in production mode
-   `npm run dev`: Starts the server in development mode with `nodemon` auto-restart

**Code Quality:**
-   `npm run lint`: Lints the code in the `src` directory for potential errors (max 0 warnings)
-   `npm run lint:fix`: Automatically fixes fixable linting issues
-   `npm run format`: Formats the entire codebase using Prettier
-   `npm run format:check`: Checks for formatting issues without applying changes

**Data Management:**
-   `npm run create-super-admin`: Creates the initial super admin user
-   `npm run import-users`: Bulk import users from CSV file
-   `npm run upload-posm`: Import POSM data from CSV
-   `npm run upload-posm-clear`: Clear existing POSM data before import
-   `npm run upload-posm-insert`: Insert new POSM data only
-   `npm run upload-posm-update`: Update existing POSM data only
-   `npm run upload-posm-upsert`: Insert or update POSM data

**Debug Endpoints (Development):**
-   `GET /debug/users/count` - Get user statistics
-   `GET /debug/users/list` - List sample users
-   `GET /debug/users/admins` - List admin users
-   `GET /debug/stores/ids` - List store IDs and names

## 4. Database Schema Details

### 4.1. User Model (`src/models/User.js`)

```javascript
{
  userid: String,           // Unique user identifier
  username: String,         // Display name
  loginid: String,          // Login credential (unique)
  password: String,         // Hashed password (bcrypt, 12 rounds)
  role: String,            // 'admin', 'user', 'PRT', 'TDS', 'TDL'
  leader: String,          // Username of reporting manager
  isActive: Boolean,       // Account status
  lastLogin: Date,         // Last login timestamp
  refreshToken: String,    // JWT refresh token
  refreshTokenExpiry: Date,
  createdBy: String,       // Audit field
  updatedBy: String,       // Audit field
  isSuperAdmin: Boolean,   // Super admin flag
  assignedStores: [ObjectId] // References to Store documents
}
```

**Key Features:**
- Automatic password hashing with bcrypt (12 salt rounds)
- Hierarchical validation (PRT → TDS → TDL → admin)
- Store assignment system
- Super admin protection (cannot be deleted)
- Automatic JSON transformation (excludes password/tokens)

### 4.2. Store Model (`src/models/Store.js`)

```javascript
{
  store_id: String,        // Unique store identifier
  store_code: String,      // Store code
  store_name: String,      // Store display name
  channel: String,         // Sales channel
  hc: Number,             // Headcount
  region: String,         // Geographic region
  province: String,       // Province/state
  mcp: String,           // MCP flag ('Y' or 'N')
  isActive: Boolean,     // Store status
  createdBy: String,     // Audit field
  updatedBy: String      // Audit field
}
```

**Key Features:**
- Geographic indexing for region/province queries
- Channel-based organization
- Compound indexes for performance optimization

### 4.3. SurveyResponse Model (`src/models/SurveyResponse.js`)

```javascript
{
  leader: String,          // Survey submitter's leader
  shopName: String,        // Store name
  responses: [{
    model: String,         // Product model
    quantity: Number,      // Quantity (default: 1)
    posmSelections: [{
      posmCode: String,    // POSM identifier
      posmName: String,    // POSM display name
      selected: Boolean    // Selection status
    }],
    allSelected: Boolean,  // All POSM selected flag
    images: [String]       // S3 image URLs
  }],
  submittedAt: Date,       // Submission timestamp
  submittedBy: String,     // Submitter username
  submittedById: String,   // Submitter user ID
  submittedByRole: String  // Submitter role
}
```

### 4.4. Display Model (`src/models/Display.js`)

```javascript
{
  store_id: String,        // Store identifier
  model: String,           // Product model
  is_displayed: Boolean,   // Display status
  createdBy: String,       // Audit field
  updatedBy: String        // Audit field
}
```

**Key Features:**
- Composite unique index on store_id + model
- Prevents duplicate display records
- Pre-save validation for duplicate prevention

### 4.5. ModelPosm Model (`src/models/ModelPosm.js`)

```javascript
{
  model: String,           // Product model
  posm: String,            // POSM code
  posmName: String         // POSM display name
}
```

## 5. API Endpoints Reference

### 5.1. Authentication Routes (`/api/auth/`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/login` | User login with loginid/password | No |
| POST | `/refresh` | Refresh access token | No |
| GET | `/verify` | Verify current token validity | Yes |
| POST | `/logout` | User logout | Yes |

### 5.2. Survey Routes (`/api/`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/stores` | Get assigned stores for user | Yes |
| GET | `/models` | Get available models for store | Yes |
| GET | `/posm/:model` | Get POSM items for model | Yes |
| POST | `/upload` | Upload and process images | Yes |
| POST | `/submit` | Submit complete survey | Yes |

### 5.3. Survey History Routes (`/api/survey-history/`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get user's survey history | Yes |
| GET | `/:id` | Get specific survey details | Yes |

### 5.4. Admin Routes (`/api/admin/`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/responses` | Get all survey responses (paginated) | Admin |
| DELETE | `/responses/:id` | Delete survey response | Admin |
| POST | `/responses/bulk-delete` | Bulk delete responses | Admin |
| GET | `/export` | Export responses to Excel | Admin |

### 5.5. User Management (`/api/users/`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | List users (paginated, filterable) | Admin |
| POST | `/` | Create new user | Admin |
| GET | `/:id` | Get user details | Admin |
| PUT | `/:id` | Update user | Admin |
| DELETE | `/:id` | Delete user | Admin |
| POST | `/bulk-delete` | Bulk delete users | Admin |

### 5.6. Store Management (`/api/stores/`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | List stores (paginated, filterable) | Admin |
| POST | `/` | Create new store | Admin |
| GET | `/:id` | Get store details | Admin |
| PUT | `/:id` | Update store | Admin |
| DELETE | `/:id` | Delete store | Admin |
| POST | `/bulk-delete` | Bulk delete stores | Admin |

### 5.7. Display Management (`/api/displays/`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | List display records (paginated) | Admin |
| POST | `/` | Create display record | Admin |
| PUT | `/:id` | Update display record | Admin |
| DELETE | `/:id` | Delete display record | Admin |
| POST | `/bulk-delete` | Bulk delete displays | Admin |

### 5.8. Data Upload Routes (`/api/data-upload/`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/stores` | Bulk import stores from CSV | Admin |
| POST | `/posm` | Bulk import POSM data from CSV | Admin |

## 6. Frontend Architecture Details

### 6.1. Core Classes and Their Responsibilities

#### SurveyApp Class (`public/script.js`)
**Purpose:** Main survey application logic
**Key Methods:**
- `checkAuthentication()`: JWT token validation and refresh
- `loadStores()`: Fetch user's assigned stores
- `loadModels()`: Dynamic model loading for selected store
- `loadPOSM()`: Fetch POSM items for selected model
- `handleImageUpload()`: Process and validate image uploads
- `submitSurvey()`: Complete survey submission workflow

**State Management:**
- `selectedShop`: Currently selected store
- `selectedModels`: Array of selected product models
- `modelImages`: Object mapping models to uploaded images
- `checkboxStates`: Object tracking POSM selection states
- `modelQuantities`: Object tracking quantities per model

#### AdminApp Class (`public/admin.js`)
**Purpose:** Admin dashboard functionality
**Key Methods:**
- `loadResponses()`: Paginated survey response loading
- `handleFilters()`: Date, leader, and shop filtering
- `deleteResponse()`: Individual response deletion
- `bulkDelete()`: Multiple response deletion
- `exportToExcel()`: Excel export functionality

#### UserManagement Class (`public/user-management.js`)
**Purpose:** User CRUD operations
**Key Features:**
- Hierarchical user creation with leader validation
- Bulk operations (create, delete)
- Role-based filtering and search
- Store assignment management

#### StoreManagement Class (`public/store-management.js`)
**Purpose:** Store CRUD operations
**Key Features:**
- Geographic filtering (region, province)
- Channel-based organization
- Bulk import/export capabilities
- Active/inactive status management

#### DisplayManagement Class (`public/display-management.js`)
**Purpose:** Display record management
**Key Features:**
- Store-model relationship tracking
- Bulk update capabilities
- Display status management
- Store-based filtering

### 6.2. Authentication Flow

1. **Login Process:**
   - User submits credentials to `/api/auth/login`
   - Server validates credentials and generates JWT tokens
   - Tokens stored in localStorage
   - User redirected based on role (admin → survey-results, user → index)

2. **Token Management:**
   - Access tokens: 7-day expiry
   - Refresh tokens: 7-day expiry
   - Automatic token refresh on API calls
   - Session timeout: 60 minutes of inactivity

3. **Route Protection:**
   - HTML pages protected by middleware
   - API endpoints protected by JWT verification
   - Role-based access control (RBAC)

### 6.3. Error Handling

**Frontend:**
- Try-catch blocks around all API calls
- User-friendly error messages
- Graceful degradation for network issues
- Automatic logout on authentication errors

**Backend:**
- Global error handler middleware
- Consistent error response format
- Mongoose validation error handling
- JWT token validation errors

## 7. Code Conventions & Standards

### 7.1. General Coding Standards

**File Organization:**
- Group related functionality together
- Separate concerns (controllers, models, routes, etc.)
- Keep files focused on single responsibility
- Use descriptive file and directory names

**Code Structure:**
- Use consistent indentation (2 spaces)
- Maximum line length: 100 characters
- Use meaningful variable and function names
- Avoid deeply nested code (max 3-4 levels)

### 7.2. JavaScript Conventions

**Naming Conventions:**
```javascript
// Variables and functions: camelCase
const userName = 'john_doe';
const getUserById = (id) => { /* ... */ };

// Constants: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 10485760;
const API_ENDPOINTS = {
  LOGIN: '/api/auth/login',
  STORES: '/api/stores'
};

// Classes: PascalCase
class SurveyApp {
  constructor() { /* ... */ }
}

// Mongoose Models: PascalCase
const User = mongoose.model('User', userSchema);

// Files: camelCase with descriptive names
// userController.js, authMiddleware.js, surveyRoutes.js
```

**Function Conventions:**
```javascript
// Use arrow functions for simple expressions
const filterActive = (users) => users.filter(user => user.isActive);

// Use regular functions for methods and complex logic
async function authenticateUser(loginid, password) {
  try {
    const user = await User.findOne({ loginid });
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}

// Use descriptive parameter names
const createUser = ({ userid, username, loginid, password, role }) => {
  // Implementation
};
```

**Async/Await Patterns:**
```javascript
// Always use try-catch with async/await
const saveUser = async (userData) => {
  try {
    const user = new User(userData);
    const savedUser = await user.save();
    return savedUser;
  } catch (error) {
    console.error('Failed to save user:', error);
    throw new Error('User creation failed');
  }
};

// Use Promise.all for parallel operations
const loadUserData = async (userId) => {
  try {
    const [user, stores, surveys] = await Promise.all([
      User.findById(userId),
      Store.find({ _id: { $in: user.assignedStores } }),
      SurveyResponse.find({ submittedById: userId })
    ]);
    return { user, stores, surveys };
  } catch (error) {
    throw new Error('Failed to load user data');
  }
};
```

**Error Handling Patterns:**
```javascript
// Controller error handling
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    
    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { loginid: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
      
    const total = await User.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: users.length,
          totalRecords: total
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
```

### 7.3. Frontend JavaScript Conventions

**Class Structure:**
```javascript
class SurveyApp {
  constructor() {
    // Initialize properties first
    this.currentStep = 1;
    this.selectedShop = '';
    this.user = null;
    
    // Call initialization
    this.init();
  }
  
  async init() {
    // Check authentication first
    const isAuthenticated = await this.checkAuthentication();
    if (!isAuthenticated) {
      return;
    }
    
    // Then setup UI and events
    this.bindEvents();
    this.setupAuthUI();
  }
  
  // Group related methods together
  // Authentication methods
  async checkAuthentication() { /* ... */ }
  setupAuthUI() { /* ... */ }
  redirectToLogin(reason) { /* ... */ }
  
  // Event handling methods
  bindEvents() { /* ... */ }
  handleShopSelection(shop) { /* ... */ }
  handleModelSelection(model) { /* ... */ }
  
  // API interaction methods
  async loadStores() { /* ... */ }
  async loadModels(storeId) { /* ... */ }
  async submitSurvey() { /* ... */ }
}
```

**API Call Patterns:**
```javascript
// Use consistent error handling for fetch calls
const authenticatedFetch = async (url, options = {}) => {
  try {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        // Handle authentication errors
        this.clearAuthData();
        this.redirectToLogin('Session expired');
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};
```

**DOM Manipulation:**
```javascript
// Use descriptive element selection
const showLoadingSpinner = () => {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
  }
};

const hideLoadingSpinner = () => {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
};

// Use event delegation for dynamic content
document.addEventListener('click', (event) => {
  if (event.target.matches('.delete-btn')) {
    handleDelete(event.target.dataset.id);
  }
  if (event.target.matches('.edit-btn')) {
    handleEdit(event.target.dataset.id);
  }
});
```

### 7.4. Backend Node.js Conventions

**Module Structure:**
```javascript
// Controller structure
const { User, Store } = require('../models');
const { validateInput } = require('../utils/validation');

/**
 * Get all users with pagination and filtering
 * @route GET /api/users
 * @access Admin
 */
const getUsers = async (req, res) => {
  try {
    // Implementation
  } catch (error) {
    // Error handling
  }
};

/**
 * Create a new user
 * @route POST /api/users
 * @access Admin
 */
const createUser = async (req, res) => {
  try {
    // Implementation
  } catch (error) {
    // Error handling
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  bulkDeleteUsers
};
```

**Mongoose Model Conventions:**
```javascript
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // Required fields first
    userid: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    
    // Optional fields after
    lastLogin: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    
    // Audit fields at the end
    createdBy: {
      type: String,
      default: 'system',
    },
    updatedBy: {
      type: String,
      default: 'system',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Add indexes after schema definition
userSchema.index({ userid: 1 });
userSchema.index({ username: 1 });
userSchema.index({ role: 1, isActive: 1 });

// Add methods after indexes
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Add static methods after instance methods
userSchema.statics.findActive = function () {
  return this.find({ isActive: true });
};

module.exports = mongoose.model('User', userSchema);
```

**Route Structure:**
```javascript
const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  bulkDeleteUsers
} = require('../controllers/userController');

const router = express.Router();

// Apply common middleware
router.use(verifyToken);
router.use(requireAdmin);

// RESTful routes in logical order
router.get('/', getUsers);           // GET /api/users
router.post('/', createUser);        // POST /api/users
router.get('/:id', getUser);         // GET /api/users/:id
router.put('/:id', updateUser);      // PUT /api/users/:id
router.delete('/:id', deleteUser);   // DELETE /api/users/:id

// Bulk operations after CRUD
router.post('/bulk-delete', bulkDeleteUsers);

module.exports = router;
```

### 7.5. CSS Conventions

**CSS Organization:**
```css
/* Use CSS custom properties for theming */
:root {
  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --success: #10b981;
  --error: #ef4444;
  --neutral: #f8fafc;
  --text-primary: #334155;
  --border-radius: 8px;
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* Reset and base styles first */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--neutral);
  color: var(--text-primary);
  line-height: 1.5;
}

/* Component-based organization */
/* Button components */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--border-radius);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover);
}

/* Form components */
.form-group {
  margin-bottom: 1rem;
}

.form-control {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: var(--border-radius);
  font-size: 0.875rem;
}

.form-control:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
```

**Responsive Design Patterns:**
```css
/* Mobile-first approach */
.container {
  width: 100%;
  padding: 1rem;
}

/* Progressive enhancement for larger screens */
@media (min-width: 768px) {
  .container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 2rem;
  }
}

@media (min-width: 1024px) {
  .container {
    padding: 3rem;
  }
}

/* Use logical properties when possible */
.card {
  padding-block: 1rem;
  padding-inline: 1.5rem;
  margin-block-end: 1rem;
}
```

### 7.6. Development Workflow

**ESLint Configuration (`.eslintrc.json`):**
- Strict error checking (max-warnings: 0)
- Modern ES6+ syntax enforcement
- Consistent code formatting rules
- Security best practices

**Prettier Configuration (`.prettierrc.json`):**
- 2-space indentation
- Single quotes for strings
- Trailing commas where valid
- Line width: 100 characters

### 7.2. Git Workflow

**Branch Strategy:**
- `main`: Production-ready code
- Feature branches: `feature/description`
- Hotfix branches: `hotfix/description`

**Commit Standards:**
- Descriptive commit messages
- Atomic commits (single logical change)
- No `.env` files in version control
- Run linting before commits

### 7.3. Testing Strategy

**Manual Testing:**
- User authentication flows
- Survey submission process
- Admin dashboard operations
- File upload functionality
- Mobile responsiveness

**Automated Testing (Future):**
- Puppeteer for E2E testing
- Jest for unit testing
- API endpoint testing
- Database integration testing

## 8. Security Considerations

### 8.1. Authentication & Authorization

- **Password Security:** bcrypt with 12 salt rounds
- **JWT Security:** Strong secret keys, proper expiration
- **Session Management:** Refresh token rotation
- **Route Protection:** Middleware-based access control

### 8.2. Data Protection

- **Input Validation:** Frontend and backend validation
- **SQL Injection Prevention:** Mongoose ODM protection
- **XSS Prevention:** Content sanitization
- **File Upload Security:** Type validation, size limits

### 8.3. Environment Security

- **Environment Variables:** All secrets in .env
- **CORS Configuration:** Proper origin restrictions
- **Error Handling:** No sensitive data in error messages
- **Database Access:** Authenticated MongoDB connections

## 9. Performance Optimization

### 9.1. Database Optimization

- **Indexing Strategy:** Proper indexes on query fields
- **Aggregation Pipelines:** Efficient data processing
- **Pagination:** Limit large result sets
- **Connection Pooling:** MongoDB connection management

### 9.2. Frontend Optimization

- **Image Compression:** Automatic resizing via Sharp
- **Lazy Loading:** Progressive content loading
- **CSS Optimization:** Minimal, efficient stylesheets
- **JavaScript Bundling:** ES6 modules, no frameworks

### 9.3. AWS S3 Integration

- **Image Processing:** Automatic compression (80% quality)
- **Size Limits:** Maximum 10MB file uploads
- **CDN Integration:** Fast global content delivery
- **Signed URLs:** Secure upload process

## 10. Troubleshooting Guide

### 10.1. Common Issues

**Database Connection:**
- Check MongoDB service status
- Verify connection string in .env
- Ensure network connectivity

**Authentication Problems:**
- Verify JWT secrets in .env
- Check token expiration times
- Clear localStorage for fresh start

**File Upload Issues:**
- Verify AWS credentials
- Check S3 bucket permissions
- Confirm image file formats

**Permission Errors:**
- Verify user roles in database
- Check route protection middleware
- Confirm admin privileges

### 10.2. Debug Endpoints

Use the debug endpoints in development for troubleshooting:
- `/debug/users/count` - User statistics
- `/debug/users/list` - Sample user data
- `/debug/users/admins` - Admin user verification
- `/debug/stores/ids` - Store data verification

## 11. Deployment Considerations

### 11.1. Environment Setup

**Production Environment Variables:**
- Strong JWT secrets (different from development)
- Production MongoDB URI
- AWS production credentials
- Proper CORS origins

**Server Configuration:**
- Process manager (PM2 recommended)
- Reverse proxy (Nginx recommended)
- SSL/TLS certificates
- Environment monitoring

### 11.2. Database Migration

- Export development data
- Set up production MongoDB
- Create initial admin user
- Import reference data (stores, POSM)

This comprehensive guide should provide all the information needed to understand, develop, and maintain the POSM Survey Collection System. For specific implementation details, refer to the individual source files mentioned throughout this document.