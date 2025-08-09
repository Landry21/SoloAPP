import os
import sys
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings")
django.setup()

from django.core.management import call_command
from django.contrib.auth.models import User

print("Starting Railway setup...")

try:
    print("1. Importing data...")
    call_command("import_data")
    print("✅ Data import completed")
    
    print("2. Creating admin user...")
    if not User.objects.filter(username="admin").exists():
        admin_user = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="admin123",
            first_name="Admin",
            last_name="User"
        )
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.save()
        print("✅ Admin user created: admin / admin123")
    else:
        print("✅ Admin user already exists")
    
    print("3. Resetting passwords...")
    call_command("reset_passwords")
    print("✅ Passwords reset completed")
    
    print("🎉 Railway setup completed successfully!")
    print("Admin login: admin / admin123")
    
except Exception as e:
    print(f"❌ Error during setup: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
