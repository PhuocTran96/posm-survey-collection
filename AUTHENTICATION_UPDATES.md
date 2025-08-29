# Authentication System Updates

## Overview
The authentication system has been updated to implement the following requirements:
- **JWT Access Token**: Extended expiration from 15 minutes to 7 days
- **Session Timeout**: 60 minutes of inactivity before automatic logout
- **Enhanced Security**: Improved session management and automatic token refresh

## Changes Made

### 1. JWT Token Configuration
**File:** `src/middleware/auth.js`

```javascript
// Updated token expiry times
const ACCESS_TOKEN_EXPIRY = '7d'; // Changed from '15m' to '7d'
const REFRESH_TOKEN_EXPIRY = '7d'; // Remains 7 days
const SESSION_TIMEOUT = 60 * 60 * 1000; // 60 minutes in milliseconds
```

### 2. Activity Tracking
**Enhancement:** JWT payload now includes `lastActivity` timestamp

```javascript
const payload = {
  id: user._id,
  userid: user.userid,
  username: user.username,
  loginid: user.loginid,
  role: user.role,
  leader: user.leader,
  lastActivity: now.getTime(), // New field for session management
};
```

### 3. Session Timeout Verification
**Enhancement:** Token verification now checks for session inactivity

```javascript
// Check for session timeout (60 minutes of inactivity)
const now = Date.now();
const lastActivity = decoded.lastActivity || decoded.iat * 1000;

if (now - lastActivity > SESSION_TIMEOUT) {
  return res.status(401).json({
    success: false,
    message: 'Session expired due to inactivity',
    code: 'SESSION_TIMEOUT',
  });
}
```

### 4. Activity Update Middleware
**New Feature:** `updateActivity` middleware automatically refreshes tokens

```javascript
const updateActivity = async (req, res, next) => {
  if (req.user && req.tokenData) {
    const now = Date.now();
    const lastActivity = req.tokenData.lastActivity || req.tokenData.iat * 1000;
    
    // Update activity if more than 5 minutes have passed
    if (now - lastActivity > 5 * 60 * 1000) {
      const newTokens = generateTokens(req.user);
      res.setHeader('X-New-Access-Token', newTokens.accessToken);
    }
  }
  next();
};
```

### 5. Client-Side Improvements
**File:** `public/script.js`

- **Session Timeout Handling**: Immediate logout on `SESSION_TIMEOUT` error
- **Automatic Token Updates**: Client checks for new tokens in response headers
- **Enhanced Error Messages**: Better user feedback for different timeout scenarios

```javascript
// Handle session timeout specifically
if (errorData.code === 'SESSION_TIMEOUT') {
  this.clearAuthData();
  this.redirectToLogin('Session expired due to inactivity. Please login again.');
  return null;
}

// Check for new access token in response headers
const newToken = response.headers.get('X-New-Access-Token');
if (newToken) {
  console.log('🔄 Updating access token due to activity');
  localStorage.setItem('accessToken', newToken);
}
```

## Route Updates

The following routes have been updated with activity tracking middleware:

### Updated Route Files:
- `src/routes/authRoutes.js`
- `src/routes/surveyRoutes.js`
- `src/routes/storeRoutes.js`
- `src/routes/uploadRoutes.js`

### Middleware Chain:
```javascript
// Standard protected route pattern
router.get('/endpoint', verifyToken, updateActivity, requireRole, controller);
```

## Security Features

### 1. Session Management
- **Inactivity Timeout**: 60 minutes of inactivity automatically logs out users
- **Activity Tracking**: Server tracks user activity timestamps
- **Token Refresh**: Tokens are refreshed every 5 minutes during active use

### 2. Enhanced Token Security
- **Longer Token Life**: 7-day tokens reduce frequency of authentication requests
- **Automatic Refresh**: Seamless token updates without user intervention
- **Secure Logout**: Proper token cleanup on session expiration

### 3. Client-Side Security
- **Immediate Logout**: Session timeouts trigger immediate authentication clearing
- **Error-Specific Handling**: Different responses for various authentication failures
- **Local Storage Management**: Proper cleanup of authentication data

## API Response Codes

### New Authentication Error Codes:
- `SESSION_TIMEOUT`: User session expired due to 60 minutes of inactivity
- `TOKEN_EXPIRED`: JWT token has reached its 7-day expiration
- `NO_TOKEN`: No authentication token provided
- `INVALID_TOKEN`: Token is malformed or invalid
- `USER_NOT_FOUND`: User associated with token no longer exists
- `ACCOUNT_DEACTIVATED`: User account has been deactivated

## Usage Examples

### 1. Standard API Request
```javascript
// Client automatically handles token updates
const response = await app.authenticatedFetch('/api/stores');
```

### 2. Session Timeout Scenario
```javascript
// Server Response (401 with SESSION_TIMEOUT)
{
  "success": false,
  "message": "Session expired due to inactivity",
  "code": "SESSION_TIMEOUT"
}

// Client automatically redirects to login
```

### 3. Activity Update
```javascript
// Server sends new token in header
Response Headers: {
  "X-New-Access-Token": "eyJhbGciOiJIUzI1NiIs..."
}

// Client automatically updates localStorage
```

## Testing

### Test Script
Run the authentication test script to verify functionality:
```bash
node test-auth-updates.js
```

### Manual Testing
1. Login to the application
2. Wait 60+ minutes without activity
3. Try to perform any action
4. Verify automatic logout and redirect to login page

## Backward Compatibility

- **Refresh Token Logic**: Existing refresh token functionality remains intact
- **API Endpoints**: All existing endpoints continue to work
- **Client Libraries**: No changes required for API consumers

## Environment Variables

No new environment variables are required. The system uses existing JWT secrets:
- `JWT_ACCESS_SECRET`: Secret for access token signing
- `JWT_REFRESH_SECRET`: Secret for refresh token signing

## Performance Impact

- **Minimal Overhead**: Activity tracking adds negligible server processing
- **Reduced API Calls**: 7-day tokens reduce authentication API requests
- **Smart Updates**: Tokens only refresh when needed (5+ minutes of activity)

## Monitoring

### Log Messages
- Activity updates: `🔄 Updating access token due to activity`
- Session timeouts: `Session expired due to inactivity`
- Token generation: `Token refreshed successfully`

### Headers to Monitor
- `X-New-Access-Token`: Indicates automatic token refresh
- Standard JWT expiration and validation errors

---

## Implementation Checklist

- [x] ✅ JWT access token expiration updated to 7 days
- [x] ✅ Session timeout implemented (60 minutes inactivity)
- [x] ✅ Activity tracking middleware created
- [x] ✅ Client-side session timeout handling
- [x] ✅ Automatic token refresh functionality
- [x] ✅ Route middleware updates
- [x] ✅ Error code differentiation
- [x] ✅ Logout redirect improvements
- [x] ✅ Testing and documentation

**Status: ✅ Complete**