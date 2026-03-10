import csv
import io
import uuid
from datetime import date
from decimal import Decimal

from django.db.models import Count, Sum
from django.http import HttpResponse
from rest_framework import permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AddOn, BankAccount, Building, JuspayOrder, Payment, Subscription, Tenancy, Unit, User, TIER_LIMITS, ADDON_CATALOG
from .serializers import (
    ActivateAddOnSerializer,
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
    PlanSerializer,
    SignupSerializer,
    SubscriptionSerializer,
    TenantSummarySerializer,
    UnitSerializer,
    UpdateRoleSerializer,
    UpgradeSubscriptionSerializer,
    UserSerializer,
)
from .services import RazorpayClient, RazorpayClientError, verify_google_id_token


def _resolve_tenant(identifier: str):
    """Resolve a tenant by code (RF-XXXX) or email."""
    identifier = identifier.strip()
    if identifier.upper().startswith("RF-"):
        return User.objects.filter(tenant_code__iexact=identifier, role=User.Role.TENANT).first()
    return User.objects.filter(email=identifier, role=User.Role.TENANT).first()


def current_month():
    return date.today().strftime("%Y-%m")


class AuthenticatedAPIView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]


def _ensure_subscription(user):
    """Return (or auto-create) the landlord's Subscription row."""
    sub, created = Subscription.objects.get_or_create(
        landlord=user,
        defaults={"tier": Subscription.Tier.FREE, "max_units": 5, "max_tenants": 5},
    )
    return sub


def _check_tier_limit(user, resource: str):
    """
    Check if the landlord can add another unit or tenant.
    Returns None if OK, else a DRF Response with 403.
    """
    sub = _ensure_subscription(user)
    if resource == "units":
        current = Unit.objects.filter(building__landlord=user).count()
        if current >= sub.max_units:
            return Response(
                {
                    "detail": f"{sub.get_tier_display()} plan limit: {sub.max_units} units. Upgrade to add more.",
                    "limit_type": "units",
                    "current": current,
                    "max": sub.max_units,
                    "tier": sub.tier,
                },
                status=status.HTTP_403_FORBIDDEN,
            )
    elif resource == "tenants":
        current = Tenancy.objects.filter(landlord=user, is_active=True).count()
        if current >= sub.max_tenants:
            return Response(
                {
                    "detail": f"{sub.get_tier_display()} plan limit: {sub.max_tenants} tenants. Upgrade to add more.",
                    "limit_type": "tenants",
                    "current": current,
                    "max": sub.max_tenants,
                    "tier": sub.tier,
                },
                status=status.HTTP_403_FORBIDDEN,
            )
    return None


def _has_feature(user, feature: str) -> bool:
    """Check if the landlord has access to a premium feature (via tier or add-on)."""
    sub = _ensure_subscription(user)
    tier_features = TIER_LIMITS.get(sub.tier, {}).get("features", [])
    if feature in tier_features:
        return True
    return AddOn.objects.filter(landlord=user, feature=feature, is_active=True).exists()


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
        if user.role == User.Role.LANDLORD:
            _ensure_subscription(user)
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
            "subscription": _get_subscription_payload(request.user, units.count(), tenancies.count()),
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

        order_id = f"rent_{tenancy.id}_{serializer.validated_data['rent_month']}_{uuid.uuid4().hex[:12]}"
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

        # NOTE: Payment record is NOT created here. It is created only when
        # the confirm endpoint receives a verified result. This prevents
        # orphaned "initiated" payments when checkout fails or is cancelled.

        return Response(
            {
                "order_id": order.order_id,
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

        # Create (or update) the Payment record now that we have a confirmed result.
        final_payment_status = (
            Payment.Status.SUCCEEDED
            if resolved_status == JuspayOrder.Status.SUCCEEDED
            else Payment.Status.FAILED
        )
        payment = Payment.objects.filter(juspay_order=order, tenancy=tenancy).first()
        if payment:
            payment.status = final_payment_status
            payment.provider_payment_id = provider_payment_id
            payment.provider_payload = provider_payload or payment.provider_payload
            payment.save(update_fields=["status", "provider_payment_id", "provider_payload", "updated_at"])
        else:
            payment = Payment.objects.create(
                landlord=tenancy.landlord,
                tenancy=tenancy,
                unit=tenancy.unit,
                bank_account=order.bank_account,
                rent_month=order.rent_month,
                amount=order.amount,
                paid_on=date.today(),
                status=final_payment_status,
                provider="razorpay",
                provider_order_id=order.juspay_order_id or order.order_id,
                provider_payment_id=provider_payment_id,
                provider_payload=provider_payload or {},
                juspay_order=order,
            )

        return Response({"detail": "Payment status updated.", "status": final_payment_status})


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
        limit_resp = _check_tier_limit(request.user, "units")
        if limit_resp:
            return limit_resp
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
        limit_resp = _check_tier_limit(request.user, "tenants")
        if limit_resp:
            return limit_resp
        serializer = CreateTenancySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tenant = _resolve_tenant(serializer.validated_data["tenant_identifier"])
        if not tenant:
            return Response(
                {"detail": "No tenant account found. Check the tenant code or email."},
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


class EndTenancyView(AuthenticatedAPIView):
    def post(self, request, tenancy_id):
        if request.user.role != User.Role.LANDLORD:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        tenancy = Tenancy.objects.filter(
            id=tenancy_id, landlord=request.user, is_active=True
        ).first()
        if not tenancy:
            return Response({"detail": "Active tenancy not found."}, status=status.HTTP_404_NOT_FOUND)
        tenancy.is_active = False
        tenancy.save(update_fields=["is_active", "updated_at"])
        return Response({"detail": f"Tenancy ended for {tenancy.tenant_user.get_full_name()}."})


# ---------------------------------------------------------------------------
# Subscription helper
# ---------------------------------------------------------------------------

def _get_subscription_payload(user, units_used: int, tenants_used: int) -> dict:
    sub = _ensure_subscription(user)
    addons = AddOn.objects.filter(landlord=user, is_active=True)
    addon_features = list(addons.values_list("feature", flat=True))
    tier_features = TIER_LIMITS.get(sub.tier, {}).get("features", [])
    has_analytics = "analytics" in tier_features or "analytics" in addon_features
    has_reports = "reports_export" in tier_features or "reports_export" in addon_features
    return {
        "tier": sub.tier,
        "max_units": sub.max_units,
        "max_tenants": sub.max_tenants,
        "units_used": units_used,
        "tenants_used": tenants_used,
        "valid_until": sub.valid_until,
        "is_active": sub.is_active,
        "has_analytics": has_analytics,
        "has_reports": has_reports,
        "add_ons": [{"feature": a.feature, "is_active": a.is_active} for a in addons],
    }


# ---------------------------------------------------------------------------
# Subscription & Plans endpoints
# ---------------------------------------------------------------------------

class SubscriptionView(AuthenticatedAPIView):
    """GET current subscription + available plans."""

    def get(self, request):
        if request.user.role != User.Role.LANDLORD:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        units_used = Unit.objects.filter(building__landlord=request.user).count()
        tenants_used = Tenancy.objects.filter(landlord=request.user, is_active=True).count()
        subscription = _get_subscription_payload(request.user, units_used, tenants_used)

        plans = []
        for tier_key, limits in TIER_LIMITS.items():
            feature_names = []
            for f in limits["features"]:
                feature_names.append(ADDON_CATALOG.get(f, {}).get("name", f))
            plans.append({
                "tier": tier_key,
                "name": tier_key.capitalize(),
                "price_monthly": limits["price_monthly"],
                "max_units": limits["max_units"],
                "max_tenants": limits["max_tenants"],
                "features": feature_names,
            })

        addons_catalog = []
        for feature_key, info in ADDON_CATALOG.items():
            already_active = AddOn.objects.filter(landlord=request.user, feature=feature_key, is_active=True).exists()
            included_in_tier = feature_key in TIER_LIMITS.get(subscription["tier"], {}).get("features", [])
            addons_catalog.append({
                "feature": feature_key,
                "name": info["name"],
                "price_monthly": info["price_monthly"],
                "is_active": already_active,
                "included_in_tier": included_in_tier,
            })

        return Response({
            "subscription": subscription,
            "plans": plans,
            "addons_catalog": addons_catalog,
        })


class UpgradeSubscriptionView(AuthenticatedAPIView):
    """POST to upgrade the subscription tier (Razorpay checkout)."""

    def post(self, request):
        if request.user.role != User.Role.LANDLORD:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        serializer = UpgradeSubscriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_tier = serializer.validated_data["tier"]

        sub = _ensure_subscription(request.user)
        tier_order = {"free": 0, "pro": 1, "business": 2}
        if tier_order.get(target_tier, 0) <= tier_order.get(sub.tier, 0):
            return Response(
                {"detail": f"You are already on {sub.get_tier_display()} or higher."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        limits = TIER_LIMITS[target_tier]
        client = RazorpayClient()
        try:
            order_data = client.create_order(
                order_id=f"sub_upgrade_{request.user.id}_{target_tier}_{uuid.uuid4().hex[:8]}",
                amount=Decimal(str(limits["price_monthly"])),
                customer_email=request.user.email,
                customer_name=request.user.get_full_name(),
            )
        except RazorpayClientError as exc:
            return Response({"detail": str(exc)}, status=502)

        return Response({
            "target_tier": target_tier,
            "price_monthly": limits["price_monthly"],
            "mode": order_data["mode"],
            "provider": "razorpay",
            "order_id": order_data["order_id"],
            "razorpay_order_id": order_data.get("razorpay_order_id", ""),
            "sdk_payload": order_data["sdk_payload"],
        }, status=status.HTTP_201_CREATED)


class ConfirmUpgradeView(AuthenticatedAPIView):
    """POST to finalize a tier upgrade after Razorpay payment."""

    def post(self, request):
        if request.user.role != User.Role.LANDLORD:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        target_tier = request.data.get("tier")
        if target_tier not in ("pro", "business"):
            return Response({"detail": "Invalid tier."}, status=status.HTTP_400_BAD_REQUEST)

        # In mock mode we trust the client; in live mode you'd verify the
        # Razorpay signature here (same pattern as ConfirmTenantPaymentView).
        sub = _ensure_subscription(request.user)
        sub.apply_tier_limits(target_tier)
        sub.razorpay_subscription_id = request.data.get("razorpay_subscription_id", "")
        sub.save()

        return Response({
            "detail": f"Upgraded to {sub.get_tier_display()}.",
            "tier": sub.tier,
            "max_units": sub.max_units,
            "max_tenants": sub.max_tenants,
        })


class ActivateAddOnView(AuthenticatedAPIView):
    """POST to purchase an add-on feature."""

    def post(self, request):
        if request.user.role != User.Role.LANDLORD:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        serializer = ActivateAddOnSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        feature = serializer.validated_data["feature"]

        # Already included in tier?
        sub = _ensure_subscription(request.user)
        tier_features = TIER_LIMITS.get(sub.tier, {}).get("features", [])
        if feature in tier_features:
            return Response(
                {"detail": f"Already included in your {sub.get_tier_display()} plan."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        addon, created = AddOn.objects.get_or_create(
            landlord=request.user,
            feature=feature,
            defaults={"is_active": False},
        )
        if addon.is_active:
            return Response({"detail": "Add-on already active."}, status=status.HTTP_400_BAD_REQUEST)

        catalog = ADDON_CATALOG.get(feature, {})
        client = RazorpayClient()
        try:
            order_data = client.create_order(
                order_id=f"addon_{request.user.id}_{feature}_{uuid.uuid4().hex[:8]}",
                amount=Decimal(str(catalog.get("price_monthly", 0))),
                customer_email=request.user.email,
                customer_name=request.user.get_full_name(),
            )
        except RazorpayClientError as exc:
            return Response({"detail": str(exc)}, status=502)

        return Response({
            "feature": feature,
            "price_monthly": catalog.get("price_monthly", 0),
            "mode": order_data["mode"],
            "provider": "razorpay",
            "order_id": order_data["order_id"],
            "razorpay_order_id": order_data.get("razorpay_order_id", ""),
            "sdk_payload": order_data["sdk_payload"],
        }, status=status.HTTP_201_CREATED)


class ConfirmAddOnView(AuthenticatedAPIView):
    """POST to finalize add-on purchase after Razorpay payment."""

    def post(self, request):
        if request.user.role != User.Role.LANDLORD:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        feature = request.data.get("feature")
        if feature not in dict(AddOn.Feature.choices):
            return Response({"detail": "Invalid feature."}, status=status.HTTP_400_BAD_REQUEST)

        addon, _ = AddOn.objects.get_or_create(
            landlord=request.user,
            feature=feature,
            defaults={"is_active": True},
        )
        addon.is_active = True
        addon.razorpay_subscription_id = request.data.get("razorpay_subscription_id", "")
        addon.save()

        return Response({
            "detail": f"{ADDON_CATALOG.get(feature, {}).get('name', feature)} activated.",
            "feature": feature,
            "is_active": True,
        })


# ---------------------------------------------------------------------------
# Analytics Dashboard (premium feature)
# ---------------------------------------------------------------------------

class AnalyticsDashboardView(AuthenticatedAPIView):
    def get(self, request):
        if request.user.role != User.Role.LANDLORD:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        if not _has_feature(request.user, "analytics"):
            return Response(
                {"detail": "Analytics requires the Pro plan or the Analytics add-on.", "feature": "analytics"},
                status=status.HTTP_403_FORBIDDEN,
            )

        today = date.today()
        # Last 6 months revenue trend
        revenue_trend = []
        for i in range(5, -1, -1):
            m = today.month - i
            y = today.year
            while m <= 0:
                m += 12
                y -= 1
            month_str = f"{y}-{m:02d}"
            total = (
                Payment.objects.filter(
                    landlord=request.user, rent_month=month_str, status=Payment.Status.SUCCEEDED,
                ).aggregate(total=Sum("amount"))["total"]
                or Decimal("0.00")
            )
            revenue_trend.append({"month": month_str, "collected": total})

        total_units = Unit.objects.filter(building__landlord=request.user).count()
        occupied_units = Tenancy.objects.filter(landlord=request.user, is_active=True).count()
        occupancy_rate = round(occupied_units / total_units * 100, 1) if total_units else 0

        # Collection rate for current month
        month = current_month()
        monthly_due = sum(
            t.unit.monthly_rent
            for t in Tenancy.objects.filter(landlord=request.user, is_active=True).select_related("unit")
        )
        monthly_collected = (
            Payment.objects.filter(
                landlord=request.user, rent_month=month, status=Payment.Status.SUCCEEDED,
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )
        collection_rate = round(float(monthly_collected) / float(monthly_due) * 100, 1) if monthly_due else 0

        # Top tenants by total payment
        top_tenants = (
            Payment.objects.filter(landlord=request.user, status=Payment.Status.SUCCEEDED)
            .values("tenancy__tenant_user__first_name", "tenancy__tenant_user__last_name")
            .annotate(total_paid=Sum("amount"))
            .order_by("-total_paid")[:5]
        )
        top_tenants_list = [
            {
                "name": f"{t['tenancy__tenant_user__first_name']} {t['tenancy__tenant_user__last_name']}".strip(),
                "total_paid": t["total_paid"],
            }
            for t in top_tenants
        ]

        return Response({
            "revenue_trend": revenue_trend,
            "occupancy_rate": occupancy_rate,
            "total_units": total_units,
            "occupied_units": occupied_units,
            "collection_rate": collection_rate,
            "monthly_due": monthly_due,
            "monthly_collected": monthly_collected,
            "top_tenants": top_tenants_list,
            "current_month": month,
        })


# ---------------------------------------------------------------------------
# Payment Reports Export (premium feature)
# ---------------------------------------------------------------------------

class PaymentReportExportView(AuthenticatedAPIView):
    def get(self, request):
        if request.user.role != User.Role.LANDLORD:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        if not _has_feature(request.user, "reports_export"):
            return Response(
                {"detail": "Reports export requires the Business plan or the Reports Export add-on.", "feature": "reports_export"},
                status=status.HTTP_403_FORBIDDEN,
            )

        from_month = request.query_params.get("from", "")
        to_month = request.query_params.get("to", "")

        qs = Payment.objects.filter(landlord=request.user).select_related(
            "tenancy__tenant_user", "unit__building", "bank_account",
        ).order_by("-paid_on", "-created_at")

        if from_month:
            qs = qs.filter(rent_month__gte=from_month)
        if to_month:
            qs = qs.filter(rent_month__lte=to_month)

        fmt = request.query_params.get("format", "csv")
        if fmt == "json":
            return Response(PaymentSerializer(qs, many=True).data)

        # CSV export
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Tenant", "Building", "Unit", "Month", "Amount", "Paid On",
            "Bank", "Account", "Status", "Reference", "Provider Payment ID",
        ])
        for p in qs:
            writer.writerow([
                p.tenancy.tenant_user.get_full_name(),
                p.unit.building.name,
                p.unit.label,
                p.rent_month,
                str(p.amount),
                str(p.paid_on),
                p.bank_account.bank_name,
                p.bank_account.account_number,
                p.status,
                p.reference,
                p.provider_payment_id,
            ])

        response = HttpResponse(output.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="rentflo_payments_{date.today()}.csv"'
        return response
