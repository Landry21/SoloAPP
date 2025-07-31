from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'users', views.UserViewSet, basename='users')
router.register(r'barbers', views.BarberViewSet)
router.register(r'working-hours', views.WorkingHoursViewSet, basename='working-hours')
router.register(r'barber-services', views.BarberServiceViewSet, basename='barber-services')
router.register(r'appointments', views.AppointmentViewSet, basename='appointments')
router.register(r'reviews', views.ReviewViewSet, basename='reviews')
router.register(r'portfolio', views.BarberPortfolioViewSet, basename='portfolio')
router.register(r'barbers/(?P<barber_pk>\d+)/portfolio', views.BarberPortfolioViewSet, basename='barber-portfolio')
router.register(r'professional-categories', views.ProfessionalCategoryViewSet, basename='professional-categories')

urlpatterns = [
    path('barbers/search/', views.search_barbers, name='search-barbers'),
    path('', include(router.urls)),
    path('auth/', include('rest_framework.urls')),
    path('barbers/complete_profile/', views.BarberViewSet.as_view({'post': 'complete_profile'}), name='complete-profile'),
    path('barbers/<int:barber_id>/profile/', views.get_barber_profile, name='barber-profile'),
] 