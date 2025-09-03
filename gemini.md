# POSM Survey Collection - Authentication Architecture Analysis

## Executive Summary

The POSM Survey Collection system implements a robust, modern JWT-based authentication architecture with role-based access control (RBAC). The system uses a dual-token approach (access + refresh tokens) with session management, secure password handling via bcrypt, and comprehensive frontend authentication flows.

## Authentication Architecture Overview

### Core Architecture Pattern
- **Backend**: Node.js/Express API with MongoDB/Mongoose following MVC architecture
- **Frontend**: Vanilla HTML/CSS/JavaScript with class-based architecture
- **Authentication Strategy**: JWT (Access + Refresh Tokens) with 60-minute sliding session timeout
- **Security**: bcrypt password hashing (12 salt rounds), role-based access control
- **Session Management**: Token-based with automatic refresh and activity tracking

### End-to-End Authentication Flow

1. **User Login** → Credential validation → Token generation → Local storage → Protected resource access
2. **Token Verification** → Middleware validation → Session timeout check → User status validation
3. **Token Refresh** → Automatic refresh on 401 → New token pair generation → Seamless continuation
4. **Logout** → Token revocation → Storage cleanup → Redirect to login

## Backend Authentication Components

### 1. User Model (`src/models/User.js`)

**Core Schema Fields:**
```javascript
{
  userid: String (required, unique, indexed),
  username: String (required, indexed),
  loginid: String (required, unique, indexed),
  password: String (required, minlength: 6),
  role: String (enum: ['admin', 'user', 'PRT', 'TDS', 'TDL']),
  leader: String (hierarchical relationships),
  isActive: Boolean (default: true),
  lastLogin: Date,
  refreshToken: String,
  refreshTokenExpiry: Date,
  isSuperAdmin: Boolean (default: false),
  assignedStores: [ObjectId] (store references)
}
```

**Security Features:**
- **Password Hashing**: Pre-save hook automatically hashes passwords using `bcrypt.hash()` with 12 salt rounds
- **Password Comparison**: `comparePassword(candidatePassword)` method uses `bcrypt.compare()`
- **Data Security**: `toJSON` transform removes password and refreshToken from API responses
- **Hierarchy Validation**: Pre-save hook validates organizational hierarchy (TDL → TDS → PRT/User)

**Key Methods:**
```javascript
// Password verification
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
}

// Organizational hierarchy
userSchema.methods.getSubordinates = async function() {
  return await User.find({ leader: this.username, isActive: true });
}
```

### 2. Authentication Middleware (`src/middleware/auth.js`)

**Token Management:**
- **Access Token**: 7-day expiry, contains user info + `lastActivity` timestamp
- **Refresh Token**: 7-day expiry, contains minimal user ID data
- **Session Timeout**: 60 minutes of inactivity enforced via `lastActivity` check

**Key Functions:**
```javascript
// Token generation with activity tracking
const generateTokens = (user) => {
  const payload = {
    id: user._id,
    userid: user.userid,
    username: user.username,
    role: user.role,
    lastActivity: Date.now() // Critical for session management
  };
  // Returns { accessToken, refreshToken }
}

// Token verification with session timeout
const verifyToken = async (req, res, next) => {
  // 1. Extract Bearer token
  // 2. Verify JWT signature and expiry
  // 3. Check user exists and is active
  // 4. Enforce 60-minute session timeout
  // 5. Attach user to req.user
}
```

**Role-Based Access Control:**
```javascript
const requireRole = (allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  next();
}

// Pre-defined role middlewares
const requireAdmin = requireRole(['admin']);
const requireSurveyUser = requireRole(['admin', 'user', 'PRT', 'TDS', 'TDL']);
const requireManager = requireRole(['admin', 'TDS', 'TDL']);
```

### 3. Authentication Controller (`src/controllers/authController.js`)

**Login Implementation:**
```javascript
const login = async (req, res) => {
  // 1. Validate input (loginid, password)
  // 2. Find user by loginid (case-insensitive)
  // 3. Check account status (isActive)
  // 4. Verify password using user.comparePassword()
  // 5. Generate token pair
  // 6. Update lastLogin and store refresh token
  // 7. Return tokens + user data (minus sensitive fields)
}
```

**Password Change Implementation:**
```javascript
const changePassword = async (req, res) => {
  // 1. Validate current and new passwords
  // 2. Verify current password
  // 3. Update password (triggers automatic hashing)
  // 4. Clear all refresh tokens (force re-login)
  // 5. Return success message
}
```

**Admin Reset Password** (in `src/controllers/userController.js`):
```javascript
const resetUserPassword = async (req, res) => {
  // 1. Admin-only function for resetting user passwords
  // 2. Validates new password length (minimum 6 characters)
  // 3. Updates password and clears refresh tokens
  // 4. Tracks who performed the reset (updatedBy field)
}
```

### 4. Route Protection (`src/middleware/routeAuth.js`)

**HTML Page Protection:**
```javascript
const protectRoute = (options = {}) => {
  // Smart middleware that:
  // 1. Allows browser navigation (serves HTML)
  // 2. Validates auth headers for API requests
  // 3. Redirects unauthenticated users to appropriate login page
  // 4. Supports role-based page access
}

// Specific page protections
const protectSurveyPage = protectRoute({
  redirectTo: '/login.html',
  allowedRoles: ['admin', 'user', 'PRT', 'TDS', 'TDL']
});

const protectAdminPage = protectRoute({
  redirectTo: '/admin-login.html',
  allowedRoles: ['admin']
});
```

## Frontend Authentication Patterns

### 1. Login Pages Architecture

**User Login (`public/login.html`):**
- **Class-based**: `LoginApp` class manages entire login flow
- **Validation**: Client-side input validation before API calls
- **Error Handling**: Consistent error/success message display
- **Auto-redirect**: Role-based redirection after successful login
- **Token Storage**: Saves accessToken, refreshToken, and user data to localStorage

**Admin Login (`public/admin-login.html`):**
- **Specialized**: `AdminLoginApp` class with admin-specific logic
- **Role Enforcement**: Validates admin role on both frontend and backend
- **Visual Distinction**: Different styling and branding for admin interface

### 2. Authentication State Management

**Token Storage Pattern:**
```javascript
// Login success - store tokens
localStorage.setItem('accessToken', result.data.accessToken);
localStorage.setItem('refreshToken', result.data.refreshToken);
localStorage.setItem('user', JSON.stringify(result.data.user));

// Authentication check
const token = localStorage.getItem('accessToken');
const user = JSON.parse(localStorage.getItem('user'));
```

**Authentication Verification Pattern:**
```javascript
async checkAuthentication() {
  const token = localStorage.getItem('accessToken');
  if (!token) {
    this.redirectToLogin('No access token found');
    return false;
  }

  // Verify token with backend
  const response = await fetch('/api/auth/verify', {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    localStorage.clear();
    this.redirectToLogin('Session expired');
    return false;
  }
  return true;
}
```

### 3. Authenticated API Communication

**Centralized authenticatedFetch Pattern:**
```javascript
async authenticatedFetch(url, options = {}, retryCount = 0) {
  const token = localStorage.getItem('accessToken');
  
  const authOptions = {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  const response = await fetch(url, authOptions);

  // Automatic token refresh on 401
  if (response.status === 401 && retryCount === 0) {
    const refreshSuccess = await this.refreshToken();
    if (refreshSuccess) {
      return await this.authenticatedFetch(url, options, 1);
    }
  }

  return response;
}
```

**Token Refresh Mechanism:**
```javascript
async refreshToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  if (response.ok) {
    const result = await response.json();
    // Update stored tokens
    localStorage.setItem('accessToken', result.data.accessToken);
    localStorage.setItem('refreshToken', result.data.refreshToken);
    return true;
  }
  
  // Refresh failed - clear storage and redirect
  localStorage.clear();
  this.redirectToLogin('Session expired');
  return false;
}
```

## Form Patterns and Validation

### 1. Form Structure Pattern
```html
<form id="loginForm">
  <div class="form-group">
    <label for="loginid">Login ID</label>
    <input type="text" id="loginid" name="loginid" class="form-control" required>
  </div>
  <div class="form-group">
    <label for="password">Password</label>
    <input type="password" id="password" name="password" class="form-control" required>
  </div>
  <button type="submit" class="btn-login">Login</button>
</form>
```

### 2. Error/Success Message Handling
```javascript
showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  const successDiv = document.getElementById('successMessage');
  
  successDiv.style.display = 'none';
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  
  // Auto-hide after 5 seconds
  setTimeout(() => errorDiv.style.display = 'none', 5000);
}

showSuccess(message) {
  const errorDiv = document.getElementById('errorMessage');
  const successDiv = document.getElementById('successMessage');
  
  errorDiv.style.display = 'none';
  successDiv.textContent = message;
  successDiv.style.display = 'block';
}
```

### 3. Loading State Management
```javascript
showLoading() {
  this.isLoading = true;
  document.getElementById('loadingOverlay').style.display = 'flex';
  document.getElementById('loginBtn').disabled = true;
}

hideLoading() {
  this.isLoading = false;
  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('loginBtn').disabled = false;
}
```

## Security Practices Implemented

### 1. Password Security
- **Hashing**: bcrypt with 12 salt rounds (industry standard)
- **Validation**: Minimum 6 characters enforced on both frontend and backend
- **Storage**: Passwords never stored in plaintext
- **Transmission**: HTTPS recommended for production (passwords sent as JSON)

### 2. Token Security
- **JWT Standards**: Proper issuer/audience claims
- **Secrets**: Environment variable configuration (JWT_ACCESS_SECRET, JWT_REFRESH_SECRET)
- **Expiry**: Both access and refresh tokens have 7-day expiry
- **Refresh Logic**: Secure refresh token validation against database storage
- **Session Management**: 60-minute sliding window based on activity

### 3. Access Control
- **Role-Based**: 5-tier role system (admin, user, PRT, TDS, TDL)
- **Hierarchical**: Organizational structure validation (TDL → TDS → PRT/User)
- **Route Protection**: Both API endpoints and HTML pages protected
- **Middleware Chain**: Layered security with verifyToken → requireRole pattern

### 4. Data Protection
- **Field Exclusion**: Automatic removal of sensitive fields (password, refreshToken) from API responses
- **User Status**: Account deactivation support with isActive field
- **Audit Trail**: Track who created/updated users (createdBy, updatedBy fields)
- **Super Admin Protection**: Cannot delete super admin accounts

## API Response Format Standards

All authentication-related API responses follow this consistent structure:
```javascript
{
  success: boolean,
  message: string,
  data: {
    accessToken?: string,
    refreshToken?: string,
    user?: {
      id: string,
      userid: string,
      username: string,
      loginid: string,
      role: string,
      leader: string,
      lastLogin: Date,
      assignedStores?: Array
    }
  },
  error?: string (development only)
}
```

## File Locations and Key Patterns

### Backend Files
- **`src/models/User.js`** - User schema with password hashing and validation
- **`src/middleware/auth.js`** - JWT generation, verification, and RBAC middleware
- **`src/controllers/authController.js`** - Authentication endpoints (login, logout, changePassword, profile)
- **`src/controllers/userController.js`** - User management including admin password reset
- **`src/routes/authRoutes.js`** - Authentication route definitions
- **`src/routes/userRoutes.js`** - User management routes (admin-only)
- **`src/middleware/routeAuth.js`** - HTML page protection middleware

### Frontend Files
- **`public/login.html`** - User login page with `LoginApp` class
- **`public/admin-login.html`** - Admin login page with `AdminLoginApp` class
- **`public/script.js`** - Main survey app with authentication patterns
- **`public/admin.js`** - Admin dashboard with authentication patterns
- **`public/user-management.js`** - User CRUD interface with password reset
- **`public/styles.css`** - General styles including form and message patterns
- **`public/styles-admin.css`** - Admin-specific styles including notification system

### CSS Style Patterns
- **Error Messages**: `.error-message` with red background and left border
- **Success Messages**: `.success-message` with green background and left border
- **Notifications**: `.notification` with fixed positioning and slide-in animation
- **Loading Overlays**: `.loading-overlay` with centered spinner
- **Form Controls**: `.form-control` with consistent styling and focus states

## Existing Password-Related Functionality

### 1. User Self-Service Password Change
- **Endpoint**: `POST /api/auth/change-password`
- **Authentication**: Requires valid access token
- **Validation**: 
  - Current password verification
  - New password minimum 6 characters
  - Automatic bcrypt hashing
- **Security**: Clears all refresh tokens to force re-login across devices

### 2. Admin Password Reset
- **Endpoint**: `POST /api/users/:id/reset-password`
- **Authentication**: Admin role required
- **Implementation**: Simple prompt-based interface in user management
- **Security**: Forces user re-login by clearing refresh tokens
- **Audit**: Tracks who performed the reset via `updatedBy` field

### 3. Password Validation Rules
- **Minimum Length**: 6 characters (enforced on both frontend and backend)
- **Hash Algorithm**: bcrypt with 12 salt rounds
- **Pre-save Hook**: Automatic hashing when password field is modified
- **Comparison**: Secure bcrypt.compare() for verification

## Frontend Class Architecture Patterns

### Base Authentication Pattern
Every protected page follows this pattern:
```javascript
class PageApp {
  constructor() {
    this.user = null;
    this.init();
  }

  async init() {
    const isAuthenticated = await this.checkAuthentication();
    if (!isAuthenticated) return;
    
    this.bindEvents();
    this.setupAuthUI();
    // Page-specific initialization
  }

  async checkAuthentication() {
    // Token validation and user verification
  }

  redirectToLogin(reason) {
    // Smart redirect based on user type
  }

  async authenticatedFetch(url, options, retryCount = 0) {
    // Robust API communication with auto-refresh
  }
}
```

### Form Handling Pattern
```javascript
async handleFormSubmit(e) {
  e.preventDefault();
  if (this.isLoading) return;

  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);

  // Client-side validation
  if (!this.validateForm(data)) return;

  try {
    this.showLoading();
    const response = await this.authenticatedFetch('/api/endpoint', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (response.ok && result.success) {
      this.showSuccess(result.message);
    } else {
      this.showError(result.message);
    }
  } catch (error) {
    this.showError('Network error occurred');
  } finally {
    this.hideLoading();
  }
}
```

## Current Password Change Implementation Analysis

### Backend Implementation (`src/controllers/authController.js`)
```javascript
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = req.user; // From JWT verification

  // Validation
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Current password and new password are required'
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 6 characters long'
    });
  }

  // Get full user data including password
  const fullUser = await User.findById(user._id);

  // Verify current password
  const isCurrentPasswordValid = await fullUser.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    return res.status(401).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Update password (automatic hashing via pre-save hook)
  fullUser.password = newPassword;
  fullUser.updatedBy = user.username;
  await fullUser.save();

  // Security: Clear all refresh tokens to force re-login
  await User.findByIdAndUpdate(user._id, {
    refreshToken: null,
    refreshTokenExpiry: null
  });

  res.json({
    success: true,
    message: 'Password changed successfully. Please login again with your new password.'
  });
}
```

### Current Route Definition
```javascript
// In src/routes/authRoutes.js
router.post('/change-password', authController.changePassword);
```

## Error Handling Patterns

### Backend Error Responses
```javascript
// Consistent error response format
{
  success: false,
  message: 'Human-readable error message',
  code: 'ERROR_CODE', // Optional specific error code
  error: 'Technical details' // Development only
}
```

### Frontend Error Display
- **Login Pages**: Inline error/success messages with auto-hide
- **Admin Pages**: Fixed-position notifications with slide-in animation
- **Form Validation**: Immediate client-side feedback before API calls
- **Network Errors**: Graceful fallback messages for connection issues

## Notification System Architecture

### CSS-Based Notification System
```css
.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 24px;
  border-radius: 6px;
  z-index: 10000;
  animation: slideIn 0.3s ease;
}

.notification.success { background-color: #28a745; }
.notification.error { background-color: #dc3545; }
```

### JavaScript Notification Implementation
```javascript
showNotification(message, type = 'success') {
  // Remove existing notifications
  document.querySelectorAll('.notification').forEach(n => n.remove());
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => notification.remove(), 5000);
}
```

## Recommended Implementation Strategy for Change Password Feature

### 1. Follow Existing Patterns
- **Use existing `changePassword` endpoint** (`POST /api/auth/change-password`)
- **Implement class-based frontend** following `LoginApp`/`AdminApp` patterns
- **Use consistent error/success messaging** with existing CSS classes
- **Follow form validation patterns** with client-side + server-side validation

### 2. UI Integration Options
- **Standalone Page**: Create `change-password.html` similar to login pages
- **Profile Integration**: Add to existing profile/settings area
- **Modal/Popup**: Implement as overlay component

### 3. Security Considerations
- **Force Re-login**: Existing implementation clears refresh tokens
- **Validation**: Leverage existing 6-character minimum rule
- **Error Handling**: Use established error message patterns
- **Session Management**: Integrate with existing 60-minute timeout

### 4. Code Reuse Opportunities
- **Authentication State**: Reuse `checkAuthentication()` pattern
- **API Communication**: Leverage `authenticatedFetch()` helper
- **Form Styling**: Apply existing CSS classes and patterns
- **Message Display**: Use established notification/error display methods

## Architecture Strengths

1. **Consistent Patterns**: Well-established conventions across all components
2. **Security-First**: Proper password hashing, token management, and session control
3. **Separation of Concerns**: Clear MVC architecture with distinct responsibilities
4. **Error Handling**: Comprehensive error management at all layers
5. **User Experience**: Smooth authentication flows with automatic token refresh
6. **Scalability**: Role-based access control supports organizational hierarchy
7. **Maintainability**: Clean code structure with reusable middleware and utilities

## Recommendations for Change Password Feature

### Implementation Approach
1. **Leverage Existing Backend**: The `changePassword` endpoint is already implemented and secure
2. **Create Consistent Frontend**: Follow established class-based patterns
3. **Integrate with Current UI**: Use existing CSS classes and notification system
4. **Maintain Security Standards**: Follow current validation and error handling patterns
5. **Preserve User Experience**: Implement smooth transitions and clear feedback

### Specific Implementation Notes
- **Route**: `POST /api/auth/change-password` (already exists)
- **Frontend Class**: Follow `LoginApp` pattern with form validation
- **Styling**: Reuse `.form-control`, `.error-message`, `.success-message` classes
- **Validation**: Client-side validation + backend enforcement
- **Security**: Automatic logout after password change (existing behavior)
- **Notifications**: Use existing notification system for feedback