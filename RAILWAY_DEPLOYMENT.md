# Railway Deployment Guide for SoloApp

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Authorize Railway to access your repositories

### Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your `FirstApp` repository
4. Railway will automatically detect it's a Django project

### Step 3: Add PostgreSQL Database
1. In your project, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway will create a PostgreSQL database
4. The `DATABASE_URL` will be automatically available

### Step 4: Set Environment Variables
1. Click on your Django service
2. Go to "Variables" tab
3. Add these variables:

```
SECRET_KEY=g2k5t(vk86w+^j#p0oy+^^--kx36yq5(3_=ssoi_cgzrtwszs6
DEBUG=False
ENVIRONMENT=production
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app
ALLOWED_HOSTS=your-backend-domain.railway.app
REACT_APP_API_BASE_URL=https://your-backend-domain.railway.app/api
REACT_APP_MEDIA_BASE_URL=https://your-backend-domain.railway.app
```

### Step 5: Connect Database
1. In your Django service, go to "Variables"
2. Click "Reference Variable"
3. Select your PostgreSQL database
4. Railway will automatically add `DATABASE_URL`

### Step 6: Deploy
1. Railway will automatically deploy when you push to GitHub
2. Or click "Deploy" to deploy immediately
3. Your backend will be live at: `https://your-backend-domain.railway.app`

## 🔧 Frontend Deployment

### Option 1: Vercel (Recommended)
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Set environment variables:
   ```
   REACT_APP_API_BASE_URL=https://your-backend-domain.railway.app/api
   REACT_APP_MEDIA_BASE_URL=https://your-backend-domain.railway.app
   ```
4. Deploy

### Option 2: Netlify
1. Go to [netlify.com](https://netlify.com)
2. Import your GitHub repository
3. Set environment variables (same as Vercel)
4. Deploy

## 🌐 Update Domains

Once deployed, update your Railway variables with the actual domains:

```
CORS_ALLOWED_ORIGINS=https://your-app.vercel.app
ALLOWED_HOSTS=your-app.railway.app
REACT_APP_API_BASE_URL=https://your-app.railway.app/api
REACT_APP_MEDIA_BASE_URL=https://your-app.railway.app
```

## ✅ Verification

Your app should be accessible at:
- **Backend API**: `https://your-app.railway.app/api/`
- **Frontend**: `https://your-app.vercel.app`

## 🆘 Troubleshooting

### Common Issues:
1. **Database connection error**: Make sure PostgreSQL is connected to your service
2. **CORS errors**: Update `CORS_ALLOWED_ORIGINS` with your frontend domain
3. **Build errors**: Check Railway logs for specific error messages

### Support:
- Check Railway logs in the "Deployments" tab
- Verify environment variables are set correctly
- Test database connectivity 