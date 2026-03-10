from django.urls import path

from .views import (
    ConfirmTenantPaymentView,
    CreateBankAccountView,
    CreateBuildingView,
    CreateTenancyView,
    CreateUnitView,
    EndTenancyView,
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
    path("landlord/buildings/", CreateBuildingView.as_view(), name="api-create-building"),
    path("landlord/units/", CreateUnitView.as_view(), name="api-create-unit"),
    path("landlord/bank-accounts/", CreateBankAccountView.as_view(), name="api-create-bank-account"),
    path("landlord/tenancies/", CreateTenancyView.as_view(), name="api-create-tenancy"),
    path("landlord/tenancies/<int:tenancy_id>/end/", EndTenancyView.as_view(), name="api-end-tenancy"),
    path("tenant/dashboard/", TenantDashboardView.as_view(), name="api-tenant-dashboard"),
    path("tenant/payments/initiate/", InitiateTenantPaymentView.as_view(), name="api-tenant-payment-initiate"),
    path("tenant/payments/confirm/", ConfirmTenantPaymentView.as_view(), name="api-tenant-payment-confirm"),
]
