import string
import random

from django.contrib.auth.models import AbstractUser
from django.db import models


def generate_tenant_code():
    """Generate a short unique code like RF-A3K9."""
    chars = string.ascii_uppercase + string.digits
    while True:
        code = "RF-" + "".join(random.choices(chars, k=4))
        if not User.objects.filter(tenant_code=code).exists():
            return code


class User(AbstractUser):
    class Role(models.TextChoices):
        LANDLORD = "landlord", "Landlord"
        TENANT = "tenant", "Tenant"

    role = models.CharField(max_length=20, choices=Role.choices)
    phone = models.CharField(max_length=32, blank=True)
    tenant_code = models.CharField(max_length=10, unique=True, blank=True, null=True)

    def save(self, *args, **kwargs):
        if not self.tenant_code:
            self.tenant_code = generate_tenant_code()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.get_full_name() or self.username


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class BankAccount(TimestampedModel):
    landlord = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bank_accounts")
    bank_name = models.CharField(max_length=120)
    account_name = models.CharField(max_length=120)
    account_number = models.CharField(max_length=64)
    ifsc = models.CharField(max_length=32, blank=True)

    def __str__(self):
        return f"{self.bank_name} ({self.account_number})"


class Building(TimestampedModel):
    landlord = models.ForeignKey(User, on_delete=models.CASCADE, related_name="buildings")
    name = models.CharField(max_length=120)
    address = models.TextField()

    def __str__(self):
        return self.name


class Unit(TimestampedModel):
    building = models.ForeignKey(Building, on_delete=models.CASCADE, related_name="units")
    label = models.CharField(max_length=80)
    monthly_rent = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        unique_together = ("building", "label")

    def __str__(self):
        return f"{self.building.name} / {self.label}"


class Tenancy(TimestampedModel):
    landlord = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tenancies")
    tenant_user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="tenancy")
    unit = models.OneToOneField(Unit, on_delete=models.CASCADE, related_name="tenancy")
    start_date = models.DateField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.tenant_user} @ {self.unit}"


class JuspayOrder(TimestampedModel):
    class Status(models.TextChoices):
        CREATED = "created", "Created"
        PENDING = "pending", "Pending"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"

    tenancy = models.ForeignKey(Tenancy, on_delete=models.CASCADE, related_name="juspay_orders")
    bank_account = models.ForeignKey(BankAccount, on_delete=models.PROTECT, related_name="juspay_orders")
    rent_month = models.CharField(max_length=7)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    order_id = models.CharField(max_length=120, unique=True)
    juspay_order_id = models.CharField(max_length=120, blank=True)
    payment_session_id = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.CREATED)
    metadata = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return self.order_id


class Payment(TimestampedModel):
    class Status(models.TextChoices):
        INITIATED = "initiated", "Initiated"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"

    landlord = models.ForeignKey(User, on_delete=models.CASCADE, related_name="payments")
    tenancy = models.ForeignKey(Tenancy, on_delete=models.CASCADE, related_name="payments")
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="payments")
    bank_account = models.ForeignKey(BankAccount, on_delete=models.PROTECT, related_name="payments")
    rent_month = models.CharField(max_length=7)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_on = models.DateField()
    reference = models.CharField(max_length=120, blank=True)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.INITIATED)
    provider = models.CharField(max_length=32, default="juspay")
    provider_payment_id = models.CharField(max_length=255, blank=True)
    provider_order_id = models.CharField(max_length=255, blank=True)
    provider_payload = models.JSONField(default=dict, blank=True)
    juspay_order = models.ForeignKey(
        JuspayOrder, null=True, blank=True, on_delete=models.SET_NULL, related_name="payments"
    )

    def __str__(self):
        return f"{self.tenancy.tenant_user} {self.rent_month} {self.amount}"
