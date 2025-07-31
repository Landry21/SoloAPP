from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Barber, Service, WorkingHours, 
    Appointment, Review, CustomerProfile, BarberPortfolio, BarberService, ProfessionalCategory
)
from decimal import Decimal, InvalidOperation
from datetime import datetime, time, timedelta


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=6)
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'password')
        read_only_fields = ('id', 'username')


class CustomerProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = CustomerProfile
        fields = ['id', 'user', 'profile_image', 'phone_number', 'preferred_barbers']
        read_only_fields = ['id']


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ['id', 'name', 'description', 'base_price', 'duration_minutes']
        read_only_fields = ['id']


class WorkingHoursSerializer(serializers.ModelSerializer):
    day_name = serializers.CharField(source='get_day_display', read_only=True)
    
    class Meta:
        model = WorkingHours
        fields = ['id', 'barber', 'day', 'day_name', 'start_time', 'end_time', 'is_selected']
        read_only_fields = ['id']


class BarberPortfolioSerializer(serializers.ModelSerializer):
    images = serializers.SerializerMethodField()
    is_group_post = serializers.SerializerMethodField()
    group_images = serializers.SerializerMethodField()
    
    class Meta:
        model = BarberPortfolio
        fields = ['id', 'barber', 'image', 'description', 'created_at', 
                 'is_group', 'is_group_post', 'parent', 'images', 'group_images']
        read_only_fields = ['id', 'created_at']

    def get_is_group_post(self, obj):
        return obj.is_group or obj.parent is not None
    
    def get_images(self, obj):
        if obj.is_group:
            # If this is a group post, return all images in the group
            return [self.get_image_url(img) for img in obj.group_images.all()]
        elif obj.parent:
            # If this is part of a group, return empty list as it will be handled by the parent
            return []
        else:
            # Single post
            return [self.get_image_url(obj)]
    
    def get_group_images(self, obj):
        if obj.is_group:
            # Return all images in the group with their details
            return [{
                'id': img.id,
                'image': self.get_image_url(img),
                'description': img.description
            } for img in obj.group_images.all()]
        return None
    
    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class ReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.username', read_only=True)
    
    class Meta:
        model = Review
        fields = ['id', 'customer', 'customer_name', 'barber', 'rating', 
                 'comment', 'created_at']
        read_only_fields = ['id', 'customer', 'created_at']
        extra_kwargs = {
            'barber': {'required': True},
            'rating': {'required': True, 'min_value': 1, 'max_value': 5},
            'comment': {'required': True}
        }


class BarberServiceSerializer(serializers.ModelSerializer):
    service_details = ServiceSerializer(source='service', read_only=True)
    name = serializers.CharField(source='service.name', read_only=True)
    base_price = serializers.DecimalField(source='service.base_price', max_digits=6, decimal_places=2, read_only=True)
    price_adjustment = serializers.DecimalField(max_digits=6, decimal_places=2, required=False)
    
    class Meta:
        model = BarberService
        fields = ['id', 'service', 'service_details', 'name', 'base_price', 'price_adjustment', 
                 'is_active', 'custom_duration', 'custom_description', 'duration', 'description']
        read_only_fields = ['id', 'name', 'base_price', 'duration', 'description']


class ProfessionalCategorySerializer(serializers.ModelSerializer):
    """Serializer for professional categories"""
    class Meta:
        model = ProfessionalCategory
        fields = ['id', 'name', 'slug', 'description', 'icon']


class BarberSerializer(serializers.ModelSerializer):
    user_details = serializers.SerializerMethodField()
    services = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()
    working_hours = serializers.SerializerMethodField()
    category = ProfessionalCategorySerializer(read_only=True)
    latitude = serializers.FloatField(write_only=True, required=False)
    longitude = serializers.FloatField(write_only=True, required=False)

    class Meta:
        model = Barber
        fields = ('id', 'user_details', 'profile_image', 'bio', 'years_of_experience',
                 'location', 'address', 'price_range_min', 'price_range_max',
                 'average_rating', 'total_reviews', 'services', 'reviews',
                 'latitude', 'longitude', 'working_hours', 'category')
        read_only_fields = ('id', 'average_rating', 'total_reviews')

    def get_user_details(self, obj):
        return {
            'first_name': obj.user.first_name,
            'last_name': obj.user.last_name,
            'email': obj.user.email
        }

    def get_services(self, obj):
        # Use select_related to reduce database queries
        barber_services = BarberService.objects.filter(
            barber=obj, 
            is_active=True
        ).select_related('service')
        
        services_data = []
        for bs in barber_services:
            try:
                price_decimal = bs.price_adjustment if bs.price_adjustment is not None else Decimal('0.00')
                service_data = {
                    'id': bs.id,
                    'name': bs.service.name,
                    'price_adjustment': price_decimal,
                    'duration': bs.duration,
                    'description': bs.description
                }
                services_data.append(service_data)
            except Exception as e:
                # Log error but don't raise to prevent complete failure
                print(f"Error processing service {bs.id}: {str(e)}")
                continue
            
        return services_data

    def get_reviews(self, obj):
        # Use select_related to reduce database queries
        reviews = Review.objects.filter(barber=obj).select_related('customer')
        return [
            {
                'id': review.id,
                'rating': review.rating,
                'comment': review.comment,
                'created_at': review.created_at,
                'customer_name': f"{review.customer.first_name} {review.customer.last_name}"
            }
            for review in reviews
        ]

    def get_working_hours(self, obj):
        """Get working hours for the barber"""
        working_hours = WorkingHours.objects.filter(barber=obj)
        return [
            {
                'day': hours.day,
                'start_time': hours.start_time.strftime('%H:%M'),
                'end_time': hours.end_time.strftime('%H:%M'),
                'is_selected': hours.is_selected
            }
            for hours in working_hours
        ]


class AppointmentSerializer(serializers.ModelSerializer):
    barber_details = BarberSerializer(source='barber', read_only=True)
    is_past_appointment = serializers.BooleanField(source='is_past', read_only=True)
    
    class Meta:
        model = Appointment
        fields = ['id', 'customer', 'barber', 'barber_details', 
                  'service', 'date', 'start_time', 'end_time', 
                  'status', 'contact_number', 'notes', 'created_at', 'updated_at', 'is_past_appointment']
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_past_appointment', 'end_time']

    def create(self, validated_data):
        # Extract start_time and service
        start_time = validated_data.get('start_time')
        service_name = validated_data.get('service')
        barber = validated_data.get('barber')

        # Default duration (in minutes) if not found
        duration_minutes = 30

        # Try to get BarberService (custom duration), else fallback to Service
        if barber and service_name:
            try:
                barber_service = BarberService.objects.select_related('service').get(barber=barber, service__name=service_name)
                duration_minutes = barber_service.duration
            except BarberService.DoesNotExist:
                try:
                    service = Service.objects.get(name=service_name)
                    duration_minutes = service.duration_minutes
                except Service.DoesNotExist:
                    pass  # Use default

        # Calculate end_time
        if start_time and duration_minutes:
            dt = datetime.combine(validated_data['date'], start_time)
            end_dt = dt + timedelta(minutes=duration_minutes)
            validated_data['end_time'] = end_dt.time()

        return super().create(validated_data)


class BarberRegistrationSerializer(serializers.ModelSerializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    username = serializers.CharField(read_only=True)
    professional_category = serializers.IntegerField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ('email', 'password', 'first_name', 'last_name', 'username', 'professional_category')

    def generate_username(self, first_name, last_name):
        # Convert to lowercase and remove spaces
        base_username = f"{first_name.lower()}{last_name.lower()}"
        # Remove special characters
        base_username = ''.join(e for e in base_username if e.isalnum())
        
        # Try the base username first
        if not User.objects.filter(username=base_username).exists():
            return base_username
            
        # If username exists, add a number until we find an available one
        counter = 1
        while User.objects.filter(username=f"{base_username}{counter}").exists():
            counter += 1
        return f"{base_username}{counter}"

    def create(self, validated_data):
        # Extract professional category
        professional_category_id = validated_data.pop('professional_category')
        
        # Generate username from first and last name
        first_name = validated_data.get('first_name', '')
        last_name = validated_data.get('last_name', '')
        username = self.generate_username(first_name, last_name)
        
        # Create user
        user = User.objects.create_user(
            username=username,
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=first_name,
            last_name=last_name
        )
        
        # Get professional category
        try:
            professional_category = ProfessionalCategory.objects.get(id=professional_category_id)
        except ProfessionalCategory.DoesNotExist:
            raise serializers.ValidationError(f"Professional category with ID {professional_category_id} does not exist")
        
        # Create barber profile with category
        Barber.objects.create(
            user=user,
            category=professional_category,
            profile_image=None,
            bio='',
            years_of_experience=0,
            location=None,
            address='',
            price_range_min=0.00,
            price_range_max=0.00,
            is_available=True
        )
        
        return user


class BarberProfileSerializer(serializers.ModelSerializer):
    working_hours = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
        allow_empty=True
    )
    services = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
        allow_empty=True
    )
    address = serializers.CharField(
        max_length=255,
        required=True,
        allow_blank=False,
        error_messages={
            'required': 'Business address is required.',
            'blank': 'Business address cannot be blank.',
            'max_length': 'Business address cannot exceed 255 characters.'
        }
    )
    latitude = serializers.FloatField(write_only=True, required=True)
    longitude = serializers.FloatField(write_only=True, required=True)
    profile_image = serializers.ImageField(
        required=False,
        allow_null=True,
        use_url=True
    )

    class Meta:
        model = Barber
        fields = ('profile_image', 'years_of_experience', 'address', 'latitude', 'longitude', 'services',
                 'working_hours')

    def validate_profile_image(self, value):
        """Validate the profile image"""
        if value is None:
            return value
            
        # Check file size (max 5MB)
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Image file too large ( > 5MB )")
            
        # Check file type
        allowed_types = ['image/jpeg', 'image/png', 'image/gif']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError(
                f"Invalid image type. Allowed types are: {', '.join(allowed_types)}"
            )
            
        return value

    def validate_services(self, services):
        if not services:
            raise serializers.ValidationError("At least one service is required")
            
        validated_services = []
        for service in services:
            if not isinstance(service, dict):
                raise serializers.ValidationError("Each service must be an object")
                
            name = service.get('name')
            price = service.get('price_adjustment')
            
            if not name:
                raise serializers.ValidationError("Service name is required")
                
            if price is None:
                raise serializers.ValidationError(f"Price is required for service: {name}")
                
            try:
                # Convert price to Decimal and validate
                price = Decimal(str(price))
                if price < 0:
                    raise serializers.ValidationError(f"Price cannot be negative for service: {name}")
            except (ValueError, TypeError, InvalidOperation):
                raise serializers.ValidationError(f"Invalid price format for service: {name}")
                
            validated_services.append({
                'name': name,
                'price_adjustment': price
            })
            
        return validated_services

    def validate_working_hours(self, working_hours):
        """Validate the working hours data"""
        print("\n=== Validating Working Hours ===")
        print(f"Input data: {working_hours}")
        
        if not isinstance(working_hours, list):
            raise serializers.ValidationError("Working hours must be a list")
            
        if not working_hours:
            return []
            
        valid_hours = []
        valid_days = [day[0] for day in WorkingHours.DAYS_OF_WEEK]  # Get valid day values
        
        for hours in working_hours:
            print(f"\nProcessing hours entry: {hours}")
            
            if not isinstance(hours, dict):
                raise serializers.ValidationError("Each working hours entry must be an object")
                
            if not hours.get('is_selected', True):
                print("Skipping unselected day")
                continue
                
            day = str(hours.get('day', '')).lower()
            
            # Handle both original and validated data formats
            start = hours.get('start') or hours.get('start_time')
            end = hours.get('end') or hours.get('end_time')
            
            print(f"Day: {day}, Start: {start}, End: {end}")
            
            if not all([day, start, end]):
                raise serializers.ValidationError(
                    f"Day, start time, and end time are required for working hours. Got day={day}, start={start}, end={end}"
                )
            
            # Validate day is in choices
            if day not in valid_days:
                raise serializers.ValidationError(
                    f"Invalid day: {day}. Must be one of: {', '.join(valid_days)}"
                )
            
            # If times are already time objects, use them directly
            if isinstance(start, time) and isinstance(end, time):
                start_time = start
                end_time = end
            else:
                # Validate and convert time format
                try:
                    print(f"Converting times: start={start}, end={end}")
                    start_time = datetime.strptime(str(start), '%H:%M').time()
                    end_time = datetime.strptime(str(end), '%H:%M').time()
                    
                    print(f"Converted times: start_time={start_time}, end_time={end_time}")
                except ValueError as e:
                    print(f"Time conversion error: {str(e)}")
                    raise serializers.ValidationError(
                        f"Invalid time format for {day}. Use HH:MM format. Error: {str(e)}"
                    )
            
            if start_time >= end_time:
                raise serializers.ValidationError(
                    f"End time must be after start time for {day}"
                )
                
            valid_hours.append({
                'day': day,
                'start_time': start_time,
                'end_time': end_time,
                'is_selected': True
            })
            
        print(f"\nValidated hours: {valid_hours}")
        return valid_hours

    def validate_address(self, value):
        """Validate the address field"""
        if not value:
            raise serializers.ValidationError('Business address is required.')
        value = str(value).strip()
        if not value:
            raise serializers.ValidationError('Business address cannot be blank.')
        if len(value) > 255:
            raise serializers.ValidationError('Business address cannot exceed 255 characters.')
        return value

    def validate(self, data):
        # Validate profile image - only required for new profiles (POST), not updates (PATCH)
        if self.context['request'].method == 'POST' and not data.get('profile_image') and not self.instance:
            raise serializers.ValidationError({
                'profile_image': 'A profile image is required.'
            })
        
        # Validate years of experience
        years = data.get('years_of_experience')
        if years is not None:
            try:
                years = int(years)
                if years < 0:
                    raise serializers.ValidationError({
                        'years_of_experience': 'Years of experience cannot be negative.'
                    })
                data['years_of_experience'] = years
            except (ValueError, TypeError):
                raise serializers.ValidationError({
                    'years_of_experience': 'Years of experience must be a valid number.'
                })
            
        # Validate services if provided
        if 'services' in data:
            data['services'] = self.validate_services(data['services'])
            
        # Validate working hours if provided
        if 'working_hours' in data:
            data['working_hours'] = self.validate_working_hours(data['working_hours'])
            
        return data

    def update(self, instance, validated_data):
        working_hours_data = validated_data.pop('working_hours', [])
        services_data = validated_data.pop('services', [])
        address = validated_data.pop('address', None)
        latitude = validated_data.pop('latitude', None)
        longitude = validated_data.pop('longitude', None)

        try:
            # Update basic fields
            for attr, value in validated_data.items():
                setattr(instance, attr, value)

            # Set the address field if provided
            if address:
                instance.address = address
            # Always set the location field if latitude and longitude are provided
                if latitude is not None and longitude is not None:
                    print(f"\nSetting coordinates: lat={latitude}, lon={longitude}")
                instance.longitude = float(longitude)
        instance.latitude = float(latitude)

            # Initialize price range with decimal values
            instance.price_range_min = Decimal('0.00')
            instance.price_range_max = Decimal('0.00')

            # Save the instance before creating related objects
            instance.save()
            
            print(f"\nAfter save in serializer:")
            print(f"Location: {instance.location}")
            print(f"Latitude: {instance.latitude}")
            print(f"Longitude: {instance.longitude}")

            # Delete existing working hours and services
            WorkingHours.objects.filter(barber=instance).delete()
            BarberService.objects.filter(barber=instance).delete()

            # Process services and calculate price range
            if services_data:
                prices = []
                service_creation_errors = []

                # Create services from validated data
                for service_data in services_data:
                    try:
                        # Ensure price is Decimal
                        price = service_data['price_adjustment']
                        if price is None:
                            raise serializers.ValidationError("Price cannot be None")
                            
                        if not isinstance(price, Decimal):
                            try:
                                price = Decimal(str(price))
                            except (ValueError, TypeError, InvalidOperation) as e:
                                raise serializers.ValidationError(f"Invalid price format: {price}")

                        # Create or get the service template
                        service, _ = Service.objects.get_or_create(
                            name=service_data['name'],
                            defaults={
                                'base_price': price,
                                'duration_minutes': 45
                            }
                        )

                        # Create the barber service with Decimal price_adjustment
                        barber_service = BarberService.objects.create(
                            barber=instance,
                            service=service,
                            price_adjustment=price
                        )
                        prices.append(price)
                    except Exception as e:
                        error_msg = f"Error creating service {service_data['name']}: {str(e)}"
                        service_creation_errors.append(error_msg)
                        raise serializers.ValidationError({
                            'services': service_creation_errors
                        })

                # Update price range if we have valid prices
                if prices:
                    instance.price_range_min = min(prices)
                    instance.price_range_max = max(prices)
                    instance.save()

            # Process working hours
            for hours_data in working_hours_data:
                WorkingHours.objects.create(barber=instance, **hours_data)

            return instance
        except Exception as e:
            print(f"Error in update method: {str(e)}")
            print(f"Error type: {type(e)}")
            raise serializers.ValidationError(str(e)) 