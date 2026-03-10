from django.urls import path

from .views import (
    ConfirmTenantPaymentView,
    InitiateTenantPaymentView,
    LandlordDashboardView,
    LoginView,
    MeView,
    TenantDashboardView,
)


urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="api-login"),
    path("auth/me/", MeView.as_view(), name="api-me"),
    path("landlord/dashboard/", LandlordDashboardView.as_view(), name="api-landlord-dashboard"),
    path("tenant/dashboard/", TenantDashboardView.as_view(), name="api-tenant-dashboard"),
    path("tenant/payments/initiate/", InitiateTenantPaymentView.as_view(), name="api-tenant-payment-initiate"),
    path("tenant/payments/confirm/", ConfirmTenantPaymentView.as_view(), name="api-tenant-payment-confirm"),
]
