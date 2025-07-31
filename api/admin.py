from django.contrib import admin
from django.contrib.gis.admin import OSMGeoAdmin
from .models import (
    Barber, WorkingHours, Appointment, Review, 
    BarberPortfolio, Service, BarberService
)

# Register your models here.

@admin.register(Barber)
class BarberAdmin(OSMGeoAdmin):
    list_display = ('user', 'address', 'location')
    search_fields = ('address',)
    default_lon = -74.0060  # Default longitude (NYC)
    default_lat = 40.7128   # Default latitude (NYC)
    default_zoom = 12
    map_width = 800
    map_height = 600


@admin.register(WorkingHours)
class WorkingHoursAdmin(admin.ModelAdmin):
    list_display = ('barber', 'day', 'start_time', 'end_time', 'is_selected')
    list_filter = ('day', 'is_selected')
    search_fields = ('barber__user__username',)


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ['customer', 'barber_id', 'date', 'start_time', 'end_time', 'service', 'contact_number', 'notes', 'created_at', 'updated_at']
    list_filter = ['service', 'date', 'barber']
    search_fields = ['customer', 'barber__full_name', 'service', 'notes']
    ordering = ['-date', 'start_time']


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('barber', 'customer', 'rating', 'created_at')
    list_filter = ('rating', 'created_at')
    search_fields = ('barber__user__username', 'customer__username')


@admin.register(BarberPortfolio)
class BarberPortfolioAdmin(admin.ModelAdmin):
    list_display = ('barber', 'image', 'description')
    search_fields = ('barber__user__username',)


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ('name', 'base_price', 'duration_minutes')
    search_fields = ('name',)
    list_filter = ('created_at',)


@admin.register(BarberService)
class BarberServiceAdmin(admin.ModelAdmin):
    list_display = ('barber', 'service', 'price_adjustment', 'is_active')
    list_filter = ('is_active', 'created_at')
    search_fields = ('barber__user__username', 'service__name')
