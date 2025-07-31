#!/bin/bash

# Deployment script for SoloApp
# This script can be used in CI/CD environments

set -e  # Exit on any error

echo "🚀 Starting SoloApp deployment..."

# Environment variables (should be set in CI/CD)
ENVIRONMENT=${ENVIRONMENT:-production}
SECRET_KEY=${SECRET_KEY}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT:-5432}
CORS_ALLOWED_ORIGINS=${CORS_ALLOWED_ORIGINS}
ALLOWED_HOSTS=${ALLOWED_HOSTS}

# Frontend environment variables
REACT_APP_API_BASE_URL=${REACT_APP_API_BASE_URL}
REACT_APP_MEDIA_BASE_URL=${REACT_APP_MEDIA_BASE_URL}

echo "📋 Environment: $ENVIRONMENT"

# Backend deployment
echo "🔧 Deploying backend..."

cd backend

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

# Run database migrations
echo "🗄️ Running database migrations..."
python manage.py migrate

# Collect static files
echo "📁 Collecting static files..."
python manage.py collectstatic --noinput

# Create superuser if needed (optional)
# echo "👤 Creating superuser..."
# python manage.py createsuperuser --noinput || true

cd ..

# Frontend deployment
echo "🎨 Deploying frontend..."

cd barber-app

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Build for production
echo "🏗️ Building for production..."
npm run build

cd ..

echo "✅ Deployment completed successfully!"
echo "🌐 Your app should now be accessible at your configured domain." 