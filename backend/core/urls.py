from django.urls import path

from .views import (
    ActivateAddOnView,
    AnalyticsDashboardView,
    CashFlowForecastView,
    ConfirmAddOnView,
    ConfirmTenantPaymentView,
    ConfirmUpgradeView,
    CreateBankAccountView,
    CreateBuildingView,
    CreateTenancyView,
    CreateUnitView,
    DelinquencyAnalyticsView,
    EndTenancyView,
    GoogleLoginView,
    InitiateTenantPaymentView,
    LandlordDashboardView,
    LoginView,
    MaintenanceIntelligenceView,
    MeView,
    PaymentReportExportView,
    PropertyROIView,
    SignupView,
    SubscriptionView,
    TaxComplianceReportView,
    TenantDashboardView,
    TenantRiskScoringView,
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
    # Premium analytics endpoints
    path("landlord/analytics/delinquency/", DelinquencyAnalyticsView.as_view(), name="api-analytics-delinquency"),
    path("landlord/analytics/cash-flow/", CashFlowForecastView.as_view(), name="api-analytics-cashflow"),
    path("landlord/analytics/roi/", PropertyROIView.as_view(), name="api-analytics-roi"),
    path("landlord/analytics/tenant-risk/", TenantRiskScoringView.as_view(), name="api-analytics-tenant-risk"),
    path("landlord/analytics/maintenance/", MaintenanceIntelligenceView.as_view(), name="api-analytics-maintenance"),
    path("landlord/analytics/tax-report/", TaxComplianceReportView.as_view(), name="api-analytics-tax"),
    # Tenant
    path("tenant/dashboard/", TenantDashboardView.as_view(), name="api-tenant-dashboard"),
    path("tenant/payments/initiate/", InitiateTenantPaymentView.as_view(), name="api-tenant-payment-initiate"),
    path("tenant/payments/confirm/", ConfirmTenantPaymentView.as_view(), name="api-tenant-payment-confirm"),
]
