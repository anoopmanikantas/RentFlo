from datetime import date
from decimal import Decimal

from django.db.models import Sum
from rest_framework import permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BankAccount, JuspayOrder, Payment, Tenancy, Unit, User
from .serializers import (
    AuthLoginSerializer,
    BankAccountSerializer,
    BuildingSerializer,
    ConfirmPaymentSerializer,
    InitiatePaymentSerializer,
    PaymentSerializer,
    TenantSummarySerializer,
    UnitSerializer,
    UserSerializer,
)
from .services import JuspayClient, JuspayClientError


def current_month():
    return date.today().strftime("%Y-%m")


class AuthenticatedAPIView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = AuthLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": UserSerializer(user).data})


class MeView(AuthenticatedAPIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class LandlordDashboardView(AuthenticatedAPIView):
    def get(self, request):
        if request.user.role != User.Role.LANDLORD:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        month = current_month()
        bank_accounts = BankAccount.objects.filter(landlord=request.user).order_by("bank_name")
        units = Unit.objects.filter(building__landlord=request.user).select_related("building").order_by(
            "building__name", "label"
        )
        tenancies = (
            Tenancy.objects.filter(landlord=request.user, is_active=True)
            .select_related("tenant_user", "unit", "unit__building")
            .order_by("unit__building__name", "unit__label")
        )
        payments = (
            Payment.objects.filter(landlord=request.user)
            .select_related("tenancy__tenant_user", "unit__building", "bank_account")
            .order_by("-paid_on", "-created_at")
        )

        monthly_due = sum(tenancy.unit.monthly_rent for tenancy in tenancies)
        monthly_collected = (
            Payment.objects.filter(landlord=request.user, rent_month=month, status=Payment.Status.SUCCEEDED).aggregate(
                total=Sum("amount")
            )["total"]
            or Decimal("0.00")
        )

        payload = {
            "summary": {
                "building_count": request.user.buildings.count(),
                "unit_count": units.count(),
                "tenant_count": tenancies.count(),
                "monthly_due": monthly_due,
                "monthly_collected": monthly_collected,
                "monthly_outstanding": max(monthly_due - monthly_collected, Decimal("0.00")),
            },
            "bank_accounts": BankAccountSerializer(bank_accounts, many=True).data,
            "buildings": BuildingSerializer(request.user.buildings.all().order_by("name"), many=True).data,
            "units": UnitSerializer(units, many=True).data,
            "tenants": TenantSummarySerializer(tenancies, many=True, context={"rent_month": month}).data,
            "payments": PaymentSerializer(payments, many=True).data,
            "current_month": month,
        }
        return Response(payload)


class TenantDashboardView(AuthenticatedAPIView):
    def get(self, request):
        if request.user.role != User.Role.TENANT:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        month = current_month()
        tenancy = (
            Tenancy.objects.filter(tenant_user=request.user, is_active=True)
            .select_related("tenant_user", "unit", "unit__building", "landlord")
            .first()
        )
        if not tenancy:
            return Response({"detail": "Tenancy not found"}, status=status.HTTP_404_NOT_FOUND)

        payments = (
            Payment.objects.filter(tenancy=tenancy)
            .select_related("bank_account", "unit__building", "tenancy__tenant_user")
            .order_by("-paid_on", "-created_at")
        )
        current_month_paid = (
            payments.filter(rent_month=month, status=Payment.Status.SUCCEEDED).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )
        payload = {
            "tenancy": TenantSummarySerializer(tenancy, context={"rent_month": month}).data,
            "bank_accounts": BankAccountSerializer(tenancy.landlord.bank_accounts.all().order_by("bank_name"), many=True).data,
            "payments": PaymentSerializer(payments, many=True).data,
            "current_month": month,
            "current_month_paid": current_month_paid,
            "current_month_balance": max(tenancy.unit.monthly_rent - current_month_paid, Decimal("0.00")),
        }
        return Response(payload)


class InitiateTenantPaymentView(AuthenticatedAPIView):
    def post(self, request):
        if request.user.role != User.Role.TENANT:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        serializer = InitiatePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tenancy = (
            Tenancy.objects.filter(tenant_user=request.user, is_active=True)
            .select_related("landlord", "tenant_user", "unit")
            .first()
        )
        if not tenancy:
            return Response({"detail": "Tenancy not found"}, status=status.HTTP_404_NOT_FOUND)

        bank_account = BankAccount.objects.filter(
            id=serializer.validated_data["bank_account_id"], landlord=tenancy.landlord
        ).first()
        if not bank_account:
            return Response({"detail": "Bank account not found"}, status=status.HTTP_404_NOT_FOUND)

        order_id = f"rent_{tenancy.id}_{serializer.validated_data['rent_month']}_{date.today().strftime('%Y%m%d%H%M%S')}"
        order = JuspayOrder.objects.create(
            tenancy=tenancy,
            bank_account=bank_account,
            rent_month=serializer.validated_data["rent_month"],
            amount=serializer.validated_data["amount"],
            order_id=order_id,
            status=JuspayOrder.Status.CREATED,
        )

        client = JuspayClient()
        try:
            remote = client.create_order_session(
                order_id=order.order_id,
                amount=order.amount,
                customer_id=str(request.user.id),
                customer_email=request.user.email,
            )
        except JuspayClientError as exc:
            order.status = JuspayOrder.Status.FAILED
            order.metadata = {"error": str(exc)}
            order.save(update_fields=["status", "metadata", "updated_at"])
            return Response({"detail": "Unable to create Juspay order.", "error": str(exc)}, status=502)

        order.juspay_order_id = remote.get("juspay_order_id", "")
        order.payment_session_id = remote.get("payment_session_id", "")
        order.metadata = remote.get("sdk_payload", {})
        order.status = JuspayOrder.Status.PENDING
        order.save(update_fields=["juspay_order_id", "payment_session_id", "metadata", "status", "updated_at"])

        payment = Payment.objects.create(
            landlord=tenancy.landlord,
            tenancy=tenancy,
            unit=tenancy.unit,
            bank_account=bank_account,
            rent_month=order.rent_month,
            amount=order.amount,
            paid_on=date.today(),
            status=Payment.Status.INITIATED,
            provider_order_id=order.juspay_order_id or order.order_id,
            provider_payload=remote.get("sdk_payload", {}),
            juspay_order=order,
        )

        return Response(
            {
                "order_id": order.order_id,
                "payment_id": payment.id,
                "mode": remote["mode"],
                "provider": "juspay",
                "sdk_payload": remote["sdk_payload"],
            },
            status=status.HTTP_201_CREATED,
        )


class ConfirmTenantPaymentView(AuthenticatedAPIView):
    def post(self, request):
        serializer = ConfirmPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tenancy = (
            Tenancy.objects.filter(tenant_user=request.user, is_active=True)
            .select_related("landlord", "unit")
            .first()
        )
        if not tenancy:
            return Response({"detail": "Tenancy not found"}, status=status.HTTP_404_NOT_FOUND)

        order = JuspayOrder.objects.filter(order_id=serializer.validated_data["order_id"], tenancy=tenancy).first()
        if not order:
            return Response({"detail": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

        order.status = serializer.validated_data["status"]
        order.metadata = serializer.validated_data.get("provider_payload", order.metadata)
        order.save(update_fields=["status", "metadata", "updated_at"])

        payment = Payment.objects.filter(juspay_order=order, tenancy=tenancy).first()
        if payment:
            payment.status = (
                Payment.Status.SUCCEEDED
                if serializer.validated_data["status"] == JuspayOrder.Status.SUCCEEDED
                else Payment.Status.FAILED
            )
            payment.provider_payment_id = serializer.validated_data.get("provider_payment_id", "")
            payment.provider_payload = serializer.validated_data.get("provider_payload", payment.provider_payload)
            payment.save(update_fields=["status", "provider_payment_id", "provider_payload", "updated_at"])

        return Response({"detail": "Payment status updated."})
