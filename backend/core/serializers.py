from decimal import Decimal

from django.contrib.auth import authenticate
from django.db.models import Sum
from rest_framework import serializers
from rest_framework.authtoken.models import Token

from .models import BankAccount, Building, JuspayOrder, Payment, Tenancy, Unit, User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name", "email", "phone", "role")


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

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class GoogleLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField()
    role = serializers.ChoiceField(choices=User.Role.choices, required=False)


class AuthResponseSerializer(serializers.Serializer):
    token = serializers.CharField()
    user = UserSerializer()

    @staticmethod
    def from_user(user):
        token, _ = Token.objects.get_or_create(user=user)
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
    status = serializers.ChoiceField(choices=JuspayOrder.Status.choices)
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
    tenant_email = serializers.EmailField()
    unit_id = serializers.IntegerField()

