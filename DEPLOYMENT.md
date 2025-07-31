# SoloApp Deployment Guide

## 🚀 Quick Start

This project is **ready for CI/CD deployment**. The following files have been prepared:

### ✅ What's Ready for CI/CD:

1. **Environment Configuration** - `backend/env.example`
2. **Production Settings** - Updated `backend/backend/settings.py`
3. **Frontend Config** - `barber-app/src/config/config.js`
4. **Deployment Script** - `deploy.sh`
5. **CI/CD Workflow** - `.github/workflows/deploy.yml`

## 📋 Pre-Deployment Checklist

### Local Development (Optional):
- [ ] Remove console.log statements: `find barber-app/src -name "*.js" -exec sed -i '' '/console\.log/d' {} \;`
- [ ] Remove print statements: `find backend -name "*.py" -exec sed -i '' '/print(/d' {} \;`
- [ ] Test locally with production settings

### CI/CD Environment Setup:
- [ ] Set up PostgreSQL database
- [ ] Configure environment variables
- [ ] Set up domain and SSL certificates
- [ ] Configure web server (nginx/Apache)

## 🔧 Environment Variables

### Backend Variables (set in CI/CD):
```bash
ENVIRONMENT=production
SECRET_KEY=your-super-secret-key-here
DEBUG=False
DB_NAME=barberapp_prod
DB_USER=barberapp_user
DB_PASSWORD=your-secure-password
DB_HOST=your-db-host.com
DB_PORT=5432
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
```

### Frontend Variables (set in CI/CD):
```bash
REACT_APP_API_BASE_URL=https://yourdomain.com/api
REACT_APP_MEDIA_BASE_URL=https://yourdomain.com
```

## 🚀 Deployment Options

### Option 1: GitHub Actions (Recommended)
1. Push code to GitHub
2. Set up repository secrets with environment variables
3. The workflow will automatically deploy on push to main/master

### Option 2: Manual Deployment
1. Set environment variables
2. Run: `chmod +x deploy.sh && ./deploy.sh`

### Option 3: Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

## 🔒 Security Considerations

### Production Security:
- ✅ Environment variables for secrets
- ✅ CORS configuration
- ✅ Allowed hosts restriction
- ✅ Debug mode disabled
- ⚠️ SSL certificates (configure after deployment)
- ⚠️ Database security (configure in production)

### Post-Deployment:
- [ ] Set up SSL certificates
- [ ] Configure database backups
- [ ] Set up monitoring
- [ ] Configure logging
- [ ] Set up error tracking

## 📊 Monitoring & Maintenance

### Health Checks:
- Backend: `GET /api/health/`
- Frontend: Static file serving
- Database: Connection pool monitoring

### Logs:
- Backend: Django logs
- Frontend: Web server logs
- Database: PostgreSQL logs

## 🆘 Troubleshooting

### Common Issues:
1. **CORS errors** - Check CORS_ALLOWED_ORIGINS
2. **Database connection** - Verify DB credentials
3. **Static files** - Run `python manage.py collectstatic`
4. **Media files** - Configure web server for media serving

### Support:
- Check logs for detailed error messages
- Verify environment variables are set correctly
- Test database connectivity
- Check web server configuration

## 🎯 Next Steps

After successful deployment:
1. Set up monitoring (Sentry, LogRocket, etc.)
2. Configure backups
3. Set up staging environment
4. Implement feature flags
5. Add performance monitoring 