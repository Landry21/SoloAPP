print("DEBUG: Settings file is being loaded!")
print("DEBUG: About to import os")
import os
print("DEBUG: os imported successfully")
print("DEBUG: About to import pathlib")
from pathlib import Path
print("DEBUG: pathlib imported successfully")
print("DEBUG: All imports completed successfully")

# Test simple assignment
print("DEBUG: Testing simple assignment")
test_var = "test"
print(f"DEBUG: test_var = {test_var}")

# Build paths inside the project like this: BASE_DIR / subdir.
print("DEBUG: About to set BASE_DIR")
BASE_DIR = Path(__file__).resolve().parent.parent
print(f"DEBUG: BASE_DIR = {BASE_DIR}")

# Environment detection
print("DEBUG: About to set environment variables")
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT in ["production", "staging"]
IS_TESTING = ENVIRONMENT == "testing"
print(f"DEBUG: Environment variables set - ENVIRONMENT: {ENVIRONMENT}, IS_PRODUCTION: {IS_PRODUCTION}, IS_TESTING: {IS_TESTING}")

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/4.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
print("DEBUG: About to set SECRET_KEY")
SECRET_KEY = os.environ.get("SECRET_KEY", "django-insecure-@+uq5zmt!pgjl8iapu=y74oq1qr0e6ri!zcc9#54yi013yx$jl")
print("DEBUG: SECRET_KEY set")

# SECURITY WARNING: dont run with debug turned on in production!
print("DEBUG: About to set DEBUG")
DEBUG = os.environ.get("DEBUG", "True").lower() == "true" and not IS_PRODUCTION
print(f"DEBUG: DEBUG = {DEBUG}")

print("DEBUG: About to set ALLOWED_HOSTS")
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "*").split(",") if IS_PRODUCTION else ["*"]
print(f"DEBUG: ALLOWED_HOSTS = {ALLOWED_HOSTS}")

# Application definition
print("DEBUG: About to set INSTALLED_APPS")
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "backend.api",
    "rest_framework.authtoken",
]
print("DEBUG: INSTALLED_APPS set successfully")

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # Must be first
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend.urls"

CORS_ALLOW_ALL_ORIGINS = not IS_PRODUCTION  # For development only
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001").split(",") if IS_PRODUCTION else [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "backend.wsgi.application"

# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases
print("DEBUG: About to configure database")
print("DEBUG: DATABASE_URL = " + str(os.environ.get("DATABASE_URL")))
print("DEBUG: ENVIRONMENT = " + str(os.environ.get("ENVIRONMENT")))
print("DEBUG: IS_PRODUCTION = " + str(IS_PRODUCTION))

# Check for DATABASE_URL first (Railway provides this)
DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL:
    # Use DATABASE_URL from Railway
    import dj_database_url
    print("DEBUG: Using DATABASE_URL from Railway")
    try:
        parsed_db = dj_database_url.parse(DATABASE_URL)
        print("DEBUG: Parsed database config: " + str(parsed_db))
        DATABASES = {
            "default": parsed_db
        }
    except Exception as e:
        print("DEBUG: Error parsing DATABASE_URL: " + str(e))
        # Fallback to development
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": "barberapp",
                "USER": "postgres",
                "PASSWORD": "postgres",
                "HOST": "localhost",
                "PORT": "5432",
            }
        }
elif IS_PRODUCTION:
    # Production fallback to individual variables
    print("DEBUG: Using production fallback configuration")
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("DB_NAME", "barberapp"),
            "USER": os.environ.get("DB_USER", "postgres"),
            "PASSWORD": os.environ.get("DB_PASSWORD", "postgres"),
            "HOST": os.environ.get("DB_HOST", "localhost"),
            "PORT": os.environ.get("DB_PORT", "5432"),
        }
    }
else:
    # Development database configuration
    print("DEBUG: Using development database configuration")
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": "barberapp",
            "USER": "postgres",
            "PASSWORD": "postgres",
            "HOST": "localhost",
            "PORT": "5432",
        }
    }

print("DEBUG: Final DATABASES configuration: " + str(DATABASES))

# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.2/howto/static-files/
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "static"

# Default primary key field type
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django REST Framework settings
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

print("DEBUG: Settings file loaded successfully!")

# Force rebuild Tue Aug  5 00:05:12 EDT 2025
