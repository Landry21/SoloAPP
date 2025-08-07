from django.core.management.base import BaseCommand
from django.core.management import call_command
import json
import os

class Command(BaseCommand):
    help = 'Import data from exported_data.json file'

    def handle(self, *args, **options):
        self.stdout.write('Starting data import...')
        
        # Check if the file exists
        file_path = 'exported_data.json'
        if not os.path.exists(file_path):
            self.stdout.write(
                self.style.ERROR(f'File {file_path} not found!')
            )
            return
        
        # Load the data
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        self.stdout.write(f'Found {len(data)} records to import')
        
        # Import the data using Django's loaddata command
        try:
            call_command('loaddata', file_path, verbosity=0)
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully imported {len(data)} records from {file_path}'
                )
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error importing data: {str(e)}')
            ) 