import json
import os
import re
import uuid
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


# ---------------------------------------------------------------------------
# Google ID-token verification
# ---------------------------------------------------------------------------

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
FIREBASE_API_KEY = os.environ.get("FIREBASE_API_KEY") or os.environ.get("EXPO_PUBLIC_FIREBASE_API_KEY", "")
FIREBASE_LANDLORD_AUTH_ENABLED = os.environ.get("FIREBASE_LANDLORD_AUTH_ENABLED", "false").lower() == "true"


def normalize_phone(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    keep_plus = raw.startswith("+")
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""
    return f"+{digits}" if keep_plus or len(digits) > 10 else digits


def find_user_by_phone(phone: str):
    from .models import User

    normalized = normalize_phone(phone)
    if not normalized:
        return None
    for user in User.objects.exclude(phone=""):
        if normalize_phone(user.phone) == normalized:
            return user
    return None


class FirebaseAuthError(Exception):
    pass


def is_firebase_landlord_auth_enabled() -> bool:
    return FIREBASE_LANDLORD_AUTH_ENABLED


def verify_firebase_id_token(id_token: str) -> dict:
    if not FIREBASE_LANDLORD_AUTH_ENABLED:
        raise FirebaseAuthError("Firebase landlord auth is disabled.")

    if not FIREBASE_API_KEY:
        raise FirebaseAuthError("Firebase auth is not configured on the server.")

    payload = json.dumps({"idToken": id_token}).encode("utf-8")
    request = Request(
        f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={FIREBASE_API_KEY}",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=15) as response:
            body = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = "Firebase token verification failed."
        try:
            error_body = json.loads(exc.read().decode("utf-8"))
        except ValueError:
            error_body = {}
        message = error_body.get("error", {}).get("message")
        if message:
            detail = f"Firebase token verification failed: {message}"
        raise FirebaseAuthError(detail) from exc
    except URLError as exc:
        raise FirebaseAuthError(f"Firebase token verification failed: {exc}") from exc

    users = body.get("users") or []
    if not users:
        raise FirebaseAuthError("Firebase token verification failed.")

    user = users[0]
    email = (user.get("email") or "").strip().lower()
    if not email:
        raise FirebaseAuthError("Firebase account did not include an email address.")

    return {
        "uid": user.get("localId", ""),
        "email": email,
        "display_name": (user.get("displayName") or "").strip(),
        "phone": normalize_phone(user.get("phoneNumber", "")),
        "email_verified": bool(user.get("emailVerified")),
    }


def verify_google_id_token(id_token: str) -> dict:
    """
    Verify a Google Sign-In *id_token* using Google's tokeninfo endpoint.
    Returns the decoded payload dict with at least 'email', 'given_name',
    'family_name' on success; raises ValueError on failure.
    """
    url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
    try:
        with urlopen(url, timeout=10) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError) as exc:
        raise ValueError(f"Google token verification failed: {exc}") from exc

    # Verify the audience matches our client id (if configured)
    if GOOGLE_CLIENT_ID and payload.get("aud") != GOOGLE_CLIENT_ID:
        raise ValueError("Token audience mismatch.")

    if not payload.get("email"):
        raise ValueError("Google token did not contain an email.")

    if payload.get("email_verified") == "false":
        raise ValueError("Google account email is not verified.")

    return payload


# ---------------------------------------------------------------------------
# Razorpay payment client  (UPI = 0% MDR, Cards ~2%)
# ---------------------------------------------------------------------------

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")


class RazorpayClientError(Exception):
    pass


class RazorpayClient:
    """
    Thin wrapper around Razorpay Orders API.
    Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to go live.
    Without them, a mock payload is returned so the app remains testable.
    """

    API_BASE = "https://api.razorpay.com/v1"

    def __init__(self):
        self.key_id = RAZORPAY_KEY_ID
        self.key_secret = RAZORPAY_KEY_SECRET

    @property
    def configured(self):
        return bool(self.key_id and self.key_secret)

    def _auth_header(self) -> str:
        import base64
        creds = f"{self.key_id}:{self.key_secret}"
        return "Basic " + base64.b64encode(creds.encode()).decode()

    # ---- Create order ------------------------------------------------
    def create_order(self, *, order_id: str, amount: Decimal, currency: str = "INR",
                     customer_email: str = "", customer_name: str = "") -> dict:
        """
        Create a Razorpay Order. `amount` must be in major currency units
        (rupees); Razorpay expects *paise*, so we convert here.
        """
        if not self.configured:
            mock_rzp_order_id = f"order_mock_{uuid.uuid4().hex[:16]}"
            return {
                "provider": "razorpay",
                "mode": "mock",
                "order_id": order_id,
                "razorpay_order_id": mock_rzp_order_id,
                "sdk_payload": {
                    "key": "rzp_test_mock",
                    "amount": int(amount * 100),
                    "currency": currency,
                    "name": "RentFlo",
                    "description": f"Rent payment {order_id}",
                    "order_id": mock_rzp_order_id,
                    "prefill": {"email": customer_email, "contact": ""},
                    "theme": {"color": "#b85c38"},
                },
            }

        payload = json.dumps({
            "amount": int(amount * 100),  # paise
            "currency": currency,
            "receipt": order_id,
            "notes": {"internal_order_id": order_id},
        }).encode("utf-8")

        req = Request(
            f"{self.API_BASE}/orders",
            data=payload,
            headers={
                "Authorization": self._auth_header(),
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(req, timeout=20) as resp:
                body = json.loads(resp.read().decode("utf-8"))
        except (HTTPError, URLError) as exc:
            raise RazorpayClientError(str(exc)) from exc

        rzp_order_id = body["id"]
        return {
            "provider": "razorpay",
            "mode": "live",
            "order_id": order_id,
            "razorpay_order_id": rzp_order_id,
            "sdk_payload": {
                "key": self.key_id,
                "amount": body["amount"],
                "currency": body["currency"],
                "name": "RentFlo",
                "description": f"Rent payment {order_id}",
                "order_id": rzp_order_id,
                "prefill": {"email": customer_email, "contact": ""},
                "theme": {"color": "#b85c38"},
            },
        }

    # ---- Verify payment signature ------------------------------------
    def verify_payment_signature(self, *, razorpay_order_id: str,
                                 razorpay_payment_id: str,
                                 razorpay_signature: str) -> bool:
        """
        HMAC-SHA256 verification as per Razorpay docs.
        Returns True if the signature is valid.
        """
        if not self.configured:
            return True  # mock mode always passes

        import hmac
        import hashlib
        message = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected = hmac.new(
            self.key_secret.encode(),
            message.encode(),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, razorpay_signature)

    # ---- Fetch payment details ---------------------------------------
    def fetch_payment(self, payment_id: str) -> dict:
        if not self.configured:
            return {"id": payment_id, "status": "captured", "method": "upi", "mode": "mock"}

        req = Request(
            f"{self.API_BASE}/payments/{payment_id}",
            headers={"Authorization": self._auth_header()},
            method="GET",
        )
        try:
            with urlopen(req, timeout=20) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (HTTPError, URLError) as exc:
            raise RazorpayClientError(str(exc)) from exc
