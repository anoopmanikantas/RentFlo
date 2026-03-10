import json
import os
import uuid
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings


# ---------------------------------------------------------------------------
# Google ID-token verification
# ---------------------------------------------------------------------------

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")


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
