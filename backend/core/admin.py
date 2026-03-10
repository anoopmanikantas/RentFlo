from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import AddOn, BankAccount, Building, RazorpayOrder, Payment, Subscription, Tenancy, Unit, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (("Role", {"fields": ("role", "phone")}),)


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("landlord", "tier", "max_units", "max_tenants", "valid_until", "is_active")
    list_filter = ("tier", "is_active")
    list_editable = ("tier", "max_units", "max_tenants", "is_active")


@admin.register(AddOn)
class AddOnAdmin(admin.ModelAdmin):
    list_display = ("landlord", "feature", "is_active", "created_at")
    list_filter = ("feature", "is_active")
    list_editable = ("is_active",)


admin.site.register(BankAccount)
admin.site.register(Building)
admin.site.register(Unit)
admin.site.register(Tenancy)
admin.site.register(RazorpayOrder)
admin.site.register(Payment)
