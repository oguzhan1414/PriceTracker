import base64
import hashlib
import hmac
import json
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Optional

import httpx

from config import settings


@dataclass
class CheckoutRequest:
    provider: str
    plan: str
    interval: str


@dataclass
class CheckoutResult:
    provider: str
    checkout_url: str
    external_session_id: Optional[str]
    # For Iyzico: the raw token from checkout form init
    iyzico_token: Optional[str] = None


class PaymentService:
    def __init__(self, db):
        self.db = db
        self.payment_sessions = db["payment_sessions"]
        self.payment_events = db["payment_events"]

    def _ensure_payment_enabled(self):
        if not settings.payment_enabled:
            raise ValueError("Payments are disabled")

    async def _persist_session(
        self,
        *,
        user_id: str,
        user_email: str,
        req: CheckoutRequest,
        result: CheckoutResult,
    ):
        await self.payment_sessions.insert_one(
            {
                "user_id": user_id,
                "user_email": user_email,
                "provider": result.provider,
                "plan": req.plan,
                "interval": req.interval,
                "external_session_id": result.external_session_id,
                "iyzico_token": result.iyzico_token,
                "checkout_url": result.checkout_url,
                "status": "pending",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        )

    async def create_checkout(
        self,
        *,
        user: dict,
        req: CheckoutRequest,
    ) -> CheckoutResult:
        self._ensure_payment_enabled()

        provider = req.provider.lower().strip()
        if provider not in settings.payment_providers_enabled:
            raise ValueError(f"Provider '{provider}' is not enabled")

        if req.plan.lower().strip() != "pro":
            raise ValueError("Only 'pro' plan is currently supported")

        interval = req.interval.lower().strip()
        if interval not in {"monthly", "yearly"}:
            raise ValueError("interval must be 'monthly' or 'yearly'")

        if provider == "stripe":
            result = await self._create_stripe_checkout(user=user, interval=interval)
        elif provider == "iyzico":
            result = await self._create_iyzico_checkout(user=user, interval=interval)
        else:
            raise ValueError(f"Unsupported provider: {provider}")

        await self._persist_session(
            user_id=user["id"],
            user_email=user["email"],
            req=req,
            result=result,
        )
        return result

    # ─── Stripe ─────────────────────────────────────────────────────────────────

    async def _create_stripe_checkout(self, *, user: dict, interval: str) -> CheckoutResult:
        if not settings.stripe_secret_key:
            raise ValueError("STRIPE_SECRET_KEY is missing")

        price_id = (
            settings.stripe_price_id_pro_monthly
            if interval == "monthly"
            else settings.stripe_price_id_pro_yearly
        )
        product_id = (
            settings.stripe_monthly_product_id
            if interval == "monthly"
            else settings.stripe_yearly_product_id
        ) or settings.stripe_product_id

        has_price_id = bool(price_id and price_id.startswith("price_"))
        has_product_id = bool(product_id and product_id.startswith("prod_"))

        if not has_price_id and not has_product_id:
            raise ValueError(
                f"Stripe billing configuration is missing for interval '{interval}'. "
                "Set STRIPE_PRICE_ID_PRO_MONTHLY/STRIPE_PRICE_ID_PRO_YEARLY (price_*) "
                "or STRIPE_PRODUCT_ID/MONTHLY_PRODUCT_ID (prod_*) in .env"
            )

        # success_url: append CHECKOUT_SESSION_ID so we can verify later
        success_url = settings.payment_success_url
        if "?" in success_url:
            success_url += "&session_id={CHECKOUT_SESSION_ID}&provider=stripe"
        else:
            success_url += "?session_id={CHECKOUT_SESSION_ID}&provider=stripe"

        data = {
            "mode": "subscription",
            "success_url": success_url,
            "cancel_url": settings.payment_cancel_url,
            "client_reference_id": user["id"],
            "customer_email": user["email"],
            "metadata[user_id]": user["id"],
            "metadata[plan]": "pro",
            "metadata[interval]": interval,
            "line_items[0][quantity]": "1",
        }

        if has_price_id:
            data["line_items[0][price]"] = price_id
        else:
            amount = (
                settings.payment_price_pro_monthly
                if interval == "monthly"
                else settings.payment_price_pro_yearly
            )
            unit_amount = int(round(amount * 100))
            stripe_interval = "month" if interval == "monthly" else "year"
            data["line_items[0][price_data][currency]"] = settings.payment_currency.lower()
            data["line_items[0][price_data][unit_amount]"] = str(unit_amount)
            data["line_items[0][price_data][recurring][interval]"] = stripe_interval
            data["line_items[0][price_data][product]"] = product_id

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                "https://api.stripe.com/v1/checkout/sessions",
                data=data,
                headers={"Authorization": f"Bearer {settings.stripe_secret_key}"},
            )

        if resp.status_code >= 400:
            raise ValueError(f"Stripe checkout failed: {resp.text}")

        payload = resp.json()
        checkout_url = payload.get("url")
        session_id = payload.get("id")
        if not checkout_url:
            raise ValueError("Stripe did not return checkout URL")

        return CheckoutResult(
            provider="stripe",
            checkout_url=checkout_url,
            external_session_id=session_id,
        )

    async def verify_stripe_checkout(self, *, session_id: str, user_id: str) -> dict:
        """
        Stripe checkout session'ını doğrula.
        Başarılıysa kullanıcıya pro aboneliği ver.
        """
        if not settings.stripe_secret_key:
            raise ValueError("STRIPE_SECRET_KEY is missing")

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                f"https://api.stripe.com/v1/checkout/sessions/{session_id}",
                headers={"Authorization": f"Bearer {settings.stripe_secret_key}"},
            )

        if resp.status_code >= 400:
            raise ValueError(f"Stripe session lookup failed: {resp.text}")

        session = resp.json()
        payment_status = session.get("payment_status")  # "paid" | "unpaid" | "no_payment_required"
        status = session.get("status")  # "complete" | "expired" | "open"
        ref_user_id = (session.get("metadata") or {}).get("user_id") or session.get("client_reference_id")

        if status != "complete" or payment_status != "paid":
            return {"verified": False, "reason": f"status={status}, payment_status={payment_status}"}

        # Security: make sure the session belongs to this user
        if ref_user_id and ref_user_id != user_id:
            return {"verified": False, "reason": "user mismatch"}

        interval = (session.get("metadata") or {}).get("interval", "monthly")
        end_date = datetime.utcnow() + (
            timedelta(days=365) if interval == "yearly" else timedelta(days=31)
        )

        await self._activate_subscription(
            user_id=user_id,
            provider="stripe",
            plan="pro",
            interval=interval,
            external_customer_id=session.get("customer"),
            external_subscription_id=session.get("subscription"),
            end_date=end_date,
        )

        # Mark payment session as paid
        await self.payment_sessions.update_one(
            {"external_session_id": session_id},
            {"$set": {"status": "paid", "updated_at": datetime.utcnow()}},
        )

        return {"verified": True, "plan": "pro", "interval": interval, "subscription_end_date": end_date.isoformat()}

    # ─── Iyzico ─────────────────────────────────────────────────────────────────

    def _iyzico_auth_headers(self, *, uri_path: str, body_json: str) -> dict[str, str]:
        """Build IYZWSv2 auth headers according to official HMACSHA256 flow."""
        api_key = settings.iyzico_api_key
        secret_key = settings.iyzico_secret_key
        random_key = secrets.token_hex(12)

        encrypted_data = hmac.new(
            secret_key.encode("utf-8"),
            f"{random_key}{uri_path}{body_json}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        authorization_string = (
            f"apiKey:{api_key}&randomKey:{random_key}&signature:{encrypted_data}"
        )
        authorization = base64.b64encode(authorization_string.encode("utf-8")).decode("utf-8")

        return {
            "Authorization": f"IYZWSv2 {authorization}",
            "x-iyzi-rnd": random_key,
            "Accept": "application/json",
            "x-iyzi-client-version": "iyzipay-python-1.0.46",
            "Content-Type": "application/json",
        }

    async def _create_iyzico_checkout(self, *, user: dict, interval: str) -> CheckoutResult:
        """
        Iyzico Checkout Form API ile gerçek sandbox ödeme formu token'ı üret.
        Dönen token ile frontend kullanıcıyı Iyzico checkout URL'ine yönlendirir.
        """
        if not settings.iyzico_api_key or not settings.iyzico_secret_key:
            raise ValueError("IYZICO_API_KEY and IYZICO_SECRET_KEY are required")

        conversation_id = str(uuid.uuid4())
        price = (
            settings.payment_price_pro_monthly
            if interval == "monthly"
            else settings.payment_price_pro_yearly
        )
        price_str = f"{price:.2f}"

        full_name = (user.get("full_name") or "").strip()
        parts = [p for p in full_name.split(" ") if p]
        buyer_name = parts[0] if parts else "Test"
        buyer_surname = " ".join(parts[1:]) if len(parts) > 1 else "User"

        callback_url = settings.iyzico_callback_url or "http://localhost:8000/api/payments/callback/iyzico"

        # Iyzico Checkout Form initialize payload
        payload = {
            "locale": "tr",
            "conversationId": conversation_id,
            "price": price_str,
            "paidPrice": price_str,
            "currency": settings.payment_currency or "TRY",
            "basketId": f"user_{user['id']}_{interval}",
            "paymentGroup": "PRODUCT",
            "paymentChannel": "WEB",
            "callbackUrl": callback_url,
            "enabledInstallments": [1],
            "buyer": {
                "id": user["id"],
                "name": buyer_name,
                "surname": buyer_surname,
                "gsmNumber": "+905350000000",
                "email": user["email"],
                "identityNumber": "74300864791",
                "lastLoginDate": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
                "registrationDate": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
                "registrationAddress": "Istanbul",
                "ip": "85.34.78.112",
                "city": "Istanbul",
                "country": "Turkey",
                "zipCode": "34732",
            },
            "shippingAddress": {
                "contactName": "Test User",
                "city": "Istanbul",
                "country": "Turkey",
                "address": "Istanbul",
                "zipCode": "34732",
            },
            "billingAddress": {
                "contactName": "Test User",
                "city": "Istanbul",
                "country": "Turkey",
                "address": "Istanbul",
                "zipCode": "34732",
            },
            "basketItems": [
                {
                    "id": f"pro_{interval}",
                    "name": f"Pro Plan ({interval})",
                    "category1": "Subscription",
                    "itemType": "VIRTUAL",
                    "price": price_str,
                }
            ],
        }

        uri_path = "/payment/iyzipos/checkoutform/initialize/ecom"
        body_json = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
        headers = self._iyzico_auth_headers(uri_path=uri_path, body_json=body_json)
        iyzico_url = f"{settings.iyzico_base_url.rstrip('/')}{uri_path}"

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                iyzico_url,
                content=body_json.encode("utf-8"),
                headers=headers,
            )

        try:
            resp_data = resp.json()
        except ValueError:
            raise ValueError(f"Iyzico checkout failed with non-JSON response: HTTP {resp.status_code}")

        if resp_data.get("status") != "success":
            error_msg = resp_data.get("errorMessage") or resp_data.get("errorCode") or "Iyzico checkout failed"
            raise ValueError(f"Iyzico checkout failed: {error_msg} (code: {resp_data.get('errorCode')})")

        token = resp_data.get("token")
        if not token:
            raise ValueError("Iyzico did not return a checkout token")

        checkout_url = resp_data.get("paymentPageUrl") or f"{settings.iyzico_base_url.rstrip('/')}/payment/iyzipos/checkoutform/auth/ecom?token={token}"

        return CheckoutResult(
            provider="iyzico",
            checkout_url=checkout_url,
            external_session_id=conversation_id,
            iyzico_token=token,
        )

    async def verify_iyzico_checkout(self, *, token: Optional[str], user_id: str) -> dict:
        """
        Iyzico checkout token'ını doğrula.
        """
        if not settings.iyzico_api_key or not settings.iyzico_secret_key:
            raise ValueError("Iyzico credentials not configured")

        if not token:
            session_doc = await self.payment_sessions.find_one(
                {
                    "user_id": user_id,
                    "provider": "iyzico",
                    "status": {"$in": ["pending", "created"]},
                    "iyzico_token": {"$exists": True, "$ne": None},
                },
                sort=[("created_at", -1)],
            )
            if not session_doc:
                return {
                    "verified": False,
                    "reason": "No pending Iyzico checkout token found for this user",
                }
            token = session_doc.get("iyzico_token")

        if not token:
            return {"verified": False, "reason": "Iyzico token could not be resolved"}

        conversation_id = str(uuid.uuid4())
        payload = {
            "locale": "tr",
            "conversationId": conversation_id,
            "token": token,
        }

        uri_path = "/payment/iyzipos/checkoutform/auth/ecom/detail"
        body_json = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
        headers = self._iyzico_auth_headers(uri_path=uri_path, body_json=body_json)
        iyzico_url = f"{settings.iyzico_base_url.rstrip('/')}{uri_path}"

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                iyzico_url,
                content=body_json.encode("utf-8"),
                headers=headers,
            )

        try:
            resp_data = resp.json()
        except ValueError:
            return {
                "verified": False,
                "reason": f"Iyzico verification failed with non-JSON response (HTTP {resp.status_code})",
            }

        if resp_data.get("status") != "success":
            error_msg = resp_data.get("errorMessage") or "Iyzico verification failed"
            return {"verified": False, "reason": error_msg}

        payment_status = resp_data.get("paymentStatus")  # "SUCCESS" | "FAILURE"
        if payment_status != "SUCCESS":
            return {"verified": False, "reason": f"Payment status: {payment_status}"}

        # Ödeme başarılı — aboneliği aktifleştir
        # Session'dan interval'i bul
        session_doc = await self.payment_sessions.find_one({"iyzico_token": token})
        interval = session_doc.get("interval", "monthly") if session_doc else "monthly"

        end_date = datetime.utcnow() + (
            timedelta(days=365) if interval == "yearly" else timedelta(days=31)
        )

        await self._activate_subscription(
            user_id=user_id,
            provider="iyzico",
            plan="pro",
            interval=interval,
            external_customer_id=resp_data.get("cardUserKey"),
            external_subscription_id=resp_data.get("paymentId"),
            end_date=end_date,
        )

        # Mark session paid
        await self.payment_sessions.update_one(
            {"iyzico_token": token},
            {"$set": {"status": "paid", "updated_at": datetime.utcnow()}},
        )

        return {"verified": True, "plan": "pro", "interval": interval, "subscription_end_date": end_date.isoformat()}

    # ─── Shared ─────────────────────────────────────────────────────────────────

    async def _activate_subscription(
        self,
        *,
        user_id: str,
        provider: str,
        plan: str,
        interval: str,
        external_customer_id: Optional[str],
        external_subscription_id: Optional[str],
        end_date: datetime,
    ):
        """Kullanıcıyı Pro'ya yükselt ve DB'yi güncelle."""
        update_data = {
            "plan": plan,
            "is_pro": True,
            "subscription_status": "active",
            "subscription_provider": provider,
            "subscription_plan": interval,
            "subscription_end_date": end_date,
            "payment_provider": provider,
            "plan_updated_at": datetime.utcnow(),
        }
        if external_customer_id:
            update_data["customer_id"] = external_customer_id
        if external_subscription_id:
            update_data["subscription_id"] = external_subscription_id

        await self.db["users"].update_one(
            {"_id": self._to_object_id(user_id)},
            {"$set": update_data},
        )

    async def get_subscription_status(self, *, user_id: str) -> dict:
        session = await self.payment_sessions.find_one(
            {"user_id": user_id},
            sort=[("created_at", -1)],
        )

        return {
            "latest_checkout": {
                "provider": session.get("provider") if session else None,
                "status": session.get("status") if session else None,
                "created_at": session.get("created_at") if session else None,
            }
        }

    # ─── Webhooks ─────────────────────────────────────────────────────────────

    async def handle_webhook(
        self,
        *,
        provider: str,
        raw_body: bytes,
        headers: dict[str, str],
    ) -> dict:
        provider = provider.lower().strip()
        if provider == "stripe":
            return await self._handle_stripe_webhook(raw_body=raw_body, headers=headers)
        if provider == "iyzico":
            return await self._handle_iyzico_webhook(raw_body=raw_body, headers=headers)
        raise ValueError(f"Unsupported webhook provider: {provider}")

    def _verify_stripe_signature(self, raw_body: bytes, signature_header: str) -> bool:
        if not settings.stripe_webhook_secret or not signature_header:
            return False

        parts = [part.strip() for part in signature_header.split(",")]
        values: dict[str, str] = {}
        for part in parts:
            if "=" not in part:
                continue
            key, value = part.split("=", 1)
            values[key] = value

        timestamp = values.get("t")
        expected = values.get("v1")
        if not timestamp or not expected:
            return False

        signed_payload = f"{timestamp}.".encode("utf-8") + raw_body
        digest = hmac.new(
            settings.stripe_webhook_secret.encode("utf-8"),
            signed_payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(digest, expected)

    def _verify_iyzico_signature(self, raw_body: bytes, headers: dict[str, str]) -> bool:
        """
        Iyzico webhook imza doğrulaması.
        Iyzico X-IYZ-SIGNATURE header'ında HMAC-SHA1 imza gönderir.
        """
        if not settings.iyzico_webhook_secret:
            return True  # Secret yoksa geç (development)

        signature_header = headers.get("x-iyz-signature", "")
        if not signature_header:
            return False

        expected = hmac.new(
            settings.iyzico_webhook_secret.encode("utf-8"),
            raw_body,
            hashlib.sha1,
        ).hexdigest()

        return hmac.compare_digest(expected, signature_header)

    async def _handle_stripe_webhook(self, *, raw_body: bytes, headers: dict[str, str]) -> dict:
        signature = headers.get("stripe-signature", "")
        if not self._verify_stripe_signature(raw_body, signature):
            raise ValueError("Invalid Stripe signature")

        event = json.loads(raw_body.decode("utf-8"))
        event_type = event.get("type")
        data_obj = (event.get("data") or {}).get("object") or {}

        await self.payment_events.update_one(
            {"provider": "stripe", "event_id": event.get("id")},
            {
                "$set": {
                    "event_type": event_type,
                    "payload": event,
                    "received_at": datetime.utcnow(),
                }
            },
            upsert=True,
        )

        user_id = None
        if event_type == "checkout.session.completed":
            user_id = (data_obj.get("metadata") or {}).get("user_id") or data_obj.get("client_reference_id")
            session_id = data_obj.get("id")
            interval = (data_obj.get("metadata") or {}).get("interval", "monthly")
            end_date = datetime.utcnow() + (
                timedelta(days=365) if interval == "yearly" else timedelta(days=31)
            )

            await self.payment_sessions.update_one(
                {"external_session_id": session_id},
                {
                    "$set": {
                        "status": "paid",
                        "updated_at": datetime.utcnow(),
                        "external_customer_id": data_obj.get("customer"),
                        "external_subscription_id": data_obj.get("subscription"),
                    }
                },
            )

            if user_id:
                await self._activate_subscription(
                    user_id=user_id,
                    provider="stripe",
                    plan="pro",
                    interval=interval,
                    external_customer_id=data_obj.get("customer"),
                    external_subscription_id=data_obj.get("subscription"),
                    end_date=end_date,
                )

        elif event_type in {"customer.subscription.deleted", "customer.subscription.paused"}:
            subscription_id = data_obj.get("id")
            customer_id = data_obj.get("customer")

            await self.payment_sessions.update_many(
                {"external_subscription_id": subscription_id},
                {"$set": {"status": "canceled", "updated_at": datetime.utcnow()}},
            )

            # Customer'dan user_id bul ve is_pro=False yap
            session_doc = await self.payment_sessions.find_one({"external_subscription_id": subscription_id})
            if session_doc:
                await self.db["users"].update_one(
                    {"_id": self._to_object_id(session_doc["user_id"])},
                    {
                        "$set": {
                            "plan": "free",
                            "is_pro": False,
                            "subscription_status": "canceled",
                            "subscription_end_date": None,
                        }
                    },
                )

        elif event_type == "invoice.payment_failed":
            subscription_id = data_obj.get("subscription")
            await self.payment_sessions.update_many(
                {"external_subscription_id": subscription_id},
                {"$set": {"status": "payment_failed", "updated_at": datetime.utcnow()}},
            )

        elif event_type == "customer.subscription.updated":
            subscription_id = data_obj.get("id")
            sub_status = data_obj.get("status")  # "active", "past_due", "canceled" etc.
            if sub_status == "active":
                period_end = data_obj.get("current_period_end")
                end_date = datetime.utcfromtimestamp(period_end) if period_end else None
                session_doc = await self.payment_sessions.find_one({"external_subscription_id": subscription_id})
                if session_doc and end_date:
                    await self.db["users"].update_one(
                        {"_id": self._to_object_id(session_doc["user_id"])},
                        {"$set": {"subscription_end_date": end_date, "subscription_status": "active"}},
                    )

        return {"provider": "stripe", "event_type": event_type}

    async def _handle_iyzico_webhook(self, *, raw_body: bytes, headers: dict[str, str]) -> dict:
        if not self._verify_iyzico_signature(raw_body, headers):
            raise ValueError("Invalid Iyzico webhook signature")

        payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        event_id = payload.get("paymentConversationId") or secrets.token_hex(8)
        event_type = payload.get("status") or "unknown"

        await self.payment_events.update_one(
            {"provider": "iyzico", "event_id": event_id},
            {
                "$set": {
                    "event_type": event_type,
                    "payload": payload,
                    "received_at": datetime.utcnow(),
                }
            },
            upsert=True,
        )

        if event_type == "SUCCESS":
            token = payload.get("token")
            if token:
                session_doc = await self.payment_sessions.find_one({"iyzico_token": token})
                if session_doc:
                    interval = session_doc.get("interval", "monthly")
                    end_date = datetime.utcnow() + (
                        timedelta(days=365) if interval == "yearly" else timedelta(days=31)
                    )
                    await self._activate_subscription(
                        user_id=session_doc["user_id"],
                        provider="iyzico",
                        plan="pro",
                        interval=interval,
                        external_customer_id=payload.get("cardUserKey"),
                        external_subscription_id=payload.get("paymentId"),
                        end_date=end_date,
                    )
                    await self.payment_sessions.update_one(
                        {"iyzico_token": token},
                        {"$set": {"status": "paid", "updated_at": datetime.utcnow()}},
                    )

        return {"provider": "iyzico", "status": "accepted", "event_type": event_type}

    @staticmethod
    def _to_object_id(value: str):
        from bson import ObjectId
        return ObjectId(value)
