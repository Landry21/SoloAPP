from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = 'Reset passwords for all users'

    def handle(self, *args, **options):
        self.stdout.write('Resetting passwords for all users...')
        
        # Reset admin password
        try:
            admin_user = User.objects.get(username='admin')
            admin_user.set_password('admin123')
            admin_user.save()
            self.stdout.write(self.style.SUCCESS('Admin password reset to: admin123'))
        except User.DoesNotExist:
            self.stdout.write(self.style.WARNING('Admin user not found'))
        
        # Reset other user passwords
        for user in User.objects.exclude(username='admin'):
            if user.username == 'janedoe':
                user.set_password('janedoe123')
                self.stdout.write(f'User {user.username} password reset to: janedoe123')
            elif user.username == 'johndoe':
                user.set_password('johndoe123')
                self.stdout.write(f'User {user.username} password reset to: johndoe123')
            else:
                user.set_password('password123')
                self.stdout.write(f'User {user.username} password reset to: password123')
            user.save()
        
        self.stdout.write(self.style.SUCCESS('All passwords have been reset!')) 