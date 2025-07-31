# Generated manually for professional categories - clean approach

from django.db import migrations, models
import django.db.models.deletion


def create_default_categories(apps, schema_editor):
    """Create default professional categories"""
    ProfessionalCategory = apps.get_model('api', 'ProfessionalCategory')
    
    # Create default categories
    barber_category = ProfessionalCategory.objects.create(
        name='Barber',
        slug='barber',
        description='Haircuts, beard trims, and styling',
        icon='scissors'
    )
    
    ProfessionalCategory.objects.create(
        name='Hair Stylist',
        slug='hair-stylist',
        description='Haircuts, coloring, and treatments',
        icon='cut'
    )
    
    ProfessionalCategory.objects.create(
        name='Nail Technician',
        slug='nail-tech',
        description='Manicures, pedicures, and nail art',
        icon='nail-polish'
    )
    
    ProfessionalCategory.objects.create(
        name='Makeup Artist',
        slug='makeup-artist',
        description='Makeup application and lessons',
        icon='makeup'
    )
    
    ProfessionalCategory.objects.create(
        name='Tattoo Artist',
        slug='tattoo-artist',
        description='Tattoos, piercings, and body art',
        icon='tattoo'
    )
    
    # Assign all existing barbers to 'Barber' category
    Barber = apps.get_model('api', 'Barber')
    for barber in Barber.objects.all():
        barber.category = barber_category
        barber.save()


def reverse_migration(apps, schema_editor):
    """Reverse the migration"""
    ProfessionalCategory = apps.get_model('api', 'ProfessionalCategory')
    ProfessionalCategory.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_appointment_contact_number'),
    ]

    operations = [
        # Step 1: Create ProfessionalCategory model
        migrations.CreateModel(
            name='ProfessionalCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50)),
                ('slug', models.SlugField(unique=True)),
                ('description', models.TextField()),
                ('icon', models.CharField(default='scissors', max_length=50)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'verbose_name_plural': 'Professional categories',
                'ordering': ['name'],
            },
        ),
        
        # Step 2: Add category field to Barber model (nullable initially)
        migrations.AddField(
            model_name='barber',
            name='category',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                to='api.professionalcategory'
            ),
        ),
        
        # Step 3: Populate data
        migrations.RunPython(create_default_categories, reverse_migration),
        
        # Step 4: Make category field required (after data is populated)
        migrations.AlterField(
            model_name='barber',
            name='category',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                to='api.professionalcategory'
            ),
        ),
    ] 