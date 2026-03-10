from django.urls import path

from .views import (
    ConfirmTenantPaymentView,
    GoogleLoginView,
    InitiateTenantPaymentView,
    LandlordDashboardView,
    LoginView,
    MeView,
    SignupView,
    TenantDashboardView,
)


urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="api-login"),
    path("auth/signup/", SignupView.as_view(), name="api-signup"),
    path("auth/google/", GoogleLoginView.as_view(), name="api-google-login"),
    path("auth/me/", MeView.as_view(), name="api-me"),
    path("landlord/dashboard/", LandlordDashboardView.as_view(), name="api-landlord-dashboard"),
    path("tenant/dashboard/", TenantDashboardView.as_view(), name="api-tenant-dashboard"),
    path("tenant/payments/initiate/", InitiateTenantPaymentView.as_view(), name="api-tenant-payment-initiate"),
    path("tenant/payments/confirm/", ConfirmTenantPaymentView.as_view(), name="api-tenant-payment-confirm"),
]
