from django.shortcuts import render
from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.views import APIView
from datetime import datetime, timedelta
from django.utils import timezone
from django.contrib.auth import authenticate, get_user_model
from django.core.exceptions import ObjectDoesNotExist
import json
from rest_framework.authtoken.serializers import AuthTokenSerializer
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated, AllowAny
import requests
import math
from django.conf import settings

from .models import (
    Barber, WorkingHours, Appointment, Review, BarberPortfolio, BarberService, ProfessionalCategory, Service
)
from .serializers import (
    UserSerializer,
    BarberSerializer,
    BarberRegistrationSerializer,
    BarberProfileSerializer,
    WorkingHoursSerializer,
    AppointmentSerializer,
    ReviewSerializer,
    BarberPortfolioSerializer,
    BarberServiceSerializer,
    ProfessionalCategorySerializer
)

# Custom permissions
class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    """
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True
            
        # Write permissions are only allowed to the owner
        if hasattr(obj, 'user'):
            return obj.user == request.user
        elif hasattr(obj, 'customer'):
            return obj.customer == request.user
        return False


class IsBarberOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow barbers to edit their own data.
    """
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True
            
        # Check if user is a barber
        try:
            barber = request.user.barber_profile
            return obj == barber
        except:
            return False


# Authentication views
class CustomAuthToken(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not username or not password:
            return Response({
                'error': 'Both email/username and password are required.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # First check if the user exists
        UserModel = get_user_model()
        try:
            user = UserModel.objects.get(
                Q(username__iexact=username) | Q(email__iexact=username)
            )
        except UserModel.DoesNotExist:
            return Response({
                'error': 'Account not found. Please check your email/username or create a new account.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Now check if the password is correct
        if user.check_password(password):
            token, _ = Token.objects.get_or_create(user=user)
            response_data = {
                'token': token.key,
                'user_id': user.pk,
                'username': user.username,
                'email': user.email,
                'is_professional': hasattr(user, 'barber_profile')
            }
            
            # Add professional_id and category if user is a professional
            if response_data['is_professional']:
                try:
                    barber_profile = user.barber_profile
                    response_data['professional_id'] = barber_profile.id
                    if barber_profile.category:
                        response_data['professional_category'] = {
                            'id': barber_profile.category.id,
                            'name': barber_profile.category.name,
                            'slug': barber_profile.category.slug
                        }
                except Exception as e:
                    pass # No debug print for this block
            
            return Response(response_data)
        
        # Password is incorrect
        return Response({
            'error': 'Incorrect password. Please check your password and try again.'
        }, status=status.HTTP_401_UNAUTHORIZED)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        # Check if user with email or username already exists
        email = request.data.get('email')
        username = request.data.get('username')
        
        if User.objects.filter(email=email).exists():
            return Response({
                'error': 'A user with this email already exists.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if User.objects.filter(username=username).exists():
            return Response({
                'error': 'A user with this username already exists.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = BarberRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, created = Token.objects.get_or_create(user=user)
            
            # Create barber profile for new user with explicit creation
            try:
                barber = Barber.objects.create(
                    user=user,
                    profile_image=None,
                    bio='',
                    years_of_experience=0,
                    location=None,
                    address='',
                    price_range_min=0.00,
                    price_range_max=0.00,
                    is_available=True
                )
            except Exception as e:
                # If barber profile creation fails, delete the user and return error
                user.delete()
                return Response({
                    'error': 'Failed to create barber profile. Please try again.'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            return Response({
                'token': token.key,
                'user_id': user.pk,
                'email': user.email,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_professional': True,
                'professional_id': barber.id,
                'professional_category': {
                    'id': barber.category.id,
                    'name': barber.category.name,
                    'slug': barber.category.slug
                }
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# API ViewSets
class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['patch'])
    def update_me(self, request):
        """Update current user's information"""
        user = request.user
        serializer = self.get_serializer(user, data=request.data, partial=True)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Handle password change if provided
        password_changed = False
        if 'password' in request.data and request.data['password']:
            user.set_password(request.data['password'])
            user.save()  # Save the user after setting password
            password_changed = True
        
        # Only call serializer.save() if we're not updating password
        # This prevents the serializer from overwriting the hashed password
        if not password_changed:
            serializer.save()
        
        return Response(serializer.data)


class BarberViewSet(viewsets.ModelViewSet):
    queryset = Barber.objects.all()
    serializer_class = BarberSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action == 'register':
            return [permissions.AllowAny()]
        return super().get_permissions()

    @action(detail=False, methods=['GET', 'PATCH'])
    def user(self, request):
        """Get or update the current user's barber profile"""
        try:
            barber = request.user.barber_profile
            
            if request.method == 'GET':
                serializer = self.get_serializer(barber)
                return Response(serializer.data)
            elif request.method == 'PATCH':
                serializer = self.get_serializer(barber, data=request.data, partial=True)
                if serializer.is_valid():
                    serializer.save()
                    return Response(serializer.data)
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Barber.DoesNotExist:
            if request.method == 'GET':
                # If no barber profile exists, create a default one
                barber = Barber.objects.create(
                    user=request.user,
                    bio='',
                    years_of_experience=0,
                    location=None,
                    address='',
                    price_range_min=0.00,
                    price_range_max=0.00,
                    is_available=True
                )
                serializer = self.get_serializer(barber)
                return Response(serializer.data)
            else:
                return Response(
                    {"error": "Barber profile not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def get_queryset(self):
        queryset = Barber.objects.all()
        
        # Get location parameters
        lat = self.request.query_params.get('lat', None)
        lng = self.request.query_params.get('lng', None)
        radius = self.request.query_params.get('radius', 10)  # Default 10km radius
        
        if lat and lng:
            
            # Filter barbers within radius and order by distance
            queryset = queryset.filter(
                # location__distance_lte=(user_location, D(km=float(radius)))
            ).annotate(
                # distance=Distance('location', user_location)
            ).order_by('distance')

        return queryset

    @action(detail=False, methods=['GET'])
    def nearby(self, request):
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        radius = request.query_params.get('radius', 10)  # Default 10km

        if not all([lat, lng]):
            return Response(
                {'error': 'Latitude and longitude are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            
            barbers = Barber.objects.filter(
                # location__distance_lte=(user_location, D(km=float(radius)))
            ).annotate(
                # distance=Distance('location', user_location)
            ).order_by('distance')

            serializer = self.get_serializer(barbers, many=True)
            return Response(serializer.data)

        except ValueError:
            return Response(
                {'error': 'Invalid coordinates'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'])
    def register(self, request):
        serializer = BarberRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, created = Token.objects.get_or_create(user=user)
            
            # Get the barber profile that was created
            barber = user.barber_profile
            
            return Response({
                'token': token.key,
                'user_id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_professional': True,
                'professional_id': barber.id,
                'professional_category': {
                    'id': barber.category.id,
                    'name': barber.category.name,
                    'slug': barber.category.slug
                }
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def complete_profile(self, request):
        """Complete or update a barber's profile"""
        try:
            # Create a new dict with the data, handling both JSON and form data
            data = {}
            for key in request.data.keys():
                if key == 'profile_image':
                    # Handle file upload
                    data[key] = request.data.get(key)
                else:
                    # Handle both JSON and form data
                    if hasattr(request.data, 'getlist'):
                        # Form data - get first item from the list
                        value = request.data.getlist(key)[0] if request.data.getlist(key) else None
                    else:
                        # JSON data - get directly
                        value = request.data.get(key)
                    data[key] = value
            
            # Parse services and working_hours from JSON strings
            if 'services' in data and data['services']:
                try:
                    if isinstance(data['services'], str):
                        data['services'] = json.loads(data['services'])
                except json.JSONDecodeError as e:
                    return Response(
                        {'error': f'Invalid services data: {str(e)}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                    
            if 'working_hours' in data and data['working_hours']:
                try:
                    if isinstance(data['working_hours'], str):
                        data['working_hours'] = json.loads(data['working_hours'])
                except json.JSONDecodeError as e:
                    return Response(
                        {'error': f'Invalid working hours data: {str(e)}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Convert latitude and longitude to float
            if 'latitude' in data and data['latitude']:
                data['latitude'] = float(data['latitude'])
            if 'longitude' in data and data['longitude']:
                data['longitude'] = float(data['longitude'])
            
            # Get or create the barber profile
            barber, created = Barber.objects.get_or_create(
                user=request.user,
                defaults={
                    'bio': '',
                    'years_of_experience': 0,
                    'location': None,
                    'address': '',
                    'price_range_min': 0.00,
                    'price_range_max': 0.00,
                    'is_available': True
                }
            )
            
            if created:
                pass # No debug print for this block
            else:
                pass # No debug print for this block
                
            # Create serializer instance
            serializer = BarberProfileSerializer(
                instance=barber,
                data=data,
                partial=True,
                context={'request': request}
            )
            
            if serializer.is_valid():
                try:
                    result = serializer.save()
                    
                    # Get the updated barber with all related data
                    barber_with_services = Barber.objects.prefetch_related(
                        'services__service',
                        'working_hours'
                    ).get(id=barber.id)
                    
                    # Return the complete barber data
                    response_serializer = BarberSerializer(barber_with_services)
                    return Response(response_serializer.data, status=status.HTTP_200_OK)
                except Exception as e:
                    return Response(
                        {'error': str(e)},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                return Response(
                    serializer.errors,
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def address_suggestions(self, request):
        """
        Proxies a request to a geocoding API to get address suggestions with location bias.
        """
        query = request.data.get('query')
        lat = request.data.get('lat')
        lon = request.data.get('lon')
        
        if not query:
            return Response({'error': 'Query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Try multiple geocoding services for better reliability
        services = [
            {
                'name': 'Nominatim',
                'url': f"https://nominatim.openstreetmap.org/search",
                'params': {
                    'q': query,
                    'format': 'json',
                    'limit': 5,
                    'addressdetails': 1
                },
                'headers': {
                    'User-Agent': 'SoloApp/1.0 (https://github.com/your-repo)'
                }
            },
            {
                'name': 'Photon',
                'url': f"https://photon.komoot.io/api/",
                'params': {
                    'q': query,
                    'limit': 5
                },
                'headers': {}
            }
        ]

        # Add location bias if coordinates are provided
        if lat and lon:
            # Add location bias to Nominatim (using viewbox instead of lat/lon for better results)
            # Calculate a bounding box around the user's location (50km radius)
            radius_km = 50
            lat_delta = radius_km / 111.32  # Approximate km per degree latitude
            lon_delta = radius_km / (111.32 * math.cos(math.radians(float(lat))))
            
            viewbox = [
                float(lon) - lon_delta,  # min_lon
                float(lat) - lat_delta,  # min_lat
                float(lon) + lon_delta,  # max_lon
                float(lat) + lat_delta   # max_lat
            ]
            
            services[0]['params']['viewbox'] = ','.join(map(str, viewbox))
            services[0]['params']['bounded'] = 1
            
            # Add location bias to Photon
            services[1]['params']['lat'] = lat
            services[1]['params']['lon'] = lon
            services[1]['params']['radius'] = 50000  # 50km radius

        for service in services:
            try:
                response = requests.get(
                    service['url'], 
                    params=service['params'],
                    headers=service['headers'],
                    timeout=5
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Transform data based on service
                    if service['name'] == 'Nominatim':
                        suggestions = []
                        for item in data:
                            address = item.get('address', {})
                            
                            # Build clean address components
                            street_number = address.get('house_number', '')
                            street_name = address.get('road', '')
                            city = address.get('city', address.get('town', ''))
                            state = address.get('state', '')
                            zip_code = address.get('postcode', '')
                            
                            # Create clean display name
                            clean_address = []
                            
                            # Add street address if available
                            if street_number and street_name:
                                clean_address.append(f"{street_number} {street_name}")
                            elif street_name:
                                clean_address.append(street_name)
                            
                            # Add city if available
                            if city:
                                clean_address.append(city)
                            
                            # Add state if available
                            if state:
                                clean_address.append(state)
                            
                            # Add zip code if available
                            if zip_code:
                                clean_address.append(zip_code)
                            
                            # If we have a meaningful address, add it
                            if len(clean_address) >= 2:  # At least city and state
                                display_name = ', '.join(clean_address)
                                suggestions.append({
                                    'place_id': item.get('place_id'),
                                    'display_name': display_name,
                                    'lat': float(item.get('lat', 0)),
                                    'lon': float(item.get('lon', 0))
                                })
                            # If it's just a city/place name, include it too
                            elif city and state:
                                display_name = f"{city}, {state}"
                                if zip_code:
                                    display_name += f", {zip_code}"
                                suggestions.append({
                                    'place_id': item.get('place_id'),
                                    'display_name': display_name,
                                    'lat': float(item.get('lat', 0)),
                                    'lon': float(item.get('lon', 0))
                                })
                    
                    elif service['name'] == 'Photon':
                        suggestions = data.get('features', [])
                        # Transform Photon format to match Nominatim
                        suggestions = [
                            {
                                'place_id': f"photon_{i}",
                                'display_name': feature.get('properties', {}).get('name', ''),
                                'lat': feature.get('geometry', {}).get('coordinates', [0, 0])[1],
                                'lon': feature.get('geometry', {}).get('coordinates', [0, 0])[0]
                            }
                            for i, feature in enumerate(suggestions)
                        ]
                    
                    return Response(suggestions)
                    
            except requests.exceptions.RequestException as e:
                continue  # Try next service
        
        # If all services fail, return empty results
        return Response([], status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def pause_account(self, request):
        """
        Pause the current barber's account for a specified duration.
        """
        try:
            barber = Barber.objects.get(user=request.user)
            
            duration_days = request.data.get('duration', 7)
            reason = request.data.get('reason', '')
            
            # Convert duration to int if it's a string
            try:
                duration_days = int(duration_days)
            except (ValueError, TypeError):
                return Response(
                    {'error': 'Duration must be a valid number'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate duration (1-90 days to match frontend)
            if duration_days < 1 or duration_days > 90:
                return Response(
                    {'error': 'Duration must be between 1 and 90 days'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Reason is optional, so no validation needed
            
            # Pause the account
            barber.pause_account(duration_days, reason)
            
            return Response({
                'message': f'Account paused successfully for {duration_days} day(s)',
                'pause_end_date': barber.pause_end_date.isoformat() if barber.pause_end_date else None
            })
            
        except Barber.DoesNotExist:
            return Response(
                {'error': 'Barber profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to pause account: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def unpause_account(self, request):
        """Unpause the current user's barber account"""
        try:
            barber = request.user.barber_profile
            barber.unpause_account()
            return Response({
                'message': 'Account unpaused successfully',
                'is_paused': False,
                'pause_end_date': None
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'error': 'Failed to unpause account'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def delete_account(self, request):
        """Delete the current user's barber account"""
        try:
            reason = request.data.get('reason', '')
            
            # Get the barber profile and user
            barber = request.user.barber_profile
            user = request.user
            
            # Store the deletion reason (optional - for analytics)
            if reason:
                # You could store this in a separate model for analytics
                print(f"Account deletion reason: {reason}")
            
            # Delete the barber profile first (this will cascade to related data)
            barber.delete()
            
            # Delete the user account
            user.delete()
            
            return Response({
                'message': 'Account deleted successfully'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'error': 'Failed to delete account'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    @action(detail=True, methods=['get'])
    def availability(self, request, pk=None):
        barber = self.get_object()
        date_str = request.query_params.get('date', None)
        
        if not date_str:
            return Response({"error": "Date parameter is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"error": "Invalid date format. Use YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get day of week (0 = Monday, 6 = Sunday)
        day_of_week = date.weekday()
        
        # Check if barber works on this day
        try:
            working_hours = WorkingHours.objects.get(barber=barber, day_of_week=day_of_week, is_working=True)
        except WorkingHours.DoesNotExist:
            return Response({"available": False, "message": "Barber does not work on this day"})
        
        # Get all appointments for this barber on this date
        appointments = Appointment.objects.filter(
            barber=barber,
            date=date,
            status__in=['scheduled', 'confirmed']
        ).order_by('start_time')
        
        # Generate available time slots
        available_slots = []
        current_time = working_hours.start_time
        
        while current_time < working_hours.end_time:
            # Check if this time slot overlaps with any appointment
            is_available = True
            slot_end_time = (datetime.combine(date, current_time) + timedelta(minutes=30)).time()
            
            for appointment in appointments:
                if (current_time < appointment.end_time and 
                    slot_end_time > appointment.start_time):
                    is_available = False
                    break
            
            if is_available:
                available_slots.append({
                    "start_time": current_time.strftime('%H:%M'),
                    "end_time": slot_end_time.strftime('%H:%M')
                })
            
            # Move to next 30-minute slot
            current_time = slot_end_time
        
        return Response({
            "available": True,
            "working_hours": {
                "start": working_hours.start_time.strftime('%H:%M'),
                "end": working_hours.end_time.strftime('%H:%M')
            },
            "available_slots": available_slots
        })


class WorkingHoursViewSet(viewsets.ModelViewSet):
    queryset = WorkingHours.objects.all()
    serializer_class = WorkingHoursSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WorkingHours.objects.filter(barber__user=self.request.user)

    @action(detail=False, methods=['PUT'])
    def bulk_update(self, request):
        """Update all working hours for the current barber"""
        try:
            barber = request.user.barber_profile
            
            # Delete existing working hours
            WorkingHours.objects.filter(barber=barber).delete()
            
            # Create new working hours
            working_hours_data = request.data.get('working_hours', [])
            created_hours = []
            
            for hour_data in working_hours_data:
                hour_data['barber'] = barber.id
                serializer = self.get_serializer(data=hour_data)
                if serializer.is_valid():
                    created_hours.append(serializer.save())
                else:
                    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            # Return the created working hours
            result_serializer = self.get_serializer(created_hours, many=True)
            return Response(result_serializer.data)
            
        except Barber.DoesNotExist:
            return Response(
                {"error": "Barber profile not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['DELETE'])
    def delete_all(self, request):
        """Delete all working hours for the current barber"""
        try:
            barber = request.user.barber_profile
            WorkingHours.objects.filter(barber=barber).delete()
            return Response({"message": "All working hours deleted successfully"})
        except Barber.DoesNotExist:
            return Response(
                {"error": "Barber profile not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class BarberServiceViewSet(viewsets.ModelViewSet):
    queryset = BarberService.objects.all()
    serializer_class = BarberServiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return BarberService.objects.filter(barber__user=self.request.user)

    @action(detail=False, methods=['PUT'])
    def bulk_update(self, request):
        """Update all services for the current barber"""
        try:
            barber = request.user.barber_profile
            
            # Delete existing services
            BarberService.objects.filter(barber=barber).delete()
            
            # Create new services
            services_data = request.data.get('services', [])
            created_services = []
            
            for service_data in services_data:
                # Get or create the Service object
                service_name = service_data.get('service_name', service_data.get('name', ''))
                price_adjustment = service_data.get('price_adjustment', 0)
                
                if not service_name:
                    continue
                
                # Try to find existing service, or create a new one
                service, created = Service.objects.get_or_create(
                    name=service_name,
                    defaults={
                        'description': f'{service_name} service',
                        'base_price': price_adjustment,
                        'duration_minutes': 45
                    }
                )
                
                # Create the BarberService
                barber_service = BarberService.objects.create(
                    barber=barber,
                    service=service,
                    price_adjustment=price_adjustment
                )
                created_services.append(barber_service)
            
            # Return the created services
            result_serializer = self.get_serializer(created_services, many=True)
            return Response(result_serializer.data)
            
        except Barber.DoesNotExist:
            return Response(
                {"error": "Barber profile not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['DELETE'])
    def delete_all(self, request):
        """Delete all services for the current barber"""
        try:
            barber = request.user.barber_profile
            BarberService.objects.filter(barber=barber).delete()
            return Response({"message": "All services deleted successfully"})
        except Barber.DoesNotExist:
            return Response(
                {"error": "Barber profile not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Appointment.objects.all()
        
        # Filter by barber if specified
        barber_id = self.request.query_params.get('barber', None)
        if barber_id:
            queryset = queryset.filter(barber_id=barber_id)
        else:
            # Default to current user's appointments if no barber specified
            # Check if user has a barber profile first
            if hasattr(self.request.user, 'barber_profile'):
                queryset = queryset.filter(barber__user=self.request.user)
            else:
                # If user doesn't have a barber profile, return empty queryset
                # This prevents 404 errors when the user is not a barber
                return Appointment.objects.none()
        
        # Filter by date if specified
        date = self.request.query_params.get('date', None)
        if date:
            queryset = queryset.filter(date=date)
        
        return queryset.order_by('date', 'start_time')
    
    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        # Check if user has a barber profile
        if not hasattr(request.user, 'barber_profile'):
            return Response({
                'error': 'You must be a barber to view appointments.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        upcoming_appointments = self.get_queryset().filter(
            date__gte=timezone.now().date(),
            status__in=['scheduled', 'confirmed']  # Exclude cancelled and completed appointments
        ).order_by('date', 'start_time')
        serializer = self.get_serializer(upcoming_appointments, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        appointment = self.get_object()
        if appointment.status not in ['scheduled', 'confirmed']:
            return Response(
                {"error": "Only scheduled or confirmed appointments can be cancelled"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        appointment.status = 'cancelled'
        appointment.save()
        return Response(self.get_serializer(appointment).data)


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # For GET requests, show:
        # 1. All reviews for a specific barber (if barber_id is provided)
        # 2. All reviews by the current user
        # 3. All reviews for the current user if they are a barber
        barber_id = self.request.query_params.get('barber', None)
        if barber_id:
            return Review.objects.filter(barber_id=barber_id)
        
        return Review.objects.filter(
            Q(customer=self.request.user) | 
            Q(barber__user=self.request.user)
        )
    
    def create(self, request, *args, **kwargs):
        # Check if user is a barber
        if hasattr(request.user, 'barber_profile'):
            return Response(
                {"detail": "Barbers cannot submit reviews. Please use a customer account."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Add customer to the request data
        barber_id = request.data.get('barber')
        try:
            barber = Barber.objects.get(id=barber_id)
            return super().create(request, *args, **kwargs)
        except Barber.DoesNotExist:
            return Response(
                {"detail": "Barber not found"},
                status=status.HTTP_404_NOT_FOUND
            )
    
    def perform_create(self, serializer):
        serializer.save(customer=self.request.user)


class BarberPortfolioViewSet(viewsets.ModelViewSet):
    serializer_class = BarberPortfolioSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        barber_id = self.kwargs.get('barber_pk')
        # Only return parent posts (group posts) and single posts
        return BarberPortfolio.objects.filter(
            barber_id=barber_id,
            parent__isnull=True  # This ensures we only get parent posts and single posts
        ).prefetch_related('group_images')
    
    def perform_create(self, serializer):
        barber_id = self.kwargs.get('barber_pk')
        if barber_id is None:
            barber_id = self.request.data.get('barber')
        barber = get_object_or_404(Barber, id=barber_id)
        serializer.save(barber=barber)
    
    def destroy(self, request, *args, **kwargs):
        """Custom destroy method to handle group post deletion"""
        instance = self.get_object()
        
        # If this is a group post, delete all child posts first
        if instance.is_group:
            # Delete all child posts
            child_posts = instance.group_images.all()
            for child_post in child_posts:
                child_post.delete()
        
        # Delete the main post
        instance.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    def create(self, request, *args, **kwargs):
        is_group = request.data.get('is_group', False)
        images = request.FILES.getlist('images')
        
        if is_group and len(images) > 0:
            # Create group post
            group_data = {
                'barber': kwargs.get('barber_pk'),
                'description': request.data.get('description', ''),
                'is_group': True
            }
            group_serializer = self.get_serializer(data=group_data)
            group_serializer.is_valid(raise_exception=True)
            group = group_serializer.save()
            
            # Create individual posts for each image
            for image in images:
                post_data = {
                    'barber': kwargs.get('barber_pk'),
                    'image': image,
                    'description': request.data.get('description', ''),
                    'parent': group.id
                }
                post_serializer = self.get_serializer(data=post_data)
                post_serializer.is_valid(raise_exception=True)
                post_serializer.save()

            # Return the complete group post with all images
            return Response(group_serializer.data, status=status.HTTP_201_CREATED)
        else:
            # Create single post
            return super().create(request, *args, **kwargs)


@api_view(['GET'])
def get_barber_profile(request, barber_id):
    try:
        barber = Barber.objects.select_related('user').prefetch_related(
            'appointments',
            'services'
        ).get(id=barber_id)

        # Get upcoming appointments
        upcoming_appointments = Appointment.objects.filter(
            barber=barber,
            date__gte=timezone.now()
        ).order_by('date')

        # Get user's location from query params if provided
        user_lat = request.GET.get('lat')
        user_lng = request.GET.get('lng')
        distance_text = ""
        
        if user_lat and user_lng:
            try:
                # distance = barber.location.distance(user_location) * 100  # Convert to km
                distance_text = f", located {distance:.1f} km away"
            except:
                distance_text = ""

        # Generate automated bio
        experience_text = f"{barber.years_of_experience} years of experience"
        price_text = f"Price range: ${barber.price_range_min:.2f}-${barber.price_range_max:.2f}"
        rating_text = f"Rating: {barber.average_rating:.1f}/5 from {barber.total_reviews} reviews" if barber.total_reviews > 0 else "New barber"
        
        automated_bio = f"Professional barber with {experience_text}{distance_text}. {price_text}. {rating_text}. {barber.bio or ''}"

        # Structure the response
        profile_data = {
            "id": barber.id,
            "user": {
                "id": barber.user.id,
                "name": f"{barber.user.first_name} {barber.user.last_name}",
                "email": barber.user.email
            },
            "profile": {
                "yearsOfExperience": barber.years_of_experience,
                "bio": automated_bio,
                "profileImage": request.build_absolute_uri(barber.profile_image.url) if barber.profile_image else None,
                "location": {
                    "coordinates": [barber.location.x, barber.location.y] if barber.location else None
                } if barber.location else None,
                "business": {
                    "services": BarberServiceSerializer(
                        barber.services.all(), 
                        many=True
                    ).data,
                    "workingHours": [
                        {
                            'day': hours.day,
                            'start_time': hours.start_time.strftime('%H:%M'),
                            'end_time': hours.end_time.strftime('%H:%M'),
                            'is_selected': hours.is_selected
                        }
                        for hours in WorkingHours.objects.filter(barber=barber)
                    ]
                },
                "statistics": {
                    "averageRating": barber.average_rating if hasattr(barber, 'average_rating') else 0,
                    "totalReviews": barber.total_reviews if hasattr(barber, 'total_reviews') else 0
                }
            },
            "appointments": AppointmentSerializer(
                upcoming_appointments,
                many=True
            ).data
        }

        return Response(profile_data)
    except Barber.DoesNotExist:
        return Response(
            {"error": "Barber not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {"error": str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def search_barbers(request):
    query = request.GET.get('query', '').strip()
    lat = request.GET.get('lat')
    lng = request.GET.get('lng')
    radius = float(request.GET.get('radius', 10))
    category_id = request.GET.get('category')

    if not query:
        return Response({'error': 'Query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

    # Search by name
    barbers_by_name = Barber.objects.filter(
        Q(user__first_name__icontains=query) |
        Q(user__last_name__icontains=query) |
        Q(user__username__icontains=query)
    )
    # Search by service
    barbers_by_service = Barber.objects.filter(
        services__service__name__icontains=query
    )
    # Search by address/location
    barbers_by_location = Barber.objects.filter(
        Q(address__icontains=query)
    )
    # Combine and deduplicate
    barbers = (barbers_by_name | barbers_by_service | barbers_by_location).distinct()

    # Filter by category if provided
    if category_id:
        barbers = barbers.filter(category_id=category_id)

    # If lat/lng provided, filter and sort by distance
    if lat and lng:
        barbers = barbers.filter(
            location__distance_lte=(user_location, D(km=radius))
        ).annotate(
            # distance=Distance('location', user_location)
        ).order_by('distance')

    serializer = BarberSerializer(barbers, many=True, context={'request': request})
    return Response(serializer.data)


class ProfessionalCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for professional categories"""
    queryset = ProfessionalCategory.objects.filter(is_active=True)
    serializer_class = ProfessionalCategorySerializer
    permission_classes = [permissions.AllowAny]
    
    @action(detail=False, methods=['get'])
    def all(self, request):
        """Get all active professional categories"""
        categories = ProfessionalCategory.objects.filter(is_active=True)
        serializer = self.get_serializer(categories, many=True)
        return Response(serializer.data)

@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """Simple health check endpoint"""
    return Response({"status": "healthy", "message": "API is running"})

