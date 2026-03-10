from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import BankAccount, Building, JuspayOrder, Payment, Tenancy, Unit, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (("Role", {"fields": ("role", "phone")}),)


admin.site.register(BankAccount)
admin.site.register(Building)
admin.site.register(Unit)
admin.site.register(Tenancy)
admin.site.register(JuspayOrder)
admin.site.register(Payment)
