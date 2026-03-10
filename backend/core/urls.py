from django.urls import path

from .views import (
    ActivateAddOnView,
    AnalyticsDashboardView,
    ConfirmAddOnView,
    ConfirmTenantPaymentView,
    ConfirmUpgradeView,
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
    PaymentReportExportView,
    SignupView,
    SubscriptionView,
    TenantDashboardView,
    UpgradeSubscriptionView,
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
    # Subscription & billing
    path("landlord/subscription/", SubscriptionView.as_view(), name="api-subscription"),
    path("landlord/subscription/upgrade/", UpgradeSubscriptionView.as_view(), name="api-subscription-upgrade"),
    path("landlord/subscription/confirm/", ConfirmUpgradeView.as_view(), name="api-subscription-confirm"),
    path("landlord/addons/activate/", ActivateAddOnView.as_view(), name="api-addon-activate"),
    path("landlord/addons/confirm/", ConfirmAddOnView.as_view(), name="api-addon-confirm"),
    # Premium features
    path("landlord/analytics/", AnalyticsDashboardView.as_view(), name="api-analytics"),
    path("landlord/reports/export/", PaymentReportExportView.as_view(), name="api-reports-export"),
    # Tenant
    path("tenant/dashboard/", TenantDashboardView.as_view(), name="api-tenant-dashboard"),
    path("tenant/payments/initiate/", InitiateTenantPaymentView.as_view(), name="api-tenant-payment-initiate"),
    path("tenant/payments/confirm/", ConfirmTenantPaymentView.as_view(), name="api-tenant-payment-confirm"),
]
