import json
import os
import uuid
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings


class JuspayClientError(Exception):
    pass


class JuspayClient:
    """
    Dev-friendly wrapper around Juspay order/session creation.
    In production, set:
    - JUSPAY_BASE_URL
    - JUSPAY_API_KEY
    - JUSPAY_MERCHANT_ID
    """

    def __init__(self):
        self.base_url = os.environ.get("JUSPAY_BASE_URL", "").rstrip("/")
        self.api_key = os.environ.get("JUSPAY_API_KEY", "")
        self.merchant_id = os.environ.get("JUSPAY_MERCHANT_ID", "")

    @property
    def configured(self):
        return bool(self.base_url and self.api_key and self.merchant_id)

    def create_order_session(self, *, order_id: str, amount: Decimal, customer_id: str, customer_email: str):
        if not self.configured:
            return {
                "provider": "juspay",
                "mode": "mock",
                "order_id": order_id,
                "juspay_order_id": f"mock_{order_id}",
                "payment_session_id": f"mock_session_{uuid.uuid4().hex}",
                "sdk_payload": {
                    "order_id": order_id,
                    "payment_session_id": f"mock_session_{uuid.uuid4().hex}",
                    "merchant_id": "mock_merchant",
                    "environment": "sandbox",
                },
            }

        payload = {
            "order_id": order_id,
            "amount": str(amount),
            "currency": "INR",
            "customer_id": customer_id,
            "customer_email": customer_email,
            "merchant_id": self.merchant_id,
            "return_url": getattr(settings, "JUSPAY_RETURN_URL", ""),
        }
        req = Request(
            f"{self.base_url}/orders",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": self.api_key,
                "Content-Type": "application/json",
                "x-merchantid": self.merchant_id,
            },
            method="POST",
        )
        try:
            with urlopen(req, timeout=20) as response:
                body = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError) as exc:
            raise JuspayClientError(str(exc)) from exc

        return {
            "provider": "juspay",
            "mode": "live",
            "order_id": order_id,
            "juspay_order_id": body.get("order_id", order_id),
            "payment_session_id": body.get("payment_session_id", ""),
            "sdk_payload": body,
        }
