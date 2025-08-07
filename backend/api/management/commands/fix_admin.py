from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = 'Check and fix admin user'

    def handle(self, *args, **options):
        self.stdout.write('Checking admin user...')
        
        # Check if admin user exists
        try:
            admin_user = User.objects.get(username='admin')
            self.stdout.write(f'Admin user found: {admin_user.username}')
            self.stdout.write(f'Is staff: {admin_user.is_staff}')
            self.stdout.write(f'Is superuser: {admin_user.is_superuser}')
            self.stdout.write(f'Is active: {admin_user.is_active}')
            
            # Reset password
            admin_user.set_password('admin123')
            admin_user.is_staff = True
            admin_user.is_superuser = True
            admin_user.is_active = True
            admin_user.save()
            
            self.stdout.write(self.style.SUCCESS('Admin password reset to: admin123'))
            self.stdout.write(self.style.SUCCESS('Admin user is now staff and superuser'))
            
        except User.DoesNotExist:
            self.stdout.write('Admin user not found. Creating new admin user...')
            
            # Create new admin user
            admin_user = User.objects.create_user(
                username='admin',
                email='admin@example.com',
                password='admin123',
                first_name='Admin',
                last_name='User'
            )
            admin_user.is_staff = True
            admin_user.is_superuser = True
            admin_user.save()
            
            self.stdout.write(self.style.SUCCESS('New admin user created with password: admin123'))
        
        # List all users
        self.stdout.write('\nAll users in database:')
        for user in User.objects.all():
            self.stdout.write(f'- {user.username} (staff: {user.is_staff}, superuser: {user.is_superuser}, active: {user.is_active})')
