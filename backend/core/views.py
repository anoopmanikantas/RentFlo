from datetime import date
from decimal import Decimal

from django.db.models import Sum
from rest_framework import permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BankAccount, Building, JuspayOrder, Payment, Tenancy, Unit, User
from .serializers import (
    AuthLoginSerializer,
    BankAccountSerializer,
    BuildingSerializer,
    ConfirmPaymentSerializer,
    CreateBankAccountSerializer,
    CreateBuildingSerializer,
    CreateTenancySerializer,
    CreateUnitSerializer,
    GoogleLoginSerializer,
    InitiatePaymentSerializer,
    PaymentSerializer,
    SignupSerializer,
    TenantSummarySerializer,
    UnitSerializer,
    UpdateRoleSerializer,
    UserSerializer,
)
from .services import RazorpayClient, RazorpayClientError, verify_google_id_token


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


class SignupView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {"token": token.key, "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


class GoogleLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = GoogleLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            google_info = verify_google_id_token(serializer.validated_data["id_token"])
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        email = google_info["email"]
        user = User.objects.filter(email=email).first()
        is_new = False
        if not user:
            is_new = True
            username = email.split("@")[0]
            base = username
            n = 1
            while User.objects.filter(username=username).exists():
                username = f"{base}{n}"
                n += 1
            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=google_info.get("given_name", ""),
                last_name=google_info.get("family_name", ""),
                role=User.Role.TENANT,
            )
            user.set_unusable_password()
            user.save()

        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": UserSerializer(user).data, "is_new": is_new})


class MeView(AuthenticatedAPIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UpdateRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.role = serializer.validated_data["role"]
        request.user.save(update_fields=["role"])
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
            return Response({
                "tenancy": None,
                "bank_accounts": [],
                "payments": [],
                "current_month": month,
                "current_month_paid": "0.00",
                "current_month_balance": "0.00",
            })

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

        client = RazorpayClient()
        try:
            remote = client.create_order(
                order_id=order.order_id,
                amount=order.amount,
                customer_email=request.user.email,
                customer_name=request.user.get_full_name(),
            )
        except RazorpayClientError as exc:
            order.status = JuspayOrder.Status.FAILED
            order.metadata = {"error": str(exc)}
            order.save(update_fields=["status", "metadata", "updated_at"])
            return Response({"detail": "Unable to create Razorpay order.", "error": str(exc)}, status=502)

        order.juspay_order_id = remote.get("razorpay_order_id", "")
        order.payment_session_id = ""  # not used by Razorpay
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
            provider="razorpay",
            provider_order_id=remote.get("razorpay_order_id", order.order_id),
            provider_payload=remote.get("sdk_payload", {}),
            juspay_order=order,
        )

        return Response(
            {
                "order_id": order.order_id,
                "payment_id": payment.id,
                "mode": remote["mode"],
                "provider": "razorpay",
                "razorpay_order_id": remote.get("razorpay_order_id", ""),
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

        client = RazorpayClient()
        resolved_status = serializer.validated_data["status"]
        provider_payment_id = serializer.validated_data.get("provider_payment_id", "")
        razorpay_signature = serializer.validated_data.get("razorpay_signature", "")
        provider_payload = serializer.validated_data.get("provider_payload", {})

        # Server-side signature verification with Razorpay
        if client.configured and provider_payment_id and razorpay_signature:
            sig_valid = client.verify_payment_signature(
                razorpay_order_id=order.juspay_order_id,  # stores razorpay_order_id
                razorpay_payment_id=provider_payment_id,
                razorpay_signature=razorpay_signature,
            )
            if sig_valid:
                resolved_status = JuspayOrder.Status.SUCCEEDED
                # Fetch full payment details for the record
                try:
                    provider_payload = client.fetch_payment(provider_payment_id)
                except RazorpayClientError:
                    pass
            else:
                resolved_status = JuspayOrder.Status.FAILED
        elif client.configured and provider_payment_id:
            # No signature supplied: fetch payment status directly
            try:
                remote = client.fetch_payment(provider_payment_id)
                provider_payload = remote
                rzp_status = remote.get("status", "")
                if rzp_status == "captured":
                    resolved_status = JuspayOrder.Status.SUCCEEDED
                elif rzp_status in ("failed", "refunded"):
                    resolved_status = JuspayOrder.Status.FAILED
                else:
                    resolved_status = JuspayOrder.Status.PENDING
            except RazorpayClientError:
                pass

        order.status = resolved_status
        order.metadata = provider_payload or order.metadata
        order.save(update_fields=["status", "metadata", "updated_at"])

        payment = Payment.objects.filter(juspay_order=order, tenancy=tenancy).first()
        if payment:
            payment.status = (
                Payment.Status.SUCCEEDED
                if resolved_status == JuspayOrder.Status.SUCCEEDED
                else Payment.Status.FAILED
            )
            payment.provider_payment_id = provider_payment_id
            payment.provider_payload = provider_payload or payment.provider_payload
            payment.save(update_fields=["status", "provider_payment_id", "provider_payload", "updated_at"])

        return Response({"detail": "Payment status updated."})


class CreateBuildingView(AuthenticatedAPIView):
    def post(self, request):
        if request.user.role != User.Role.LANDLORD:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        serializer = CreateBuildingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        building = Building.objects.create(landlord=request.user, **serializer.validated_data)
        return Response(BuildingSerializer(building).data, status=status.HTTP_201_CREATED)


class CreateUnitView(AuthenticatedAPIView):
    def post(self, request):
        if request.user.role != User.Role.LANDLORD:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        serializer = CreateUnitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        building = Building.objects.filter(
            id=serializer.validated_data["building_id"], landlord=request.user
        ).first()
        if not building:
            return Response({"detail": "Building not found"}, status=status.HTTP_404_NOT_FOUND)
        unit = Unit.objects.create(
            building=building,
            label=serializer.validated_data["label"],
            monthly_rent=serializer.validated_data["monthly_rent"],
        )
        return Response(UnitSerializer(unit).data, status=status.HTTP_201_CREATED)


class CreateBankAccountView(AuthenticatedAPIView):
    def post(self, request):
        if request.user.role != User.Role.LANDLORD:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        serializer = CreateBankAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = BankAccount.objects.create(landlord=request.user, **serializer.validated_data)
        return Response(BankAccountSerializer(account).data, status=status.HTTP_201_CREATED)


class CreateTenancyView(AuthenticatedAPIView):
    def post(self, request):
        if request.user.role != User.Role.LANDLORD:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        serializer = CreateTenancySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tenant = User.objects.filter(
            email=serializer.validated_data["tenant_email"], role=User.Role.TENANT
        ).first()
        if not tenant:
            return Response(
                {"detail": "No tenant account found with that email."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if Tenancy.objects.filter(tenant_user=tenant, is_active=True).exists():
            return Response(
                {"detail": "Tenant is already assigned to a unit."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        unit = Unit.objects.filter(
            id=serializer.validated_data["unit_id"], building__landlord=request.user
        ).first()
        if not unit:
            return Response({"detail": "Unit not found"}, status=status.HTTP_404_NOT_FOUND)
        if Tenancy.objects.filter(unit=unit, is_active=True).exists():
            return Response(
                {"detail": "Unit is already occupied."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        tenancy = Tenancy.objects.create(
            landlord=request.user,
            tenant_user=tenant,
            unit=unit,
            start_date=date.today(),
        )
        return Response(
            TenantSummarySerializer(tenancy, context={"rent_month": current_month()}).data,
            status=status.HTTP_201_CREATED,
        )
