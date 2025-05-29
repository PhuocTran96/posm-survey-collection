# POSM Survey System - Production Deployment Guide

## 🚀 Production Setup

### Prerequisites
- Node.js 16+ installed
- MongoDB Atlas account (already configured)
- Git for version control

### Environment Configuration

1. **Environment Variables** (`.env` file):
```env
# MongoDB Configuration
MONGODB_URI=mongodb+srv://admin:xNo9bso92Yvt0r7y@cluster0.bglf6fm.mongodb.net/posm_survey?retryWrites=true&w=majority

# Server Configuration
PORT=3000
NODE_ENV=production

# Application Settings
DB_NAME=posm_survey
```

### Database Setup

**MongoDB Atlas Configuration:**
- **Cluster**: cluster0.bglf6fm.mongodb.net
- **Database**: posm_survey
- **Collections**: 
  - `surveyresponses` (auto-created)
- **Connection**: Already configured with retry logic and connection pooling

### Installation Steps

1. **Clone/Download the project**
```bash
git clone <repository-url>
cd survey-posm
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
# Copy .env file with your MongoDB credentials
cp .env.example .env
# Edit .env with your specific configuration
```

4. **Start the application**
```bash
# Production mode
npm start

# Development mode (with auto-restart)
npm run dev
```

### Production Deployment Options

#### Option 1: Traditional VPS/Server
```bash
# Install PM2 for process management
npm install -g pm2

# Start with PM2
pm2 start server.js --name "posm-survey"

# Save PM2 configuration
pm2 save
pm2 startup
```

#### Option 2: Docker Deployment
Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t posm-survey .
docker run -p 3000:3000 --env-file .env posm-survey
```

#### Option 3: Cloud Platforms

**Heroku:**
```bash
# Install Heroku CLI
heroku create posm-survey-app
heroku config:set MONGODB_URI="your-mongodb-uri"
heroku config:set NODE_ENV=production
git push heroku main
```

**Railway/Render/Vercel:**
- Connect GitHub repository
- Set environment variables in platform dashboard
- Deploy automatically

### Security Considerations

1. **Environment Variables**
   - Never commit `.env` file to version control
   - Use platform-specific environment variable management
   - Rotate MongoDB credentials regularly

2. **MongoDB Security**
   - IP whitelist configured in MongoDB Atlas
   - Strong password authentication
   - Connection encryption enabled

3. **Application Security**
   - Input validation on all endpoints
   - CORS configured appropriately
   - Error messages sanitized in production

### Monitoring & Maintenance

#### Health Checks
```bash
# Check server status
curl http://localhost:3000/api/leaders

# Check MongoDB connection
# Monitor logs for connection status
```

#### Backup Strategy
- **MongoDB Atlas**: Automatic backups enabled
- **Application Data**: Regular exports via admin interface
- **Code**: Version control with Git

#### Performance Monitoring
- Monitor MongoDB Atlas metrics
- Track API response times
- Monitor server resource usage

### Scaling Considerations

#### Horizontal Scaling
- Load balancer configuration
- Multiple server instances
- Session management (stateless design)

#### Database Optimization
- MongoDB indexes on frequently queried fields
- Connection pooling (already configured)
- Query optimization

### Troubleshooting

#### Common Issues

1. **MongoDB Connection Failed**
```bash
# Check network connectivity
ping cluster0.bglf6fm.mongodb.net

# Verify credentials in .env file
# Check MongoDB Atlas IP whitelist
```

2. **Port Already in Use**
```bash
# Find process using port 3000
netstat -ano | findstr :3000
# Kill the process
taskkill /PID <process-id> /F
```

3. **CSV Data Not Loading**
```bash
# Ensure data.csv exists in project root
# Check file permissions
# Verify CSV format matches expected structure
```

#### Log Monitoring
```bash
# View application logs
pm2 logs posm-survey

# MongoDB Atlas logs
# Check in MongoDB Atlas dashboard
```

### API Endpoints

#### Public Endpoints
- `GET /` - Survey interface
- `GET /admin.html` - Admin dashboard
- `GET /api/leaders` - Get all leaders
- `GET /api/shops/:leader` - Get shops by leader
- `GET /api/models/:leader/:shopName` - Get models and POSM
- `POST /api/submit` - Submit survey response

#### Admin Endpoints
- `GET /api/responses` - Get all survey responses

### Data Structure

#### Survey Response Schema
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
  submittedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Maintenance Tasks

#### Regular Tasks
- Monitor disk space
- Check application logs
- Verify backup integrity
- Update dependencies (security patches)

#### Monthly Tasks
- Review MongoDB Atlas metrics
- Analyze survey response patterns
- Performance optimization review

### Support & Contact

For technical issues:
1. Check application logs
2. Verify MongoDB Atlas connection
3. Review this deployment guide
4. Contact system administrator

---

## 🔧 Quick Commands Reference

```bash
# Start application
npm start

# Install dependencies
npm install

# Check application status
curl http://localhost:3000/api/leaders

# View logs (if using PM2)
pm2 logs posm-survey

# Restart application (PM2)
pm2 restart posm-survey

# Stop application (PM2)
pm2 stop posm-survey
```

---

**Last Updated**: $(date)
**Version**: 1.0.0
**Environment**: Production Ready