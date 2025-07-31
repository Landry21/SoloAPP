from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from django.contrib.gis.db import models as gis_models
from django.contrib.gis.geos import Point

# Create your models here.

class ProfessionalCategory(models.Model):
    """Model representing professional categories in the system"""
    name = models.CharField(max_length=50)
    slug = models.SlugField(unique=True)
    description = models.TextField()
    icon = models.CharField(max_length=50, default='scissors')
    is_active = models.BooleanField(default=True)
    
    class Meta:
        verbose_name_plural = "Professional categories"
        ordering = ['name']
    
    def __str__(self):
        return self.name

class Barber(models.Model):
    """Model representing a barber in the system"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='barber_profile')
    profile_image = models.ImageField(upload_to='barber_profiles/', null=True, blank=True)
    bio = models.TextField(blank=True, default='')
    years_of_experience = models.IntegerField(default=0)
    location = gis_models.PointField(geography=True, null=True)
    address = models.CharField(max_length=255, null=True, blank=True)
    price_range_min = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    price_range_max = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    is_available = models.BooleanField(default=True)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    total_reviews = models.IntegerField(default=0)
    category = models.ForeignKey(ProfessionalCategory, on_delete=models.PROTECT, null=True, blank=True)
    is_paused = models.BooleanField(default=False)
    pause_start_date = models.DateTimeField(null=True, blank=True)
    pause_end_date = models.DateTimeField(null=True, blank=True)
    pause_reason = models.TextField(blank=True, default='')
    
    def __init__(self, *args, **kwargs):
        # Extract latitude and longitude if provided in kwargs
        self._latitude = kwargs.pop('latitude', None)
        self._longitude = kwargs.pop('longitude', None)
        super().__init__(*args, **kwargs)
    
    def save(self, *args, **kwargs):
        # If coordinates are provided but Point isn't set
        if self._latitude is not None and self._longitude is not None:
            try:
                self.location = Point(float(self._longitude), float(self._latitude))
            except (TypeError, ValueError) as e:
                print(f"Error creating Point: {str(e)}")
                print(f"Longitude: {self._longitude} (type: {type(self._longitude)})")
                print(f"Latitude: {self._latitude} (type: {type(self._latitude)})")
                raise
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name}"
    
    @property
    def full_name(self):
        return f"{self.user.first_name} {self.user.last_name}"
    
    @property
    def latitude(self):
        if self.location:
            return self.location.y
        return None
    
    @property
    def longitude(self):
        if self.location:
            return self.location.x
        return None
    
    def calculate_average_rating(self):
        """Calculate the average rating for this barber"""
        reviews = Review.objects.filter(barber=self)
        if not reviews.exists():
            return 0
        return reviews.aggregate(models.Avg('rating'))['rating__avg'] or 0
    
    def generate_bio(self, services):
        """Generate bio from barber details"""
        service_names = [s.get('name', '') for s in services if s.get('name')]
        service_list = ', '.join(service_names)
        
        bio_parts = []
        if self.years_of_experience:
            experience = f"{self.years_of_experience} year{'s' if self.years_of_experience != 1 else ''} of experience"
            bio_parts.append(experience)
        
        if service_list:
            services_text = f"Specializing in {service_list}"
            bio_parts.append(services_text)
        
        if self.price_range_min != self.price_range_max:
            price_range = f"Services ranging from ${self.price_range_min} to ${self.price_range_max}"
            bio_parts.append(price_range)
        
        return '. '.join(bio_parts) if bio_parts else "Professional barber"
    
    def is_account_paused(self):
        """Check if the account is currently paused"""
        if not self.is_paused:
            return False
        
        now = timezone.now()
        if self.pause_start_date and self.pause_end_date:
            return self.pause_start_date <= now <= self.pause_end_date
        
        return self.is_paused
    
    def pause_account(self, duration_days, reason):
        """Pause the account for a specified duration in days"""
        from datetime import timedelta
        
        now = timezone.now()
        self.is_paused = True
        self.pause_start_date = now
        self.pause_end_date = now + timedelta(days=duration_days)
        self.pause_reason = reason
        self.save()
    
    def unpause_account(self):
        """Unpause the account"""
        self.is_paused = False
        self.pause_start_date = None
        self.pause_end_date = None
        self.pause_reason = ''
        self.save()

    def set_coordinates(self, latitude, longitude):
        """Helper method to set coordinates before saving"""
        self._latitude = latitude
        self._longitude = longitude


class Service(models.Model):
    """Model representing service templates that barbers can offer"""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default='')
    base_price = models.DecimalField(max_digits=6, decimal_places=2)
    duration_minutes = models.PositiveIntegerField(default=45)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        
    def __str__(self):
        return f"{self.name} (Base: ${self.base_price})"


class BarberService(models.Model):
    """Model representing services offered by a specific barber with their custom pricing"""
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='services')
    service = models.ForeignKey(Service, on_delete=models.CASCADE)
    price_adjustment = models.DecimalField(max_digits=6, decimal_places=2, default=0.0)
    is_active = models.BooleanField(default=True)
    custom_duration = models.PositiveIntegerField(null=True, blank=True)
    custom_description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['service__name']
        unique_together = ('barber', 'service')
    
    def __str__(self):
        return f"{self.barber.full_name} - {self.service.name} (${self.price_adjustment})"

    @property
    def duration(self):
        """Returns custom duration if set, otherwise service's default duration"""
        return self.custom_duration or self.service.duration_minutes

    @property
    def description(self):
        """Returns custom description if set, otherwise service's default description"""
        return self.custom_description if self.custom_description.strip() else self.service.description


class WorkingHours(models.Model):
    """Model representing a barber's working hours"""
    DAYS_OF_WEEK = [
        ('monday', 'Monday'),
        ('tuesday', 'Tuesday'),
        ('wednesday', 'Wednesday'),
        ('thursday', 'Thursday'),
        ('friday', 'Friday'),
        ('saturday', 'Saturday'),
        ('sunday', 'Sunday'),
    ]
    
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='working_hours')
    day = models.CharField(max_length=10, choices=DAYS_OF_WEEK)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_selected = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ('barber', 'day')
        ordering = ['day', 'start_time']
    
    def __str__(self):
        return f"{self.barber.full_name} - {self.day} ({self.start_time} - {self.end_time})"


class Appointment(models.Model):
    """Model representing a customer appointment with a barber"""
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
    ]
    
    customer = models.CharField(max_length=255)
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='appointments')
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    service = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    notes = models.TextField(blank=True)
    contact_number = models.CharField(max_length=15, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-date', 'start_time']
    
    def __str__(self):
        return f"{self.customer} with {self.barber.full_name} on {self.date} at {self.start_time}"
    
    @property
    def is_past(self):
        appointment_datetime = timezone.make_aware(
            timezone.datetime.combine(self.date, self.start_time)
        )
        return appointment_datetime < timezone.now()


class Review(models.Model):
    """Model representing customer reviews for barbers"""
    customer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews')
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='reviews')
    appointment = models.OneToOneField(Appointment, on_delete=models.SET_NULL, null=True, blank=True)
    rating = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        unique_together = ('customer', 'appointment')
    
    def __str__(self):
        return f"{self.customer.username}'s review for {self.barber.full_name} - {self.rating}/5"


class CustomerProfile(models.Model):
    """Model representing additional customer information"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='customer_profile')
    profile_image = models.ImageField(upload_to='customer_profiles/', null=True, blank=True)
    phone_number = models.CharField(max_length=15, blank=True)
    preferred_barbers = models.ManyToManyField(Barber, related_name='preferred_by', blank=True)
    
    def __str__(self):
        return f"{self.user.username}'s profile"


class BarberPortfolio(models.Model):
    """Model representing barber's portfolio images, supporting both single and group posts"""
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='portfolio')
    image = models.ImageField(upload_to='portfolio/', null=True, blank=True)
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_group = models.BooleanField(default=False)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, related_name='group_images', null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        if self.is_group:
            return f"Portfolio group for {self.barber.user.get_full_name()} at {self.created_at}"
        return f"Portfolio item for {self.barber.user.get_full_name()}"

    @property
    def images(self):
        """Returns all images in a group, including the parent if it has an image"""
        if self.is_group:
            images = list(self.group_images.all())
            if self.image:
                images.insert(0, self)
            return images
        return [self]
