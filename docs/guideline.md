# POSM Survey Collection System - Comprehensive Developer Guide

## Overview

The POSM Survey Collection System is a comprehensive Node.js web application designed for managing Point of Sale Materials (POSM) survey collection, user management, store catalogs, and bulk data operations. The system supports multi-role hierarchical user management with secure authentication, real-time survey data collection with image uploads, and comprehensive admin dashboard capabilities.

## Table of Contents

1. [Architecture & Technical Stack](#architecture--technical-stack)
2. [Project Structure](#project-structure)
3. [Environment Setup](#environment-setup)
4. [Database Schema & Models](#database-schema--models)
5. [Authentication & Authorization](#authentication--authorization)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [Frontend Components](#frontend-components)
8. [Data Flow & Business Logic](#data-flow--business-logic)
9. [File Upload & AWS Integration](#file-upload--aws-integration)
10. [Deployment & Scripts](#deployment--scripts)
11. [Development Guidelines](#development-guidelines)
12. [Troubleshooting](#troubleshooting)

---

## Architecture & Technical Stack

### Backend Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js with middleware-based architecture
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT-based access/refresh token system
- **File Storage**: AWS S3 for image uploads
- **Image Processing**: Sharp for image optimization
- **Data Processing**: CSV/XLSX parsing for bulk imports
- **Security**: bcrypt for password hashing, CORS enabled

### Frontend Stack
- **Core**: Vanilla JavaScript ES6+ (Class-based architecture)
- **UI**: HTML5 with CSS3 (Flexbox/Grid layouts)
- **Authentication**: JWT token storage in localStorage
- **AJAX**: Fetch API for all server communications
- **File Handling**: FormData for multipart uploads
- **Responsive**: Mobile-first design approach

### External Services
- **AWS S3**: Image storage with signed URL uploads
- **MongoDB Atlas**: Primary database (cloud-hosted recommended)
- **Email Service**: Nodemailer integration (optional)

---

## Project Structure

```
posm-survey-collection/
├── server.js                    # Application entry point & HTML route handlers
├── package.json                 # Dependencies & npm scripts
├── .env                        # Environment variables (not committed)
├── .eslintrc.json             # ESLint configuration
├── .prettierrc.json           # Prettier configuration
├── README.md                  # Basic project information
│
├── docs/                      # Documentation
│   ├── guideline.md          # This comprehensive guide
│   └── claude_notes.md       # Development notes
│
├── src/                      # Source code
│   ├── config/               # Configuration management
│   │   ├── index.js         # Centralized config with validation
│   │   └── database.js      # MongoDB connection & event handling
│   │
│   ├── models/              # Mongoose schemas & business logic
│   │   ├── index.js        # Model exports
│   │   ├── User.js         # User model with hierarchy validation
│   │   ├── Store.js        # Store catalog model
│   │   ├── ModelPosm.js    # Product model-POSM mappings
│   │   ├── Display.js      # Store-model display status tracking
│   │   └── SurveyResponse.js # Survey submission data
│   │
│   ├── controllers/         # Request handlers & business logic
│   │   ├── authController.js      # Authentication & session management
│   │   ├── userController.js      # User CRUD operations
│   │   ├── storeController.js     # Store management
│   │   ├── displayController.js   # Display status management
│   │   ├── surveyController.js    # Survey submission handling
│   │   ├── surveyHistoryController.js # Survey history queries
│   │   ├── adminController.js     # Admin dashboard operations
│   │   ├── uploadController.js    # File upload coordination
│   │   └── dataUploadController.js # Bulk data import handling
│   │
│   ├── routes/              # Express route definitions
│   │   ├── index.js        # Route aggregation & mounting
│   │   ├── authRoutes.js   # Authentication endpoints
│   │   ├── userRoutes.js   # User management endpoints
│   │   ├── storeRoutes.js  # Store management endpoints
│   │   ├── displayRoutes.js # Display management endpoints
│   │   ├── surveyRoutes.js # Survey collection endpoints
│   │   ├── surveyHistoryRoutes.js # Survey history endpoints
│   │   ├── adminRoutes.js  # Admin dashboard endpoints
│   │   ├── uploadRoutes.js # File upload endpoints
│   │   └── dataUploadRoutes.js # Bulk import endpoints
│   │
│   ├── middleware/          # Express middleware
│   │   ├── auth.js         # JWT token verification & role checking
│   │   ├── routeAuth.js    # HTML route protection & redirection
│   │   └── errorHandler.js # Global error handling & 404 responses
│   │
│   ├── services/            # Business logic services
│   │   └── dataInitializer.js # Bootstrap data loading from CSV
│   │
│   └── utils/               # Utility functions
│       └── s3Helper.js     # AWS S3 integration utilities
│
├── public/                  # Static frontend files
│   ├── *.html              # HTML pages (protected & public routes)
│   ├── *.js               # Frontend JavaScript modules
│   ├── *.css              # Stylesheets
│   └── favicon.ico        # Site icon
│
├── uploads/                # Local file upload workspace
│   ├── csv/               # CSV processing directory
│   └── temp/              # Temporary file storage
│
└── *.csv                   # Data import files (posm.csv, stores.csv, etc.)
```

---

## Environment Setup

### Prerequisites

1. **Node.js 18+** - Runtime environment
2. **MongoDB Database** - Atlas cloud instance or local MongoDB server
3. **AWS Account** - For S3 file storage
4. **Git** - Version control

### Environment Variables

Create a `.env` file in the project root:

```bash
# Server Configuration
PORT=3000                           # Application port (default: 3000)
NODE_ENV=development                # Environment mode (development/production)

# Database Configuration
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority

# JWT Security (CRITICAL: Change in production)
JWT_ACCESS_SECRET=your-super-secret-access-key-change-in-production-must-be-long-and-random
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production-must-be-different

# AWS Configuration (Required for file uploads)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE      # Your AWS access key
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY  # Your AWS secret key
AWS_REGION=ap-southeast-1                    # AWS region for S3 bucket
AWS_S3_BUCKET=your-posm-survey-bucket-name   # S3 bucket name for file storage

# Optional Email Configuration (for future features)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
```

### Installation Steps

```bash
# 1. Clone and navigate to project
git clone <repository-url>
cd posm-survey-collection

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env
# Edit .env with your configuration

# 4. Setup AWS S3 Bucket
# - Create S3 bucket in your AWS account
# - Configure CORS for web uploads
# - Set appropriate IAM permissions

# 5. Initialize database (optional - auto-loaded on first run)
npm run upload-posm          # Load POSM data
npm run import-users         # Load user data
npm run create-super-admin   # Create initial admin account

# 6. Start application
npm run dev                  # Development with nodemon
# OR
npm start                   # Production mode
```

### AWS S3 Setup

1. **Create S3 Bucket**:
   - Bucket name: `your-posm-survey-bucket-name`
   - Region: `ap-southeast-1` (or your preferred region)
   - Block public access: Keep enabled for security

2. **Configure CORS Policy**:
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["PUT", "POST", "GET"],
        "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
        "ExposeHeaders": []
    }
]
```

3. **IAM User Permissions**:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::your-posm-survey-bucket-name/*"
        }
    ]
}
```

---

## Database Schema & Models

### User Model (`src/models/User.js`)

```javascript
// Core user management with hierarchical role system
{
  userid: String,           // Unique user identifier
  username: String,         // Display name
  loginid: String,          // Login credential (unique)
  password: String,         // bcrypt hashed password
  role: Enum,              // 'admin', 'user', 'PRT', 'TDS', 'TDL'
  leader: String,          // Reports-to username (hierarchical)
  isActive: Boolean,       // Account status
  lastLogin: Date,         // Last authentication timestamp
  refreshToken: String,    // JWT refresh token storage
  refreshTokenExpiry: Date, // Token expiration
  isSuperAdmin: Boolean,   // Super admin flag (cannot be deleted)
  assignedStores: [ObjectId], // References to Store model
  createdBy: String,       // Audit trail
  updatedBy: String,       // Audit trail
  timestamps: true         // createdAt, updatedAt
}
```

**Key Features**:
- **Password Security**: bcrypt with salt rounds 12
- **Role Hierarchy Validation**: Enforces reporting structure (PRT→TDS→TDL)
- **Super Admin Protection**: Cannot be deleted or modified
- **Store Assignment**: Many-to-many relationship with stores
- **Token Management**: Refresh token rotation for security

**User Role Hierarchy**:
```
admin (Super Admin) - System administration
  ↓
TDL (Team Director Lead) - Regional management
  ↓
TDS (Team Director Supervisor) - Area management
  ↓
PRT (Project Team) - Field execution
  ↓
user - Survey data collection
```

### Store Model (`src/models/Store.js`)

```javascript
// Store catalog and location management
{
  store_id: String,        // Unique store identifier (indexed)
  store_code: String,      // Alternative store code
  store_name: String,      // Store display name (indexed)
  channel: String,         // Store channel type (indexed)
  hc: Number,             // Store hierarchy code
  region: String,         // Geographic region (indexed)
  province: String,       // Province/state (indexed)
  mcp: Enum,              // 'Y' or 'N' - MCP status
  isActive: Boolean,      // Store operational status
  createdBy: String,      // Audit trail
  updatedBy: String,      // Audit trail
  timestamps: true
}
```

**Key Features**:
- **Multi-level Indexing**: Optimized queries by region, province, channel
- **Compound Indexes**: region+province, channel+region combinations
- **Flexible Identification**: Multiple ID fields for integration

### ModelPosm Model (`src/models/ModelPosm.js`)

```javascript
// Product model to POSM material mapping
{
  model: String,           // Product model identifier
  posm: String,           // POSM material code
  posmName: String,       // POSM material display name
  timestamps: true
}
```

**Key Features**:
- **Product-Material Mapping**: Links models to available POSM options
- **Survey Template Data**: Used to generate dynamic survey forms

### SurveyResponse Model (`src/models/SurveyResponse.js`)

```javascript
// Survey submission data with nested structure
{
  leader: String,          // Submitting user's leader
  shopName: String,        // Selected shop name
  responses: [             // Array of model responses
    {
      model: String,       // Product model
      quantity: Number,    // Model quantity (min: 1)
      posmSelections: [    // POSM material selections
        {
          posmCode: String,
          posmName: String,
          selected: Boolean
        }
      ],
      allSelected: Boolean, // Quick flag for all POSM selected
      images: [String]     // Array of S3 image URLs
    }
  ],
  submittedAt: Date,       // Submission timestamp
  submittedBy: String,     // Submitter username
  submittedById: String,   // Submitter user ID
  submittedByRole: String, // Submitter role
  timestamps: true
}
```

**Key Features**:
- **Flexible Response Structure**: Supports multiple models per submission
- **Image Integration**: Direct S3 URL storage
- **Audit Trail**: Complete user tracking
- **POSM Selection State**: Granular material selection tracking

### Display Model (`src/models/Display.js`)

```javascript
// Store-model display status tracking
{
  store_id: String,        // Reference to store (indexed)
  model: String,          // Product model (indexed)
  is_displayed: Boolean,  // Current display status
  createdBy: String,      // Audit trail
  updatedBy: String,      // Audit trail
  timestamps: true
}
```

**Key Features**:
- **Composite Unique Index**: store_id + model prevents duplicates
- **Display State Management**: Tracks POSM deployment status
- **Bulk Operations Support**: Optimized for mass updates

---

## Authentication & Authorization

### JWT Token System

The application uses a dual-token system for secure authentication:

#### Token Types

1. **Access Token** (`src/middleware/auth.js:17-40`)
   - **Purpose**: API request authentication
   - **Lifetime**: 15 minutes
   - **Storage**: Frontend localStorage
   - **Payload**: Complete user profile data
   - **Refresh**: Automatic via refresh token

2. **Refresh Token** (`src/middleware/auth.js:33-37`)
   - **Purpose**: Access token renewal
   - **Lifetime**: 7 days
   - **Storage**: Database (User model) + frontend localStorage
   - **Security**: Rotation on each use
   - **Revocation**: Database cleanup on logout

#### Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant Database

    Client->>Server: POST /api/auth/login (credentials)
    Server->>Database: Validate user credentials
    Database-->>Server: User data
    Server->>Database: Store refresh token
    Server-->>Client: Access + Refresh tokens
    
    Note over Client: Store tokens in localStorage
    
    Client->>Server: API Request + Access Token
    alt Token Valid
        Server-->>Client: API Response
    else Token Expired
        Client->>Server: POST /api/auth/refresh (refresh token)
        Server->>Database: Validate refresh token
        Server->>Database: Update refresh token
        Server-->>Client: New Access + Refresh tokens
        Client->>Server: Retry API Request
    end
```

### Role-Based Access Control (RBAC)

#### Middleware Functions (`src/middleware/auth.js`)

```javascript
// Core authentication verification
verifyToken(req, res, next)           // Validates JWT and loads user data

// Role-specific access control
requireAdmin(req, res, next)          // Admin only
requireSurveyUser(req, res, next)     // Survey collection roles
requireManager(req, res, next)        // Management roles (TDS, TDL, admin)

// Flexible role checking
requireRole(['admin', 'TDL'])(req, res, next)  // Custom role combinations
```

#### HTML Route Protection (`src/middleware/routeAuth.js`)

```javascript
// Frontend page access control
protectSurveyPage           // Allows: admin, user, PRT, TDS, TDL
protectAdminPage            // Allows: admin only
redirectIfAuthenticated     // Redirects authenticated users away from login pages
```

#### Permission Matrix

| Role | Survey Collection | User Management | Store Management | Admin Dashboard | Super Admin |
|------|------------------|----------------|-----------------|----------------|-------------|
| user | ✅ (assigned stores) | ❌ | ❌ | ❌ | ❌ |
| PRT | ✅ (assigned stores) | ❌ | ❌ | ❌ | ❌ |
| TDS | ✅ (all stores) | ✅ (subordinates) | ❌ | ❌ | ❌ |
| TDL | ✅ (all stores) | ✅ (subordinates) | ❌ | ❌ | ❌ |
| admin | ✅ (all stores) | ✅ (all users) | ✅ | ✅ | ✅* |

*Super admin flag prevents account deletion

---

## API Endpoints Reference

### Authentication Endpoints (`/api/auth/`)

| Method | Endpoint | Auth Required | Description | Request Body | Response |
|--------|----------|---------------|-------------|--------------|----------|
| POST | `/login` | ❌ | User login | `{loginid, password}` | `{success, data: {user, accessToken, refreshToken}}` |
| POST | `/admin/login` | ❌ | Admin login | `{loginid, password}` | `{success, data: {user, accessToken, refreshToken}}` |
| POST | `/refresh` | ❌ | Token refresh | `{refreshToken}` | `{success, data: {accessToken, refreshToken, user}}` |
| POST | `/logout` | ✅ | User logout | `{}` | `{success, message}` |
| GET | `/profile` | ✅ | Get user profile | - | `{success, data: user}` |
| POST | `/change-password` | ✅ | Change password | `{currentPassword, newPassword}` | `{success, message}` |
| GET | `/verify` | ✅ | Token verification | - | `{success, data: user}` |
| GET | `/subordinates` | ✅ (Survey roles) | Get team members | - | `{success, data: [users]}` |

### User Management Endpoints (`/api/users/`)

| Method | Endpoint | Auth Required | Description | Request Body | Response |
|--------|----------|---------------|-------------|--------------|----------|
| GET | `/` | ✅ (Admin) | List all users | Query: `{page, limit, search, role}` | `{success, data: {users, total, page, pages}}` |
| POST | `/` | ✅ (Admin) | Create user | `{userid, username, loginid, password, role, leader, assignedStores}` | `{success, data: user}` |
| GET | `/:id` | ✅ (Admin) | Get user details | - | `{success, data: user}` |
| PUT | `/:id` | ✅ (Admin) | Update user | `{username, role, leader, isActive, assignedStores}` | `{success, data: user}` |
| DELETE | `/:id` | ✅ (Admin) | Delete user | - | `{success, message}` |
| POST | `/:id/reset-password` | ✅ (Admin) | Reset user password | `{newPassword}` | `{success, message}` |
| POST | `/bulk-create` | ✅ (Admin) | Bulk user creation | `{users: [user]}` | `{success, data: {created, errors}}` |

### Store Management Endpoints (`/api/stores/`)

| Method | Endpoint | Auth Required | Description | Request Body | Response |
|--------|----------|---------------|-------------|--------------|----------|
| GET | `/` | ✅ (Admin) | List stores | Query: `{page, limit, search, region, province}` | `{success, data: {stores, total, page, pages}}` |
| POST | `/` | ✅ (Admin) | Create store | `{store_id, store_name, channel, hc, region, province, mcp}` | `{success, data: store}` |
| GET | `/search` | ✅ | Search stores | Query: `{q, limit}` | `{success, data: [stores]}` |
| GET | `/assigned` | ✅ | Get assigned stores | - | `{success, data: [stores]}` |
| PUT | `/:id` | ✅ (Admin) | Update store | `{store_name, channel, hc, region, province, mcp, isActive}` | `{success, data: store}` |
| DELETE | `/:id` | ✅ (Admin) | Delete store | - | `{success, message}` |
| POST | `/bulk-create` | ✅ (Admin) | Bulk store creation | `{stores: [store]}` | `{success, data: {created, errors}}` |

### Survey Collection Endpoints (`/api/`)

| Method | Endpoint | Auth Required | Description | Request Body | Response |
|--------|----------|---------------|-------------|--------------|----------|
| GET | `/models` | ✅ | Get available models | Query: `{search}` | `{success, data: {models}}` |
| POST | `/submit-survey` | ✅ | Submit survey response | `{leader, shopName, responses}` | `{success, data: surveyResponse}` |
| GET | `/signed-url` | ✅ | Get S3 upload URL | Query: `{fileName, fileType}` | `{success, data: {uploadURL, key}}` |

### Survey History Endpoints (`/api/survey-history/`)

| Method | Endpoint | Auth Required | Description | Request Body | Response |
|--------|----------|---------------|-------------|--------------|----------|
| GET | `/` | ✅ | Get survey history | Query: `{page, limit, startDate, endDate, leader, model}` | `{success, data: {responses, total, page, pages}}` |
| GET | `/:id` | ✅ | Get survey details | - | `{success, data: surveyResponse}` |
| DELETE | `/:id` | ✅ (Admin) | Delete survey response | - | `{success, message}` |

### Admin Dashboard Endpoints (`/api/admin/`)

| Method | Endpoint | Auth Required | Description | Request Body | Response |
|--------|----------|---------------|-------------|--------------|----------|
| GET | `/dashboard-stats` | ✅ (Admin) | Get dashboard statistics | - | `{success, data: {users, stores, responses, models}}` |
| GET | `/recent-surveys` | ✅ (Admin) | Get recent survey submissions | Query: `{limit}` | `{success, data: [responses]}` |
| GET | `/user-activity` | ✅ (Admin) | Get user activity summary | Query: `{startDate, endDate}` | `{success, data: [activity]}` |

### Display Management Endpoints (`/api/displays/`)

| Method | Endpoint | Auth Required | Description | Request Body | Response |
|--------|----------|---------------|-------------|--------------|----------|
| GET | `/` | ✅ (Admin) | List display records | Query: `{page, limit, store_id, model, is_displayed}` | `{success, data: {displays, total, page, pages}}` |
| POST | `/` | ✅ (Admin) | Create display record | `{store_id, model, is_displayed}` | `{success, data: display}` |
| PUT | `/:id` | ✅ (Admin) | Update display status | `{is_displayed}` | `{success, data: display}` |
| DELETE | `/:id` | ✅ (Admin) | Delete display record | - | `{success, message}` |
| POST | `/bulk-update` | ✅ (Admin) | Bulk status update | `{updates: [{store_id, model, is_displayed}]}` | `{success, data: {updated, errors}}` |

### Data Upload Endpoints (`/api/data-upload/`)

| Method | Endpoint | Auth Required | Description | Request Body | Response |
|--------|----------|---------------|-------------|--------------|----------|
| POST | `/users` | ✅ (Admin) | Upload users CSV | FormData with file | `{success, data: {imported, errors}}` |
| POST | `/stores` | ✅ (Admin) | Upload stores CSV | FormData with file | `{success, data: {imported, errors}}` |
| POST | `/displays` | ✅ (Admin) | Upload displays CSV | FormData with file | `{success, data: {imported, errors}}` |
| GET | `/template/:type` | ✅ (Admin) | Download CSV template | - | CSV file download |

---

## Frontend Components

### Application Architecture

The frontend uses a class-based JavaScript architecture with separate concerns:

```javascript
// Main application classes
class SurveyApp           // Survey collection interface (public/script.js)
class AdminApp            // Admin dashboard (public/admin.js)
class UserManagementApp   // User CRUD operations (public/user-management.js)
class StoreManagementApp  // Store CRUD operations (public/store-management.js)
class DataUploadApp       // Bulk data import interface (public/data-upload.js)
class SurveyHistoryApp    // Historical survey data viewer (public/survey-history.js)
class SurveyResultsApp    // Survey analytics dashboard (public/survey-results.js)
class PaginationComponent // Reusable pagination widget (public/pagination-component.js)
```

### Key Frontend Features

#### Authentication Management

```javascript
// Token storage and automatic refresh
class AuthManager {
  static getToken() {
    return localStorage.getItem('accessToken');
  }
  
  static async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    // Automatic token refresh logic
  }
  
  static logout() {
    // Clear tokens and redirect
  }
}
```

#### Survey Collection Flow

```javascript
// Multi-step survey wizard (public/script.js:1-50)
class SurveyApp {
  constructor() {
    this.currentStep = 1;           // Wizard step tracking
    this.selectedShop = '';         // Shop selection state
    this.selectedModels = [];       // Product model selections
    this.modelImages = {};          // Image upload storage
    this.checkboxStates = {};       // POSM selection state
    this.modelQuantities = {};      // Quantity tracking
  }

  // Step 1: Shop selection with autocomplete
  async handleShopSearch() {
    // Debounced search with dropdown suggestions
  }

  // Step 2: Model selection with dynamic loading
  async loadModelsForShop() {
    // Load available models based on shop selection
  }

  // Step 3: POSM selection per model
  async loadPosmForModel(model) {
    // Dynamic checkbox generation
  }

  // Step 4: Image upload with S3 integration
  async handleImageUpload(files, model) {
    // Direct S3 upload with signed URLs
  }

  // Step 5: Final submission
  async submitSurvey() {
    // Compile and submit all survey data
  }
}
```

#### Admin Dashboard Components

```javascript
// Comprehensive admin interface (public/admin.js)
class AdminApp {
  async loadDashboardStats() {
    // Real-time statistics loading
  }

  async loadRecentSurveys() {
    // Recent activity display
  }

  async loadUserActivity() {
    // User activity analytics
  }
}
```

#### Data Management Interfaces

```javascript
// User management with pagination (public/user-management.js)
class UserManagementApp {
  async loadUsers(page = 1, search = '') {
    // Paginated user listing with search
  }

  async createUser(userData) {
    // User creation with validation
  }

  async updateUser(userId, updates) {
    // User modification
  }

  async deleteUser(userId) {
    // User deletion with confirmation
  }

  async bulkCreateUsers(usersData) {
    // Bulk user import
  }
}
```

### UI/UX Features

#### Responsive Design
- **Mobile-first CSS**: Optimized for mobile survey collection
- **Flexbox layouts**: Consistent responsive behavior
- **Touch-friendly**: Large buttons and form elements
- **Fast loading**: Minimal dependencies and optimized assets

#### User Experience
- **Progressive disclosure**: Step-by-step survey wizard
- **Real-time feedback**: Immediate validation and error messages
- **Autocomplete search**: Fast shop and model selection
- **Image preview**: Immediate upload feedback
- **Loading states**: Clear progress indicators

#### Accessibility
- **Semantic HTML**: Proper heading structure and form labels
- **Keyboard navigation**: Full keyboard accessibility
- **Color contrast**: WCAG compliant color schemes
- **Screen reader support**: ARIA labels and descriptions

---

## Data Flow & Business Logic

### Survey Collection Workflow

```mermaid
flowchart TD
    A[User Login] --> B[Select Shop]
    B --> C[Shop Validation]
    C --> D[Load Available Models]
    D --> E[Select Models & Quantities]
    E --> F[For Each Model: Select POSM]
    F --> G[Upload Images per Model]
    G --> H[Review Survey Data]
    H --> I[Submit Survey]
    I --> J[Store in MongoDB]
    J --> K[Update Display Status]
    K --> L[Send Confirmation]
```

### User Hierarchy Management

```mermaid
flowchart TD
    A[Super Admin] --> B[Admin Users]
    B --> C[TDL Team Director Lead]
    C --> D[TDS Team Director Supervisor]
    D --> E[PRT Project Team]
    E --> F[User Survey Collectors]
    
    G[User Creation] --> H{Validate Hierarchy}
    H -->|Valid| I[Create User]
    H -->|Invalid| J[Reject Creation]
    
    K[Leader Assignment] --> L{Check Valid Leader Role}
    L -->|Valid| M[Assign Leader]
    L -->|Invalid| N[Validation Error]
```

### File Upload Process

```mermaid
sequenceDiagram
    participant Client
    participant Express
    participant S3

    Client->>Express: Request signed URL
    Express->>S3: Generate signed URL
    S3-->>Express: Return signed URL + key
    Express-->>Client: Return upload URL

    Client->>S3: Upload file directly
    S3-->>Client: Upload confirmation

    Client->>Express: Submit form with S3 key
    Express->>MongoDB: Store survey with image URLs
    MongoDB-->>Express: Confirmation
    Express-->>Client: Survey submission success
```

### Data Validation Logic

#### User Validation (`src/models/User.js:115-134`)
```javascript
// Pre-save middleware validates user hierarchy
userSchema.pre('save', async function(next) {
  // Skip if not new and role/leader unchanged
  if (!this.isNew && !this.isModified('role') && !this.isModified('leader')) {
    return next();
  }

  // Validate reporting structure
  const isValid = await this.constructor.validateHierarchy(this.role, this.leader);
  if (!isValid) {
    return next(new Error('Invalid hierarchy'));
  }
  next();
});
```

#### Store Assignment Logic
```javascript
// Users can only access assigned stores (except admins)
const getAssignedStores = async (user) => {
  if (user.role === 'admin') {
    return await Store.find({ isActive: true }); // All stores
  }
  
  return await Store.find({
    _id: { $in: user.assignedStores },
    isActive: true
  });
};
```

#### Survey Data Validation
```javascript
// Survey submission validation
const validateSurveyData = (surveyData) => {
  const errors = [];
  
  if (!surveyData.leader) errors.push('Leader is required');
  if (!surveyData.shopName) errors.push('Shop name is required');
  if (!surveyData.responses || surveyData.responses.length === 0) {
    errors.push('At least one model response is required');
  }
  
  // Validate each model response
  surveyData.responses.forEach((response, index) => {
    if (!response.model) errors.push(`Model is required for response ${index + 1}`);
    if (!response.quantity || response.quantity < 1) {
      errors.push(`Valid quantity is required for response ${index + 1}`);
    }
    if (!response.posmSelections || response.posmSelections.length === 0) {
      errors.push(`POSM selection is required for response ${index + 1}`);
    }
  });
  
  return errors;
};
```

---

## File Upload & AWS Integration

### S3 Integration Architecture

The system uses AWS S3 for scalable image storage with direct client-side uploads to reduce server load:

#### S3 Helper Utility (`src/utils/s3Helper.js`)

```javascript
// S3 configuration and utilities
const s3 = new AWS.S3({
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey,
  region: config.aws.region,
});

// Generate signed URLs for direct client uploads
const getS3SignedUrl = (fileName, fileType) => {
  const s3Params = {
    Bucket: config.aws.s3Bucket,
    Key: `uploads/${Date.now()}_${fileName}`,    // Timestamped to prevent conflicts
    Expires: 60,                                 // 1-minute expiry for security
    ContentType: fileType,
  };

  return s3.getSignedUrlPromise('putObject', s3Params);
};

// Image optimization with Sharp
const reduceImageSize = async (buffer, maxWidth = 1024, quality = 80) => {
  return sharp(buffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();
};
```

#### Upload Process Flow

1. **Client Request**: Frontend requests signed URL from `/api/signed-url`
2. **Server Generation**: Express generates S3 signed URL with expiry
3. **Direct Upload**: Client uploads directly to S3 using signed URL
4. **Form Submission**: Client submits survey data with S3 object keys
5. **Database Storage**: Server stores S3 URLs in survey response

#### Security Considerations

- **Signed URLs**: Temporary access (60-second expiry)
- **CORS Configuration**: Restricts upload origins
- **File Type Validation**: Client and server-side validation
- **Image Optimization**: Automatic resize and compression
- **Access Control**: Private bucket with IAM permissions

### Local File Processing

For CSV/Excel bulk imports, files are temporarily stored locally:

```javascript
// Local upload directories (created automatically)
uploads/
├── csv/          # CSV processing workspace
└── temp/         # Temporary file storage

// Multer configuration for local uploads
const upload = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: 10 * 1024 * 1024,    // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  },
});
```

---

## Deployment & Scripts

### NPM Scripts Reference

```json
{
  "scripts": {
    // Application execution
    "start": "node server.js",              // Production server
    "dev": "nodemon server.js",             // Development with auto-reload

    // Data management utilities
    "upload-posm": "node upload-posm-data.js",                    // Load POSM data
    "upload-posm-clear": "node upload-posm-data.js --clear",      // Clear and reload
    "upload-posm-insert": "node upload-posm-data.js --insert-only", // Insert only
    "upload-posm-update": "node upload-posm-data.js --update-only", // Update only
    "upload-posm-upsert": "node upload-posm-data.js --upsert",    // Upsert operation

    // User management utilities
    "import-users": "node import-users.js",                       // Import users from CSV
    "create-super-admin": "node import-users.js --create-super-admin", // Create admin

    // Code quality
    "lint": "eslint src --ext .js --max-warnings=0",              // Strict linting
    "lint:fix": "eslint src --ext .js --fix",                     // Auto-fix linting
    "format": "prettier --write .",                               // Format all files
    "format:check": "prettier --check ."                          // Check formatting
  }
}
```

### Production Deployment

#### Environment Configuration

```bash
# Production environment variables
NODE_ENV=production
PORT=8080

# Database (use MongoDB Atlas for production)
MONGODB_URI=mongodb+srv://prod-user:secure-password@production-cluster.mongodb.net/posm-survey?retryWrites=true&w=majority

# JWT secrets (MUST be unique and secure)
JWT_ACCESS_SECRET=production-access-secret-must-be-long-random-string-min-32-chars
JWT_REFRESH_SECRET=production-refresh-secret-must-be-different-long-random-string

# AWS production configuration
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=posm-survey-production-bucket
```

#### Deployment Steps

```bash
# 1. Prepare production environment
git clone <repository>
cd posm-survey-collection
npm ci --only=production              # Install production dependencies

# 2. Configure environment
cp .env.production .env               # Copy production config
vim .env                              # Verify all variables

# 3. Initialize data
npm run create-super-admin            # Create initial admin account
npm run upload-posm                   # Load POSM data
npm run import-users                  # Load initial users (optional)

# 4. Start application
npm start                            # Production mode

# OR with PM2 for production
npm install -g pm2
pm2 start server.js --name "posm-survey"
pm2 startup                          # Configure auto-start
pm2 save                            # Save configuration
```

#### Docker Deployment (Optional)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

#### Database Migration Scripts

For production deployments, use the included migration utilities:

```bash
# Clear and reload POSM data
npm run upload-posm-clear

# Update existing POSM data
npm run upload-posm-update

# Full reset (WARNING: destructive)
npm run upload-posm -- --clear --insert
```

### Monitoring & Health Checks

#### Built-in Debug Endpoints

```javascript
// Available in development mode (server.js:42-130)
GET /debug/users/count        // User statistics
GET /debug/users/list         // Sample user listing
GET /debug/users/admins       // Admin user listing
GET /debug/stores/ids         // Sample store data
```

#### Application Health Monitoring

```javascript
// Add to server.js for production monitoring
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV
  });
});

// Database connectivity check
app.get('/health/db', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ database: 'connected' });
  } catch (error) {
    res.status(500).json({ database: 'disconnected', error: error.message });
  }
});
```

---

## Development Guidelines

### Code Standards & Best Practices

#### JavaScript Conventions

```javascript
// Naming conventions
const camelCaseVariables = true;                    // Variables and functions
const PascalCaseClasses = true;                     // Classes and constructors
const UPPER_CASE_CONSTANTS = true;                  // Constants
const kebabCaseFiles = true;                        // File names

// Function naming patterns
const isAuthenticated = () => {};                   // Boolean functions: is*, has*, can*
const getUserData = () => {};                       // Action functions: get*, set*, create*
const validateInput = () => {};                     // Action functions: validate*, process*

// Async/await preference
const fetchUserData = async (userId) => {           // Prefer async/await over Promises
  try {
    const user = await User.findById(userId);
    return user;
  } catch (error) {
    console.error('User fetch error:', error);
    throw error;
  }
};
```

#### Error Handling Standards

```javascript
// Controller error handling pattern
const createUser = async (req, res, next) => {
  try {
    const userData = req.body;
    
    // Validate input
    const validationErrors = validateUserData(userData);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Business logic
    const user = await User.create(userData);

    // Success response
    res.status(201).json({
      success: true,
      data: user,
      message: 'User created successfully'
    });
  } catch (error) {
    // Pass to global error handler
    next(error);
  }
};
```

#### Database Query Patterns

```javascript
// Efficient querying with proper indexing
const searchStores = async (searchTerm, options = {}) => {
  const {
    page = 1,
    limit = 10,
    region = null,
    province = null
  } = options;

  const query = {
    isActive: true,
    ...(searchTerm && {
      $or: [
        { store_name: { $regex: searchTerm, $options: 'i' } },
        { store_id: { $regex: searchTerm, $options: 'i' } }
      ]
    }),
    ...(region && { region }),
    ...(province && { province })
  };

  const stores = await Store
    .find(query)
    .select('store_id store_name channel region province')  // Select only needed fields
    .sort({ store_name: 1 })                               // Consistent sorting
    .skip((page - 1) * limit)                              // Pagination
    .limit(limit);

  const total = await Store.countDocuments(query);

  return {
    stores,
    total,
    page,
    pages: Math.ceil(total / limit)
  };
};
```

### Frontend Development Guidelines

#### Class-Based Component Structure

```javascript
// Standard component class pattern
class ComponentApp {
  constructor() {
    this.state = {};                    // Component state
    this.elements = {};                 // DOM element cache
    this.config = {};                   // Component configuration
    this.init();
  }

  async init() {
    await this.checkAuthentication();   // Authentication check
    this.cacheElements();               // DOM element caching
    this.bindEvents();                  // Event listener binding
    this.loadInitialData();             // Initial data loading
  }

  cacheElements() {
    // Cache frequently used DOM elements
    this.elements = {
      container: document.getElementById('container'),
      form: document.getElementById('mainForm'),
      submitButton: document.getElementById('submitBtn')
    };
  }

  bindEvents() {
    // Event delegation and binding
    this.elements.form.addEventListener('submit', this.handleSubmit.bind(this));
    this.elements.container.addEventListener('click', this.handleClick.bind(this));
  }

  async handleSubmit(event) {
    event.preventDefault();
    // Form submission logic
  }

  handleClick(event) {
    // Event delegation for dynamic elements
    if (event.target.matches('.delete-btn')) {
      this.handleDelete(event.target.dataset.id);
    }
  }
}

// Initialize component when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ComponentApp();
});
```

#### API Communication Patterns

```javascript
// Standardized API client
class ApiClient {
  static getAuthHeaders() {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  }

  static async request(url, options = {}) {
    const config = {
      headers: this.getAuthHeaders(),
      ...options
    };

    try {
      const response = await fetch(url, config);
      
      // Handle token expiration
      if (response.status === 401) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry request with new token
          config.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;
          return fetch(url, config);
        } else {
          // Redirect to login
          window.location.href = '/login.html';
          return;
        }
      }

      return response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  static async get(url) {
    return this.request(url, { method: 'GET' });
  }

  static async post(url, data) {
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async put(url, data) {
    return this.request(url, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  static async delete(url) {
    return this.request(url, { method: 'DELETE' });
  }
}
```

### Security Best Practices

#### Input Validation & Sanitization

```javascript
// Server-side input validation
const validateUserInput = (userData) => {
  const errors = [];

  // Required field validation
  if (!userData.username || userData.username.trim().length < 2) {
    errors.push('Username must be at least 2 characters');
  }

  // Email validation (if applicable)
  if (userData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
    errors.push('Invalid email format');
  }

  // Password strength validation
  if (userData.password && userData.password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  // SQL injection prevention (MongoDB is less susceptible, but still validate)
  const dangerousChars = /[<>'"]/;
  Object.values(userData).forEach(value => {
    if (typeof value === 'string' && dangerousChars.test(value)) {
      errors.push('Input contains invalid characters');
    }
  });

  return errors;
};

// Client-side sanitization
const sanitizeInput = (input) => {
  return input
    .trim()                                    // Remove whitespace
    .replace(/[<>'"]/g, '')                    // Remove potentially dangerous chars
    .substring(0, 255);                        // Limit length
};
```

#### Authentication Security

```javascript
// Secure password hashing (already implemented in User model)
const saltRounds = 12;                         // High salt rounds for security
const hashedPassword = await bcrypt.hash(password, saltRounds);

// JWT security configuration
const jwtOptions = {
  expiresIn: '15m',                            // Short access token expiry
  issuer: 'posm-survey-app',                   // Token issuer validation
  audience: 'posm-survey-users',               // Token audience validation
  algorithm: 'HS256'                           // Secure algorithm
};

// Secure token storage (frontend)
// Note: localStorage has XSS risks, consider httpOnly cookies for production
const storeToken = (token) => {
  // In production, consider using secure httpOnly cookies
  localStorage.setItem('accessToken', token);
};
```

### Testing Guidelines

#### Unit Testing Structure

```javascript
// Example test structure (not implemented but recommended)
const request = require('supertest');
const app = require('../server');
const User = require('../src/models/User');

describe('User Authentication', () => {
  beforeEach(async () => {
    await User.deleteMany({});                 // Clean database
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      // Create test user
      const testUser = new User({
        userid: 'test001',
        username: 'Test User',
        loginid: 'test@example.com',
        password: 'password123',
        role: 'user'
      });
      await testUser.save();

      // Test login
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          loginid: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.user.loginid).toBe('test@example.com');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          loginid: 'invalid@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid');
    });
  });
});
```

---

## Troubleshooting

### Common Issues & Solutions

#### Database Connection Issues

**Problem**: `MongoNetworkError: connect ENOTFOUND`

```bash
# Solution steps:
1. Check MongoDB URI format:
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>

2. Verify MongoDB Atlas network access:
   - Add your IP to Atlas IP allowlist
   - Or allow access from anywhere: 0.0.0.0/0 (not recommended for production)

3. Test connection string:
   npm install -g mongodb-client
   mongosh "mongodb+srv://<your-connection-string>"

4. Check environment variables:
   echo $MONGODB_URI
```

#### JWT Authentication Errors

**Problem**: `TokenExpiredError` or `JsonWebTokenError`

```javascript
// Debug JWT issues:
const jwt = require('jsonwebtoken');

// Check token validity
const token = 'your-token-here';
try {
  const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  console.log('Token is valid:', decoded);
} catch (error) {
  console.log('Token error:', error.name, error.message);
}

// Common solutions:
// 1. Check JWT_ACCESS_SECRET matches between token creation and verification
// 2. Ensure token hasn't expired (15-minute default)
// 3. Verify token format: "Bearer <token>"
// 4. Check for token corruption during storage/transmission
```

#### File Upload Issues

**Problem**: S3 upload failures or CORS errors

```javascript
// Debug S3 configuration:
const AWS = require('aws-sdk');

// Test S3 credentials
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

s3.listBuckets((error, data) => {
  if (error) {
    console.error('S3 credentials error:', error);
  } else {
    console.log('S3 buckets:', data.Buckets);
  }
});

// CORS configuration for S3 bucket:
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST", "GET"],
    "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
    "ExposeHeaders": []
  }
]
```

#### Permission & Role Issues

**Problem**: 403 Forbidden errors or access denied

```javascript
// Debug user permissions:
const debugUserPermissions = async (userId) => {
  const user = await User.findById(userId).populate('assignedStores');
  console.log('User details:', {
    id: user._id,
    role: user.role,
    isActive: user.isActive,
    assignedStores: user.assignedStores.length,
    leader: user.leader
  });

  // Check role hierarchy
  if (user.leader) {
    const leader = await User.findOne({ username: user.leader });
    console.log('Leader details:', {
      username: leader?.username,
      role: leader?.role,
      isActive: leader?.isActive
    });
  }
};

// Role permission matrix check:
const checkPermission = (userRole, requiredRoles) => {
  const hasPermission = requiredRoles.includes(userRole);
  console.log(`User role '${userRole}' ${hasPermission ? 'has' : 'lacks'} permission for roles: ${requiredRoles.join(', ')}`);
  return hasPermission;
};
```

#### Performance Issues

**Problem**: Slow database queries or API responses

```javascript
// Enable MongoDB query profiling:
// In MongoDB shell:
db.setProfilingLevel(2); // Profile all operations
db.system.profile.find().limit(5).sort({ts:-1}); // View slow queries

// Add query performance monitoring:
const mongoose = require('mongoose');

mongoose.set('debug', (collectionName, method, query, doc) => {
  console.log(`MongoDB Query: ${collectionName}.${method}`, JSON.stringify(query));
});

// Optimize common queries with indexes:
// In MongoDB shell:
db.users.createIndex({ userid: 1, isActive: 1 });
db.stores.createIndex({ store_name: "text", store_id: "text" });
db.surveyresponses.createIndex({ submittedAt: -1, leader: 1 });
```

#### Frontend JavaScript Errors

**Problem**: Console errors or broken functionality

```javascript
// Debug authentication state:
const debugAuth = () => {
  const token = localStorage.getItem('accessToken');
  const user = localStorage.getItem('user');
  
  console.log('Auth Debug:', {
    hasToken: !!token,
    tokenLength: token?.length,
    hasUser: !!user,
    userData: user ? JSON.parse(user) : null
  });

  // Check token expiration
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isExpired = payload.exp * 1000 < Date.now();
      console.log('Token expiry:', new Date(payload.exp * 1000), 'Expired:', isExpired);
    } catch (error) {
      console.error('Token parse error:', error);
    }
  }
};

// Debug API calls:
const originalFetch = window.fetch;
window.fetch = (...args) => {
  console.log('API Call:', args[0], args[1]?.method || 'GET');
  return originalFetch(...args).then(response => {
    if (!response.ok) {
      console.error('API Error:', response.status, response.statusText);
    }
    return response;
  });
};
```

### Environment-Specific Troubleshooting

#### Development Environment

```bash
# Common development issues:

# 1. Port already in use
lsof -ti:3000 | xargs kill -9          # Kill process on port 3000

# 2. Node modules corruption
rm -rf node_modules package-lock.json
npm install

# 3. Environment variable issues
echo $MONGODB_URI                       # Check if variables are set
source .env                             # Reload environment (if using bash)

# 4. MongoDB connection in development
# Use local MongoDB or Atlas with development cluster
```

#### Production Environment

```bash
# Production-specific troubleshooting:

# 1. Check application logs
tail -f /var/log/posm-survey/app.log

# 2. Monitor system resources
htop                                    # CPU and memory usage
df -h                                   # Disk space
netstat -tulpn | grep :3000            # Port status

# 3. Database connection issues
# Ensure production IP is whitelisted in MongoDB Atlas
# Check firewall settings for outbound connections

# 4. SSL/HTTPS issues (if applicable)
# Verify SSL certificate validity
# Check reverse proxy configuration (nginx/Apache)
```

### Logging & Monitoring

#### Application Logging

```javascript
// Add structured logging to your application:
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// In development, also log to console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Usage in controllers:
const createUser = async (req, res) => {
  try {
    logger.info('Creating new user', { 
      userid: req.body.userid,
      role: req.body.role,
      createdBy: req.user.username 
    });
    
    const user = await User.create(req.body);
    
    logger.info('User created successfully', { 
      userid: user.userid,
      id: user._id 
    });
    
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('User creation failed', { 
      error: error.message,
      stack: error.stack,
      requestBody: req.body 
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'User creation failed' 
    });
  }
};
```

---

This comprehensive guideline provides detailed documentation of your POSM Survey Collection System, covering all aspects from architecture to troubleshooting. New developers and AI systems can use this as a complete reference for understanding and working with your codebase.

For additional questions or clarifications about specific components, refer to the inline code comments and the individual source files mentioned throughout this guide.