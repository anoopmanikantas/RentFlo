from decimal import Decimal

from django.contrib.auth import authenticate
from django.db.models import Sum
from rest_framework import serializers
from rest_framework.authtoken.models import Token

from .models import (
    AddOn, Agreement, BankAccount, Building, Deposit, Offboarding, RazorpayOrder,
    Payment, Subscription, Tenancy, TenantDocument, Ticket, Unit, User, TIER_LIMITS, ADDON_CATALOG,
)
from .services import find_user_by_phone, normalize_phone


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name", "email", "phone", "role", "tenant_code")


class AuthLoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(username=attrs["username"], password=attrs["password"])
        if not user:
            raise serializers.ValidationError("Invalid credentials.")
        attrs["user"] = user
        return attrs


class SignupSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    first_name = serializers.CharField(max_length=150, required=False, default="")
    last_name = serializers.CharField(max_length=150, required=False, default="")
    phone = serializers.CharField(max_length=32, required=False, default="")
    role = serializers.ChoiceField(choices=User.Role.choices)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already registered.")
        return value

    def validate_phone(self, value):
        normalized = normalize_phone(value)
        if not normalized:
            return ""
        existing = find_user_by_phone(normalized)
        if existing:
            raise serializers.ValidationError("Phone number already registered.")
        return normalized

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class GoogleLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField()
    role = serializers.ChoiceField(choices=User.Role.choices, required=False)


class FirebaseLandlordAuthSerializer(serializers.Serializer):
    id_token = serializers.CharField()
    first_name = serializers.CharField(max_length=150, required=False, default="")
    last_name = serializers.CharField(max_length=150, required=False, default="")
    phone = serializers.CharField(max_length=32, required=False, default="")

    def validate_phone(self, value):
        normalized = normalize_phone(value)
        if not normalized:
            return ""
        return normalized


class AuthResponseSerializer(serializers.Serializer):
    token = serializers.CharField()
    user = UserSerializer()

    @staticmethod
    def from_user(user):
        token = Token.objects.filter(user=user).order_by("created").first()
        if not token:
            token = Token.objects.create(user=user)
        Token.objects.filter(user=user).exclude(key=token.key).delete()
        return {
            "token": token.key,
            "user": UserSerializer(user).data,
        }


class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = ("id", "bank_name", "account_name", "account_number", "ifsc")


class BuildingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Building
        fields = ("id", "name", "address")


class UnitSerializer(serializers.ModelSerializer):
    building_name = serializers.CharField(source="building.name", read_only=True)

    class Meta:
        model = Unit
        fields = ("id", "building", "building_name", "label", "monthly_rent")


class TenantSummarySerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source="tenant_user.get_full_name", read_only=True)
    tenant_email = serializers.CharField(source="tenant_user.email", read_only=True)
    tenant_phone = serializers.CharField(source="tenant_user.phone", read_only=True)
    tenant_code = serializers.CharField(source="tenant_user.tenant_code", read_only=True)
    building_name = serializers.CharField(source="unit.building.name", read_only=True)
    unit_label = serializers.CharField(source="unit.label", read_only=True)
    monthly_rent = serializers.DecimalField(source="unit.monthly_rent", max_digits=12, decimal_places=2, read_only=True)
    paid_this_month = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Tenancy
        fields = (
            "id",
            "tenant_name",
            "tenant_email",
            "tenant_phone",
            "tenant_code",
            "building_name",
            "unit_label",
            "monthly_rent",
            "paid_this_month",
            "balance",
            "status",
            "start_date",
        )

    def _month_total(self, obj):
        month = self.context["rent_month"]
        amount = obj.payments.filter(rent_month=month, status=Payment.Status.SUCCEEDED).aggregate(total=Sum("amount"))[
            "total"
        ]
        return amount or Decimal("0.00")

    def get_paid_this_month(self, obj):
        return self._month_total(obj)

    def get_balance(self, obj):
        paid = self._month_total(obj)
        return max(obj.unit.monthly_rent - paid, Decimal("0.00"))

    def get_status(self, obj):
        paid = self._month_total(obj)
        if paid <= 0:
            return "not_paid"
        if paid >= obj.unit.monthly_rent:
            return "paid"
        return "part_paid"


class PaymentSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source="tenancy.tenant_user.get_full_name", read_only=True)
    building_name = serializers.CharField(source="unit.building.name", read_only=True)
    unit_label = serializers.CharField(source="unit.label", read_only=True)
    bank_name = serializers.CharField(source="bank_account.bank_name", read_only=True)
    account_number = serializers.CharField(source="bank_account.account_number", read_only=True)

    class Meta:
        model = Payment
        fields = (
            "id",
            "tenant_name",
            "building_name",
            "unit_label",
            "rent_month",
            "paid_on",
            "bank_name",
            "account_number",
            "amount",
            "reference",
            "status",
            "provider_payment_id",
        )


class TenantDashboardSerializer(serializers.Serializer):
    tenancy = TenantSummarySerializer()
    bank_accounts = BankAccountSerializer(many=True)
    payments = PaymentSerializer(many=True)
    current_month = serializers.CharField()
    current_month_paid = serializers.DecimalField(max_digits=12, decimal_places=2)
    current_month_balance = serializers.DecimalField(max_digits=12, decimal_places=2)


class LandlordDashboardSerializer(serializers.Serializer):
    summary = serializers.DictField()
    bank_accounts = BankAccountSerializer(many=True)
    buildings = BuildingSerializer(many=True)
    units = UnitSerializer(many=True)
    tenants = TenantSummarySerializer(many=True)
    payments = PaymentSerializer(many=True)
    current_month = serializers.CharField()


class InitiatePaymentSerializer(serializers.Serializer):
    bank_account_id = serializers.IntegerField()
    rent_month = serializers.RegexField(r"^\d{4}-\d{2}$")
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)


class ConfirmPaymentSerializer(serializers.Serializer):
    order_id = serializers.CharField()
    status = serializers.ChoiceField(choices=RazorpayOrder.Status.choices)
    provider_payment_id = serializers.CharField(required=False, allow_blank=True)
    razorpay_signature = serializers.CharField(required=False, allow_blank=True)
    provider_payload = serializers.JSONField(required=False)


class UpdateRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=User.Role.choices)


class CreateBuildingSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    address = serializers.CharField()


class CreateUnitSerializer(serializers.Serializer):
    building_id = serializers.IntegerField()
    label = serializers.CharField(max_length=80)
    monthly_rent = serializers.DecimalField(max_digits=12, decimal_places=2)


class CreateBankAccountSerializer(serializers.Serializer):
    bank_name = serializers.CharField(max_length=120)
    account_name = serializers.CharField(max_length=120)
    account_number = serializers.CharField(max_length=64)
    ifsc = serializers.CharField(max_length=32, required=False, default="")


class CreateTenancySerializer(serializers.Serializer):
    tenant_identifier = serializers.CharField(help_text="Tenant code (RF-XXXX) or email address")
    unit_id = serializers.IntegerField()


# ---------------------------------------------------------------------------
# Subscription & Add-on serializers
# ---------------------------------------------------------------------------

class AddOnSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    price_monthly = serializers.SerializerMethodField()

    class Meta:
        model = AddOn
        fields = ("feature", "name", "is_active", "price_monthly", "created_at")

    def get_name(self, obj):
        return ADDON_CATALOG.get(obj.feature, {}).get("name", obj.feature)

    def get_price_monthly(self, obj):
        return ADDON_CATALOG.get(obj.feature, {}).get("price_monthly", 0)


class SubscriptionSerializer(serializers.ModelSerializer):
    units_used = serializers.IntegerField(read_only=True)
    tenants_used = serializers.IntegerField(read_only=True)
    add_ons = serializers.SerializerMethodField()

    class Meta:
        model = Subscription
        fields = (
            "tier", "max_units", "max_tenants", "valid_until", "is_active",
            "units_used", "tenants_used", "add_ons",
        )

    def get_add_ons(self, obj):
        addons = AddOn.objects.filter(landlord=obj.landlord, is_active=True)
        return AddOnSerializer(addons, many=True).data


class PlanSerializer(serializers.Serializer):
    tier = serializers.CharField()
    name = serializers.CharField()
    price_monthly = serializers.IntegerField()
    max_units = serializers.IntegerField()
    max_tenants = serializers.IntegerField()
    features = serializers.ListField(child=serializers.CharField())


class UpgradeSubscriptionSerializer(serializers.Serializer):
    tier = serializers.ChoiceField(choices=[("pro", "Pro"), ("business", "Business")])


class ActivateAddOnSerializer(serializers.Serializer):
    feature = serializers.ChoiceField(choices=AddOn.Feature.choices)


# ---------------------------------------------------------------------------
# Onboarding serializers
# ---------------------------------------------------------------------------

class TenantDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantDocument
        fields = ("id", "doc_type", "doc_number", "file_url", "verified", "created_at")


class UploadDocumentSerializer(serializers.Serializer):
    doc_type = serializers.ChoiceField(choices=TenantDocument.DocType.choices)
    doc_number = serializers.CharField(max_length=60, required=False, default="")
    file_url = serializers.URLField(max_length=500, required=False, default="")


class DepositSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deposit
        fields = (
            "id", "amount", "paid_on", "status",
            "deductions", "deduction_reasons", "refund_amount", "refunded_on",
        )


class CreateDepositSerializer(serializers.Serializer):
    tenancy_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)


class PayDepositSerializer(serializers.Serializer):
    tenancy_id = serializers.IntegerField()


class AgreementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Agreement
        fields = ("id", "agreement_fee", "fee_paid", "signed_date", "document_url", "status")


class CreateAgreementSerializer(serializers.Serializer):
    tenancy_id = serializers.IntegerField()
    agreement_fee = serializers.DecimalField(max_digits=12, decimal_places=2)
    document_url = serializers.URLField(max_length=500, required=False, default="")


class SignAgreementSerializer(serializers.Serializer):
    tenancy_id = serializers.IntegerField()


class OnboardingStatusSerializer(serializers.Serializer):
    tenancy_id = serializers.IntegerField(source="id")
    tenant_name = serializers.CharField(source="tenant_user.get_full_name")
    unit_label = serializers.CharField(source="unit.label")
    building_name = serializers.CharField(source="unit.building.name")
    onboarding_status = serializers.CharField()
    documents = serializers.SerializerMethodField()
    deposit = serializers.SerializerMethodField()
    agreement = serializers.SerializerMethodField()

    def get_documents(self, obj):
        return TenantDocumentSerializer(obj.documents.all(), many=True).data

    def get_deposit(self, obj):
        try:
            return DepositSerializer(obj.deposit).data
        except Deposit.DoesNotExist:
            return None

    def get_agreement(self, obj):
        try:
            return AgreementSerializer(obj.agreement).data
        except Agreement.DoesNotExist:
            return None


# ---------------------------------------------------------------------------
# Ticket serializers
# ---------------------------------------------------------------------------

class TicketSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source="tenancy.tenant_user.get_full_name", read_only=True)
    unit_label = serializers.CharField(source="unit.label", read_only=True)
    building_name = serializers.CharField(source="unit.building.name", read_only=True)

    class Meta:
        model = Ticket
        fields = (
            "id", "tenant_name", "unit_label", "building_name",
            "subject", "description", "status", "resolution_provider",
            "resolution_notes", "receipt_url", "created_at", "updated_at",
        )


class CreateTicketSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=200)
    description = serializers.CharField()


class UpdateTicketSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Ticket.Status.choices, required=False)
    resolution_provider = serializers.ChoiceField(
        choices=Ticket.ResolutionProvider.choices, required=False, allow_blank=True,
    )
    resolution_notes = serializers.CharField(required=False, allow_blank=True)
    receipt_url = serializers.URLField(max_length=500, required=False, allow_blank=True)


# ---------------------------------------------------------------------------
# Offboarding serializers
# ---------------------------------------------------------------------------

class OffboardingSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source="tenancy.tenant_user.get_full_name", read_only=True)
    unit_label = serializers.CharField(source="tenancy.unit.label", read_only=True)
    building_name = serializers.CharField(source="tenancy.unit.building.name", read_only=True)
    deposit = serializers.SerializerMethodField()

    class Meta:
        model = Offboarding
        fields = (
            "id", "tenant_name", "unit_label", "building_name",
            "status", "handoff_document_url", "notes",
            "deposit", "created_at", "updated_at",
        )

    def get_deposit(self, obj):
        try:
            return DepositSerializer(obj.tenancy.deposit).data
        except Deposit.DoesNotExist:
            return None


class InitiateOffboardingSerializer(serializers.Serializer):
    tenancy_id = serializers.IntegerField()
    deductions = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    deduction_reasons = serializers.CharField(required=False, default="")


class SettleDepositSerializer(serializers.Serializer):
    tenancy_id = serializers.IntegerField()
    deductions = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    deduction_reasons = serializers.CharField(required=False, default="")


class CompleteHandoffSerializer(serializers.Serializer):
    tenancy_id = serializers.IntegerField()
    handoff_document_url = serializers.URLField(max_length=500, required=False, default="")


class ConfirmMaintenanceDoneSerializer(serializers.Serializer):
    tenancy_id = serializers.IntegerField()
