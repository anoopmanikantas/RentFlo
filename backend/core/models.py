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


# ---------------------------------------------------------------------------
# Subscription & Tier pricing
# ---------------------------------------------------------------------------

TIER_LIMITS = {
    "free":     {"max_units": 5,   "max_tenants": 5,   "price_monthly": 0,    "features": []},
    "pro":      {"max_units": 25,  "max_tenants": 25,  "price_monthly": 499,  "features": ["analytics"]},
    "business": {"max_units": 9999, "max_tenants": 9999, "price_monthly": 1499, "features": ["analytics", "reports_export"]},
}

ADDON_CATALOG = {
    "analytics":      {"name": "Analytics Dashboard", "price_monthly": 199},
    "reports_export":  {"name": "Payment Reports Export", "price_monthly": 99},
}


class Subscription(TimestampedModel):
    class Tier(models.TextChoices):
        FREE = "free", "Free"
        PRO = "pro", "Pro"
        BUSINESS = "business", "Business"

    landlord = models.OneToOneField(User, on_delete=models.CASCADE, related_name="subscription")
    tier = models.CharField(max_length=20, choices=Tier.choices, default=Tier.FREE)
    max_units = models.PositiveIntegerField(default=5)
    max_tenants = models.PositiveIntegerField(default=5)
    razorpay_subscription_id = models.CharField(max_length=120, blank=True)
    valid_until = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.landlord} – {self.get_tier_display()}"

    def apply_tier_limits(self, tier: str | None = None):
        """Set max_units/max_tenants from TIER_LIMITS for the given (or current) tier."""
        tier = tier or self.tier
        limits = TIER_LIMITS.get(tier, TIER_LIMITS["free"])
        self.tier = tier
        self.max_units = limits["max_units"]
        self.max_tenants = limits["max_tenants"]


class AddOn(TimestampedModel):
    class Feature(models.TextChoices):
        ANALYTICS = "analytics", "Analytics Dashboard"
        REPORTS_EXPORT = "reports_export", "Payment Reports Export"

    landlord = models.ForeignKey(User, on_delete=models.CASCADE, related_name="addons")
    feature = models.CharField(max_length=40, choices=Feature.choices)
    is_active = models.BooleanField(default=True)
    razorpay_subscription_id = models.CharField(max_length=120, blank=True)

    class Meta:
        unique_together = ("landlord", "feature")

    def __str__(self):
        return f"{self.landlord} – {self.get_feature_display()}"


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
    class UnitStatus(models.TextChoices):
        AVAILABLE = "available", "Available"
        OCCUPIED = "occupied", "Occupied"
        UNDER_MAINTENANCE = "under_maintenance", "Under Maintenance"

    building = models.ForeignKey(Building, on_delete=models.CASCADE, related_name="units")
    label = models.CharField(max_length=80)
    monthly_rent = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=24, choices=UnitStatus.choices, default=UnitStatus.AVAILABLE)

    class Meta:
        unique_together = ("building", "label")

    def __str__(self):
        return f"{self.building.name} / {self.label}"


class Tenancy(TimestampedModel):
    class OnboardingStatus(models.TextChoices):
        PENDING_DOCUMENTS = "pending_documents", "Pending Documents"
        PENDING_DEPOSIT = "pending_deposit", "Pending Deposit"
        PENDING_AGREEMENT = "pending_agreement", "Pending Agreement"
        PENDING_FIRST_RENT = "pending_first_rent", "Pending First Rent"
        COMPLETED = "completed", "Completed"

    landlord = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tenancies")
    tenant_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tenancies_as_tenant")
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="tenancies")
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    onboarding_status = models.CharField(
        max_length=24,
        choices=OnboardingStatus.choices,
        default=OnboardingStatus.PENDING_DOCUMENTS,
    )

    def __str__(self):
        return f"{self.tenant_user} @ {self.unit}"


class RazorpayOrder(TimestampedModel):
    class Status(models.TextChoices):
        CREATED = "created", "Created"
        PENDING = "pending", "Pending"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"

    tenancy = models.ForeignKey(Tenancy, on_delete=models.CASCADE, related_name="razorpay_orders")
    bank_account = models.ForeignKey(BankAccount, on_delete=models.PROTECT, related_name="razorpay_orders")
    rent_month = models.CharField(max_length=7)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    order_id = models.CharField(max_length=120, unique=True)
    razorpay_order_id = models.CharField(max_length=120, blank=True)
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
    due_on = models.DateField(null=True, blank=True)  # Expected due date for delinquency tracking
    reference = models.CharField(max_length=120, blank=True)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.INITIATED)
    provider = models.CharField(max_length=32, default="razorpay")
    provider_payment_id = models.CharField(max_length=255, blank=True)
    provider_order_id = models.CharField(max_length=255, blank=True)
    provider_payload = models.JSONField(default=dict, blank=True)
    razorpay_order = models.ForeignKey(
        RazorpayOrder, null=True, blank=True, on_delete=models.SET_NULL, related_name="payments"
    )
    category = models.CharField(
        max_length=32,
        choices=[
            ("rent", "Rent"),
            ("deposit", "Deposit"),
            ("agreement_fee", "Agreement Fee"),
            ("maintenance", "Maintenance"),
            ("utilities", "Utilities"),
            ("tax", "Tax"),
            ("other", "Other"),
        ],
        default="rent",
    )  # For tax categorization

    def __str__(self):
        return f"{self.tenancy.tenant_user} {self.rent_month} {self.amount}"


class MaintenanceRecord(TimestampedModel):
    class Type(models.TextChoices):
        PREVENTATIVE = "preventative", "Preventative"
        REACTIVE = "reactive", "Reactive / Emergency"

    landlord = models.ForeignKey(User, on_delete=models.CASCADE, related_name="maintenance_records")
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="maintenance_records")
    date = models.DateField()
    description = models.TextField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.REACTIVE)

    def __str__(self):
        return f"{self.unit} - {self.amount} on {self.date}"


# ---------------------------------------------------------------------------
# Onboarding – Document collection
# ---------------------------------------------------------------------------

class TenantDocument(TimestampedModel):
    class DocType(models.TextChoices):
        AADHAR = "aadhar", "Aadhar Card"
        PAN = "pan", "PAN Card"
        WORK_PROOF = "work_proof", "Work Proof"
        STUDENT_PROOF = "student_proof", "Student / College Proof"

    tenancy = models.ForeignKey(Tenancy, on_delete=models.CASCADE, related_name="documents")
    doc_type = models.CharField(max_length=20, choices=DocType.choices)
    doc_number = models.CharField(max_length=60, blank=True)
    file_url = models.URLField(max_length=500, blank=True)
    verified = models.BooleanField(default=False)

    class Meta:
        unique_together = ("tenancy", "doc_type")

    def __str__(self):
        return f"{self.tenancy.tenant_user} – {self.get_doc_type_display()}"


# ---------------------------------------------------------------------------
# Onboarding – Deposit tracking
# ---------------------------------------------------------------------------

class Deposit(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        PARTIALLY_REFUNDED = "partially_refunded", "Partially Refunded"
        REFUNDED = "refunded", "Refunded"

    tenancy = models.OneToOneField(Tenancy, on_delete=models.CASCADE, related_name="deposit")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_on = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING)
    # Offboarding fields
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deduction_reasons = models.TextField(blank=True)
    refund_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    refunded_on = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"Deposit {self.amount} – {self.get_status_display()} ({self.tenancy})"


# ---------------------------------------------------------------------------
# Onboarding – Rental Agreement
# ---------------------------------------------------------------------------

class Agreement(TimestampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING_SIGNATURE = "pending_signature", "Pending Signature"
        SIGNED = "signed", "Signed"

    tenancy = models.OneToOneField(Tenancy, on_delete=models.CASCADE, related_name="agreement")
    agreement_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    fee_paid = models.BooleanField(default=False)
    signed_date = models.DateField(null=True, blank=True)
    document_url = models.URLField(max_length=500, blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.DRAFT)

    def __str__(self):
        return f"Agreement – {self.get_status_display()} ({self.tenancy})"


# ---------------------------------------------------------------------------
# Post-Onboarding – Support Tickets
# ---------------------------------------------------------------------------

class Ticket(TimestampedModel):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_PROGRESS = "in_progress", "In Progress"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"

    class ResolutionProvider(models.TextChoices):
        URBAN_CLAP = "urban_clap", "Urban Clap"
        OWNER = "owner", "Owner's Choice"
        TENANT = "tenant", "Tenant's Choice"

    tenancy = models.ForeignKey(Tenancy, on_delete=models.CASCADE, related_name="tickets")
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="tickets")
    subject = models.CharField(max_length=200)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    resolution_provider = models.CharField(
        max_length=20, choices=ResolutionProvider.choices, blank=True
    )
    resolution_notes = models.TextField(blank=True)
    receipt_url = models.URLField(max_length=500, blank=True)

    def __str__(self):
        return f"Ticket #{self.pk} – {self.subject}"


# ---------------------------------------------------------------------------
# Offboarding
# ---------------------------------------------------------------------------

class Offboarding(TimestampedModel):
    class Status(models.TextChoices):
        INITIATED = "initiated", "Initiated"
        DEPOSIT_SETTLED = "deposit_settled", "Deposit Settled"
        FINAL_RENT_PAID = "final_rent_paid", "Final Rent Paid"
        HANDOFF_COMPLETE = "handoff_complete", "Handoff Complete"
        UNDER_MAINTENANCE = "under_maintenance", "Under Maintenance"
        COMPLETED = "completed", "Completed"

    tenancy = models.OneToOneField(Tenancy, on_delete=models.CASCADE, related_name="offboarding")
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.INITIATED)
    handoff_document_url = models.URLField(max_length=500, blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"Offboarding – {self.get_status_display()} ({self.tenancy})"
