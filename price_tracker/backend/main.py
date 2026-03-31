import sys
from typing import Optional
import asyncio
import os
import secrets

if sys.platform == 'win32' and os.getenv("PYTEST_RUNNING") != "1":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv
from datetime import datetime, timedelta
from loguru import logger
from pymongo.errors import DuplicateKeyError
from collections import defaultdict, deque
from urllib.parse import parse_qs, parse_qsl, urlencode, urlsplit, urlunsplit

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.models import (
    TrackUpdate,
    UserRegister, UserLogin,
    TrackRequest,
    UserProfileUpdate,
)
from database.repository import (
    ProductRepository, PriceHistoryRepository,
    UserRepository, ProductPoolRepository, TrackedItemRepository, RefreshTokenRepository
)
from database.connection import get_database, close_database
from analysis.price_analyzer import PriceAnalyzer
from scheduler.tasks import start_scheduler, stop_scheduler, scrape_job, get_scheduler_status
from config import settings, configure_logging, validate_startup_settings
from entitlements import get_max_tracked_items_for_user, get_plan_feature_flags, is_telegram_allowed_for_user
from payments import PaymentService
from auth.jwt_handler import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
    hash_token, REFRESH_TOKEN_EXPIRE_DAYS
)

from scrapers.engine import detect_site, run_scraper_process as _engine_run_scraper

load_dotenv()

COOKIE_SECURE = settings.cookie_secure
ALLOWED_ORIGINS = settings.allowed_origins
LOGIN_MAX_ATTEMPTS = settings.login_max_attempts
LOGIN_WINDOW_SECONDS = settings.login_window_seconds
INTERNAL_DEBUG_ENABLED = settings.internal_debug_enabled
INTERNAL_DEBUG_REQUIRE_ADMIN = settings.internal_debug_require_admin

# Basit brute-force koruması (process bazlı)
_failed_login_attempts: dict[str, deque] = defaultdict(deque)

# BEARER TOKEN SECURITY INSTANCE
security = HTTPBearer()

# ¦¦ Auth Dependency ¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦
async def get_db(request: Request):
    return request.app.state.db

# COOKIE YERİNE BEARER TOKEN KULLANAN YENİ FONKSİYON
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_db)
) -> dict:
    token = credentials.credentials
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    return {"id": payload["sub"], "email": payload["email"]}


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _is_login_rate_limited(key: str) -> bool:
    now_ts = datetime.utcnow().timestamp()
    attempts = _failed_login_attempts[key]
    while attempts and now_ts - attempts[0] > LOGIN_WINDOW_SECONDS:
        attempts.popleft()
    return len(attempts) >= LOGIN_MAX_ATTEMPTS


def _register_failed_login(key: str):
    attempts = _failed_login_attempts[key]
    attempts.append(datetime.utcnow().timestamp())


def _clear_failed_logins(key: str):
    _failed_login_attempts.pop(key, None)


# YENİ EKLENEN SCHEMALAR (Refresh ve Logout body payload'ları için)
class RefreshRequest(BaseModel):
    refresh_token: str

class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None

class PaymentCheckoutStartRequest(BaseModel):
    provider: str
    plan: str = "pro"
    interval: str = "monthly"

class PaymentVerifyRequest(BaseModel):
    provider: str                   # "stripe" | "iyzico"
    session_id: Optional[str] = None  # Stripe CHECKOUT_SESSION_ID
    token: Optional[str] = None       # Iyzico token


class MarketingEmailRequest(BaseModel):
    email: EmailStr
    message: str


def _generate_telegram_link_code() -> str:
    raw = secrets.token_urlsafe(18).replace("-", "").replace("_", "")
    return f"link_{raw[:24]}"


async def _get_debug_user_or_forbid(db, current_user: dict) -> dict:
    if not INTERNAL_DEBUG_ENABLED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debug endpoints are disabled")

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(current_user["id"])
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if INTERNAL_DEBUG_REQUIRE_ADMIN and user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")

    return user


# ¦¦ Lifespan ¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦
@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(settings)
    config_errors = validate_startup_settings(settings)
    if config_errors:
        raise RuntimeError("Startup guard blocked app startup: " + " | ".join(config_errors))

    logger.info("Starting application...")
    logger.info(
        f"Environment profile: env={settings.app_env}, scheduler_mode={settings.scheduler_mode}, "
        f"log_level={settings.log_level}, cookie_secure={settings.cookie_secure}"
    )
    app.state.db = await get_database()
    logger.info("MongoDB connection established!")
    start_scheduler()
    from notifications.telegram import telegram_polling_loop
    import asyncio
    asyncio.create_task(telegram_polling_loop())
    yield
    stop_scheduler()
    await close_database()
    logger.info("MongoDB connection closed.")


app = FastAPI(
    title="Price Tracker API",
    description="Multi-site price tracking: Trendyol, Amazon, N11, Vatan, İtopya, İncehesap, Newegg, Banggood, Etsy, eBay, AliExpress",
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def serialize_doc(doc: dict) -> dict:
    doc.pop("_id", None)
    if "id" in doc and not isinstance(doc["id"], str):
        doc["id"] = str(doc["id"])
    return doc


def _derive_display_name(email: str, full_name: str | None = None) -> str:
    if full_name and full_name.strip():
        return full_name.strip()
    local = (email or "").split("@", 1)[0].strip()
    return local or "User"


def _avatar_initial_from_name(name: str) -> str:
    return (name.strip()[:1] or "U").upper()


def _append_query_params(url: str, params: dict[str, str]) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    for key, value in params.items():
        if value and key not in query:
            query[key] = value
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


# ======================================================
# GENERAL ENDPOINTS
# ======================================================

@app.get("/", tags=["General"])
async def root():
    return {"message": "Price Tracker API is running!", "version": "2.0.0"}


@app.get("/health/live", tags=["Health"])
async def health_live():
    return {
        "status": "ok",
        "service": "price-tracker-api",
        "env": settings.app_env,
        "time": datetime.utcnow(),
    }


@app.get("/health/ready", tags=["Health"])
async def health_ready(db=Depends(get_db)):
    db_error = None
    try:
        await db.command("ping")
        db_ok = True
    except Exception as exc:
        db_ok = False
        db_error = str(exc)

    scheduler_status = get_scheduler_status()
    scheduler_ok = scheduler_status.get("mode") == "off" or scheduler_status.get("running")

    if not db_ok or not scheduler_ok:
        detail = {
            "status": "not_ready",
            "database": {
                "ok": db_ok,
                "error": db_error if not db_ok else None,
            },
            "scheduler": scheduler_status,
        }
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)

    return {
        "status": "ready",
        "database": {"ok": True},
        "scheduler": scheduler_status,
        "time": datetime.utcnow(),
    }


# ======================================================
# AUTH ENDPOINTS
# ======================================================

@app.post("/api/auth/register", tags=["Auth"], status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister, db=Depends(get_db)):
    user_repo = UserRepository(db)
    try:
        display_name = _derive_display_name(data.email)
        user_id = await user_repo.create({
            "email": data.email,
            "hashed_password": hash_password(data.password),
            "full_name": display_name,
            "language": "en",
            "role": "user",
            "plan": "free",
            "subscription_status": "inactive",
            "payment_provider": None,
            "is_active": True,
            "push_notifications": True,
            "email_notifications": True, "telegram_chat_id": None,
            "created_at": datetime.utcnow()
        })
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email is already registered!"
        )
    logger.info(f"New user registered: {data.email}")
    return {"message": "Registration successful!", "id": user_id}


@app.post("/api/auth/login", tags=["Auth"])
async def login(data: UserLogin, request: Request, db=Depends(get_db)):
    key = f"{data.email.lower()}|{_client_ip(request)}"
    if _is_login_rate_limited(key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again later."
        )

    user_repo = UserRepository(db)
    refresh_repo = RefreshTokenRepository(db)
    user = await user_repo.get_by_email(data.email)
    if not user or not verify_password(data.password, user["hashed_password"]):
        _register_failed_login(key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    if not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not active"
        )

    _clear_failed_logins(key)

    access_token = create_access_token(user["id"], user["email"])
    refresh_token = create_refresh_token(user["id"])
    refresh_expiry = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    await refresh_repo.create({
        "user_id": user["id"],
        "token_hash": hash_token(refresh_token),
        "created_at": datetime.utcnow(),
        "expires_at": refresh_expiry,
        "revoked_at": None,
        "ip": _client_ip(request),
        "user_agent": request.headers.get("user-agent", "")
    })

    logger.info(f"User logged in: {user['email']}")
    
    # JSON RESPONSE İLE TOKENLERİ DİREKT GÖVDEYE YAZDIRIYORUZ
    return {
        "message": "Login successful",
        "mesaj": "Login successful",
        "email": user["email"],
        "plan": user.get("plan", "free"),
        "access_token": access_token,
        "refresh_token": refresh_token,
    }


@app.post("/api/auth/logout", tags=["Auth"])
async def logout(
    data: Optional[LogoutRequest] = None, # Body'den okuyoruz artık
    db=Depends(get_db)
):
    if data and data.refresh_token:
        refresh_repo = RefreshTokenRepository(db)
        await refresh_repo.revoke_by_hash(hash_token(data.refresh_token))

    return {"message": "Logged out successfully", "mesaj": "Logged out successfully"}


@app.post("/api/auth/refresh", tags=["Auth"])
async def refresh(
    data: RefreshRequest, # Body'den okuyoruz artık
    request: Request,
    db=Depends(get_db)
):
    if not data.refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found"
        )

    refresh_repo = RefreshTokenRepository(db)
    token_hash = hash_token(data.refresh_token)
    existing_token = await refresh_repo.get_valid_by_hash(token_hash)
    if not existing_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is invalid or revoked"
        )

    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(payload["sub"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    access_token = create_access_token(user["id"], user["email"])
    new_refresh_token = create_refresh_token(user["id"])
    refresh_expiry = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    # Rotation: eski refresh iptal et, yenisini yaz
    await refresh_repo.revoke_by_hash(token_hash)
    await refresh_repo.create({
        "user_id": user["id"],
        "token_hash": hash_token(new_refresh_token),
        "created_at": datetime.utcnow(),
        "expires_at": refresh_expiry,
        "revoked_at": None,
        "ip": _client_ip(request),
        "user_agent": request.headers.get("user-agent", "")
    })

    return {
        "message": "Token refreshed", 
        "mesaj": "Token refreshed",
        "access_token": access_token,
        "refresh_token": new_refresh_token
    }


@app.get("/api/auth/me", tags=["Auth"])
async def me(current_user=Depends(get_current_user), db=Depends(get_db)):
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(current_user["id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    display_name = _derive_display_name(user.get("email", ""), user.get("full_name"))
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": display_name,
        "language": user.get("language", "en"),
        "avatar_initial": _avatar_initial_from_name(display_name),
        "plan": user.get("plan", "free"),
        "subscription_status": user.get("subscription_status", "inactive"),
        "payment_provider": user.get("payment_provider"),
        "push_notifications": user.get("push_notifications", True),
        "email_notifications": user.get("email_notifications", True), "telegram_chat_id": user.get("telegram_chat_id"),
    }


@app.patch("/api/auth/profile", tags=["Auth"])
async def update_profile(
    data: UserProfileUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):
    user_repo = UserRepository(db)
    updates: dict = {}
    if data.full_name is not None:
        clean_name = data.full_name.strip()
        updates["full_name"] = clean_name or _derive_display_name(current_user["email"])
    if data.push_notifications is not None:
        updates["push_notifications"] = data.push_notifications
    if data.email_notifications is not None:
        updates["email_notifications"] = data.email_notifications
    if data.language is not None:
        updates["language"] = data.language

    if updates:
        await user_repo.update(current_user["id"], updates)

    user = await user_repo.get_by_id(current_user["id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    display_name = _derive_display_name(user.get("email", ""), user.get("full_name"))
    return {
        "message": "Profile updated",
        "mesaj": "Profile updated",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": display_name,
            "language": user.get("language", "en"),
            "avatar_initial": _avatar_initial_from_name(display_name),
            "plan": user.get("plan", "free"),
            "subscription_status": user.get("subscription_status", "inactive"),
            "payment_provider": user.get("payment_provider"),
            "push_notifications": user.get("push_notifications", True),
            "email_notifications": user.get("email_notifications", True), "telegram_chat_id": user.get("telegram_chat_id"),
        }
    }


@app.post("/api/telegram/link/start", tags=["Telegram"])
async def start_telegram_link(current_user=Depends(get_current_user), db=Depends(get_db)):
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(current_user["id"])
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not is_telegram_allowed_for_user(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Telegram notifications are available on Premium plan",
        )

    from notifications.telegram import TELEGRAM_TOKEN, TELEGRAM_BOT_USERNAME, build_start_url

    if not TELEGRAM_TOKEN or not TELEGRAM_BOT_USERNAME:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram bot is not configured",
        )

    link_tokens = db["telegram_link_tokens"]
    expires_at = datetime.utcnow() + timedelta(minutes=settings.telegram_link_code_ttl_minutes)

    token_doc = None
    for _ in range(5):
        code = _generate_telegram_link_code()
        doc = {
            "code": code,
            "user_id": current_user["id"],
            "created_at": datetime.utcnow(),
            "expires_at": expires_at,
            "consumed_at": None,
            "consumed_by_chat_id": None,
        }
        try:
            await link_tokens.insert_one(doc)
            token_doc = doc
            break
        except DuplicateKeyError:
            continue

    if not token_doc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate Telegram connection token",
        )

    await link_tokens.delete_many(
        {
            "user_id": current_user["id"],
            "consumed_at": None,
            "code": {"$ne": token_doc["code"]},
        }
    )

    return {
        "message": "Telegram link token created",
        "bot_username": TELEGRAM_BOT_USERNAME,
        "start_payload": token_doc["code"],
        "start_command": f"/start {token_doc['code']}",
        "start_url": build_start_url(token_doc["code"]),
        "expires_at": expires_at,
        "ttl_minutes": settings.telegram_link_code_ttl_minutes,
    }


@app.delete("/api/telegram/link", tags=["Telegram"])
async def disconnect_telegram(current_user=Depends(get_current_user), db=Depends(get_db)):
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(current_user["id"])
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await user_repo.update(current_user["id"], {"telegram_chat_id": None})
    await db["telegram_link_tokens"].delete_many({"user_id": current_user["id"]})

    return {
        "message": "Telegram disconnected",
        "mesaj": "Telegram disconnected",
    }


# ======================================================
# PAYMENT ENDPOINTS
# ======================================================

@app.get("/api/payments/config", tags=["Payments"])
async def payment_config(current_user=Depends(get_current_user), db=Depends(get_db)):
    user_repo = UserRepository(db)
    tracked_repo = TrackedItemRepository(db)
    user = await user_repo.get_by_id(current_user["id"])
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    active_tracked_items = await tracked_repo.count_active_by_user(current_user["id"])
    features = get_plan_feature_flags(user)

    return {
        "enabled": settings.payment_enabled,
        "default_provider": settings.payment_default_provider,
        "sandbox_mode": settings.payment_sandbox_mode,
        "payment_public_notice": settings.payment_public_notice,
        "providers": settings.payment_providers_enabled,
        "currency": settings.payment_currency,
        "price_pro_monthly": settings.payment_price_pro_monthly,
        "price_pro_yearly": settings.payment_price_pro_yearly,
        "user_plan": user.get("plan", "free"),
        "subscription_status": user.get("subscription_status", "inactive"),
        "payment_provider": user.get("payment_provider"),
        "features": {
            **features,
            "current_tracked_items": active_tracked_items,
        },
    }


@app.post("/api/payments/checkout/start", tags=["Payments"])
async def start_checkout(
    data: PaymentCheckoutStartRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(current_user["id"])
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    service = PaymentService(db)
    try:
        result = await service.create_checkout(
            user={"id": user["id"], "email": user["email"], "full_name": user.get("full_name")},
            req=data,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return {
        "message": "Checkout started",
        "provider": result.provider,
        "checkout_url": result.checkout_url,
        "session_id": result.external_session_id,
    }


@app.get("/api/payments/subscription", tags=["Payments"])
async def payment_subscription_status(current_user=Depends(get_current_user), db=Depends(get_db)):
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(current_user["id"])
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    service = PaymentService(db)
    latest = await service.get_subscription_status(user_id=user["id"])

    return {
        "plan": user.get("plan", "free"),
        "subscription_status": user.get("subscription_status", "inactive"),
        "payment_provider": user.get("payment_provider"),
        **latest,
    }


@app.post("/api/payments/verify", tags=["Payments"])
async def verify_payment(
    data: PaymentVerifyRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Frontend'in başarı sayfasından çağrılır.
    token (Iyzico) veya session_id (Stripe) ile ödemeyi doğrular ve
    is_pro=True yaparak aboneliği aktifleştirir.
    """
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(current_user["id"])
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    service = PaymentService(db)
    provider = data.provider.lower().strip()

    try:
        if provider == "stripe":
            if not data.session_id:
                raise ValueError("session_id is required for Stripe verification")
            result = await service.verify_stripe_checkout(
                session_id=data.session_id,
                user_id=user["id"],
            )
        elif provider == "iyzico":
            result = await service.verify_iyzico_checkout(
                token=data.token,
                user_id=user["id"],
            )
        else:
            raise ValueError(f"Unsupported provider: {provider}")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    if not result.get("verified"):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=result.get("reason", "Payment verification failed"),
        )

    return {
        "verified": True,
        "plan": result.get("plan", "pro"),
        "interval": result.get("interval"),
        "subscription_end_date": result.get("subscription_end_date"),
        "message": "Subscription activated successfully",
    }


@app.api_route("/api/payments/callback/iyzico", methods=["GET", "POST"], include_in_schema=False)
async def iyzico_callback(request: Request):
    token = request.query_params.get("token")
    payment_state = request.query_params.get("payment")
    iyzico_status = request.query_params.get("status")

    if not token and request.method == "POST":
        content_type = request.headers.get("content-type", "").lower()
        if "application/json" in content_type:
            try:
                body = await request.json()
            except ValueError:
                body = {}
            if isinstance(body, dict):
                token = body.get("token")
                iyzico_status = (body.get("paymentStatus") or body.get("status") or iyzico_status)
        else:
            raw_body = (await request.body()).decode("utf-8", errors="ignore")
            parsed = parse_qs(raw_body)
            token = (parsed.get("token") or [None])[0]
            iyzico_status = (parsed.get("paymentStatus") or parsed.get("status") or [iyzico_status])[0]

    normalized_status = (iyzico_status or "").strip().upper()
    if payment_state not in {"success", "cancel"}:
        payment_state = "success" if normalized_status in {"", "SUCCESS", "PAID"} else "cancel"

    target_url = settings.payment_success_url if payment_state == "success" else settings.payment_cancel_url
    redirect_url = _append_query_params(target_url, {"provider": "iyzico", "payment": payment_state})
    if token:
        redirect_url = _append_query_params(redirect_url, {"token": token})

    return RedirectResponse(url=redirect_url, status_code=status.HTTP_303_SEE_OTHER)


@app.post("/api/payments/webhook/{provider}", tags=["Payments"])
async def payment_webhook(provider: str, request: Request, db=Depends(get_db)):
    raw_body = await request.body()
    headers = {k.lower(): v for k, v in request.headers.items()}
    service = PaymentService(db)

    try:
        result = await service.handle_webhook(provider=provider, raw_body=raw_body, headers=headers)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return {"status": "ok", **result}


# ======================================================
# TRACK ENDPOINTS
# ======================================================

@app.post("/api/track/add", tags=["Track"], status_code=status.HTTP_201_CREATED)
async def add_tracked_item(
    data: TrackRequest,
    background_tasks: BackgroundTasks,
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    pool_repo = ProductPoolRepository(db)
    tracked_repo = TrackedItemRepository(db)
    user_repo = UserRepository(db)
    current_user_doc = await user_repo.get_by_id(current_user["id"])
    plan_track_limit = get_max_tracked_items_for_user(current_user_doc)
    telegram_allowed = is_telegram_allowed_for_user(current_user_doc)

    url_hash = ProductPoolRepository.canonical_url(data.url)
    product = await pool_repo.get_by_hash(url_hash)

    if not product:
        try:
            product_id = await pool_repo.create({
                "canonical_url_hash": url_hash,
                "original_url": data.url,
                "source": detect_site(data.url),
                "name": "",
                "image_url": None,
                "current_price": None,
                "currency": data.currency or "TRY",
                "in_stock": True,
                "active": True,
                "error_count": 0,
                "last_checked_at": None,
                "created_at": datetime.utcnow()
            })
        except DuplicateKeyError:
            # Race condition — başka istek aynı anda ekledi
            product = await pool_repo.get_by_hash(url_hash)
            product_id = product["id"]
        else:
            background_tasks.add_task(scrape_and_update, product_id, data.url, db)
            logger.info(f"New product added to pool: {data.url}")
    else:
        product_id = product["id"]

    existing_any = await tracked_repo.get_any_by_user_and_product(current_user["id"], product_id)
    active_track_count = await tracked_repo.count_active_by_user(current_user["id"])
    if existing_any:
        if existing_any.get("is_active"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already tracking this product"
            )

        if plan_track_limit is not None and active_track_count >= plan_track_limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Free plan allows up to {plan_track_limit} active tracked products. Upgrade to Premium for unlimited tracking.",
            )

        await tracked_repo.reactivate(existing_any["id"], data.target_price)
        
        telegram_chat_id = current_user_doc.get("telegram_chat_id") if current_user_doc else None
        if telegram_chat_id and telegram_allowed:
            from notifications.telegram import send_alert
            display_name = product.get("name") if product and product.get("name") else data.url
            target_line = f"\n🎯 <b>Target: {data.target_price} TRY</b>" if data.target_price is not None else ""
            msg = (
                f"✅ <b>Tracking Reactivated</b>\n\n"
                f"📦 <i>{display_name[:100]}...</i>{target_line}\n\n"
                f"Notifications are enabled again for this product."
            )
            background_tasks.add_task(send_alert, msg, telegram_chat_id)
            
        return {
            "message": "Previously inactive tracking has been reactivated",
            "mesaj": "Previously inactive tracking has been reactivated",
            "product_id": product_id,
            "scraping": product is None
        }

    if plan_track_limit is not None and active_track_count >= plan_track_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Free plan allows up to {plan_track_limit} active tracked products. Upgrade to Premium for unlimited tracking.",
        )

    try:
        await tracked_repo.create({
            "user_id": current_user["id"],
            "product_id": product_id,
            "target_price": data.target_price,
            "is_active": True,
            "created_at": datetime.utcnow()
        })
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already tracking this product"
        )

    telegram_chat_id = current_user_doc.get("telegram_chat_id") if current_user_doc else None
    if telegram_chat_id and telegram_allowed:
        from notifications.telegram import send_alert
        display_name = product.get("name") if product and product.get("name") else data.url
        target_line = f"\n🎯 <b>Target: {data.target_price} TRY</b>" if data.target_price is not None else ""
        msg = (
            f"📌 <b>New Product Tracked</b>\n\n"
            f"📦 <i>{display_name[:100]}...</i>{target_line}\n\n"
            f"I will notify you when the price drops below your target."
        )
        background_tasks.add_task(send_alert, msg, telegram_chat_id)

    return {
        "message": "Product added to watchlist",
        "mesaj": "Product added to watchlist",
        "product_id": product_id,
        "scraping": product is None
    }


@app.get("/api/track/my-list", tags=["Track"])
async def my_list(db=Depends(get_db), current_user=Depends(get_current_user)):
    tracked_repo = TrackedItemRepository(db)
    pool_repo = ProductPoolRepository(db)
    user_repo = UserRepository(db)
    user_doc = await user_repo.get_by_id(current_user["id"])
    features = get_plan_feature_flags(user_doc)
    telegram_allowed = bool(features.get("telegram_notifications", False))
    telegram_connected_raw = bool(user_doc.get("telegram_chat_id")) if user_doc else False
    telegram_connected = telegram_connected_raw and telegram_allowed
    email_notifications_enabled = bool(user_doc.get("email_notifications", True)) if user_doc else True
    items = await tracked_repo.get_by_user(current_user["id"])
    result = []
    for item in items:
        product = await pool_repo.get_by_id(item["product_id"])
        if product:
            result.append({
                "tracked_item_id": item["id"],
                "target_price": item.get("target_price"),
                "is_active": item.get("is_active", True),
                "alerts_active": item.get("alerts_active", True),
                "created_at": item["created_at"],
                "notification": {
                    "telegram_connected": telegram_connected,
                    "telegram_connected_raw": telegram_connected_raw,
                    "telegram_allowed": telegram_allowed,
                    "email_notifications_enabled": email_notifications_enabled,
                    "last_notification_at": item.get("last_notification_at"),
                    "last_notification_check_at": item.get("last_notification_check_at"),
                    "last_notification_status": item.get("last_notification_status"),
                    "last_notification_reason": item.get("last_notification_reason"),
                    "last_notification_channel": item.get("last_notification_channel"),
                    "last_notification_error": item.get("last_notification_error"),
                },
                "product": serialize_doc(product)
            })
    return {
        "items": result,
        "toplam": len(result),
        "notification_context": {
            "telegram_connected": telegram_connected,
            "telegram_connected_raw": telegram_connected_raw,
            "telegram_allowed": telegram_allowed,
            "email_notifications_enabled": email_notifications_enabled,
            "plan": (user_doc.get("plan") if user_doc else "free"),
            "max_tracked_items": features.get("max_tracked_items"),
            "current_tracked_items": len(result),
        },
    }


@app.delete("/api/track/remove/{item_id}", tags=["Track"])
async def remove_tracked_item(
    item_id: str,
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    tracked_repo = TrackedItemRepository(db)
    item = await tracked_repo.get_by_id(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tracking record not found"
        )
    if item["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized for this action"
        )
    await tracked_repo.delete(item_id)
    return {"message": "Tracking deleted completely", "mesaj": "Tracking deleted completely"}


@app.patch("/api/track/update/{item_id}", tags=["Track"])
async def update_tracked_item(
    item_id: str,
    data: TrackUpdate,
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    tracked_repo = TrackedItemRepository(db)
    item = await tracked_repo.get_by_id(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tracking record not found"
        )
    if item["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized for this action"
        )
    update_fields = data.model_dump(exclude_none=True)
    await tracked_repo.collection.update_one(
        {"_id": item["_id"] if "_id" in item else item["id"]},
        {"$set": update_fields}
    )
    return {"message": "Updated", "mesaj": "Updated", "guncellenen": update_fields}


# ======================================================
# INTERNAL DEBUG ENDPOINTS
# ======================================================

@app.post("/api/marketing/send-mail", tags=["Marketing"])
async def marketing_send_mail(payload: MarketingEmailRequest):
    from notifications.email_service import send_email_async

    cleaned_message = payload.message.strip()
    if not cleaned_message:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message is required")

    feedback_inbox = (
        os.getenv("FEEDBACK_INBOX")
        or os.getenv("SMTP_FROM_EMAIL")
        or os.getenv("SMTP_USER")
    )
    if not feedback_inbox:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Feedback inbox is not configured")

    subject = "PriceTracker | Feedback"
    html_body = (
        "<div style=\"font-family: Arial, sans-serif; background:#0b0b0f; color:#e2e8f0; padding:24px;\">"
        "<h2 style=\"margin:0 0 12px; color:#ffffff;\">User feedback received</h2>"
        f"<p style=\"margin:0 0 12px;\"><strong>From:</strong> {payload.email}</p>"
        f"<p style=\"margin:0; white-space: pre-line;\">{cleaned_message}</p>"
        "</div>"
    )

    email_ok = bool(await send_email_async(feedback_inbox, subject, html_body))
    if not email_ok:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Email could not be sent")

    return {"message": "Email sent", "sent": True}

@app.post("/api/internal/debug/scrape-now", tags=["Internal Debug"])
async def debug_scrape_now(
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    await _get_debug_user_or_forbid(db, current_user)

    started_at = datetime.utcnow()
    await scrape_job()
    finished_at = datetime.utcnow()

    return {
        "message": "Manual scrape completed",
        "started_at": started_at,
        "finished_at": finished_at,
        "duration_seconds": round((finished_at - started_at).total_seconds(), 2),
    }


@app.post("/api/internal/debug/notify-test", tags=["Internal Debug"])
async def debug_notify_test(
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    user = await _get_debug_user_or_forbid(db, current_user)

    from notifications.telegram import send_alert
    from notifications.email_service import send_price_drop_email

    now_label = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    telegram_ok = False
    email_ok = False
    telegram_allowed = is_telegram_allowed_for_user(user)

    if user.get("telegram_chat_id") and telegram_allowed:
        telegram_msg = (
            "🧪 <b>Debug Notification Test</b>\n\n"
            "This is a manual test message from the internal debug panel.\n"
            f"Time: {now_label}"
        )
        telegram_ok = bool(await send_alert(telegram_msg, user.get("telegram_chat_id")))

    if user.get("email_notifications", True):
        email_ok = bool(await send_price_drop_email(
            to_email=user["email"],
            user_name=user.get("full_name") or "User",
            product_name="Debug Test Product",
            old_price=1200.0,
            new_price=999.0,
            product_url="https://example.com/debug-test",
        ))

    return {
        "message": "Test notification dispatch attempted",
        "telegram": {
            "connected": bool(user.get("telegram_chat_id")),
            "allowed": telegram_allowed,
            "sent": telegram_ok,
        },
        "email": {
            "enabled": bool(user.get("email_notifications", True)),
            "sent": email_ok,
        },
        "timestamp": datetime.utcnow(),
    }


# ======================================================
# KEEP LEGACY ENDPOINTS
# ======================================================

@app.post("/scrape/{product_id}", tags=["Legacy - Scrape"])
async def manual_scrape(product_id: str, db=Depends(get_db)):
    from scrapers.engine import run_scraper_process
    pool_repo = ProductPoolRepository(db)
    product = await pool_repo.get_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    site = detect_site(product["original_url"])
    result = await run_scraper_process(site, product["original_url"])
    if result:
        await pool_repo.update_price(
            product_id,
            result["price"],
            result.get("name"),
            result.get("image_url")
        )
        return {"message": "Scrape successful", "mesaj": "Scrape successful", "fiyat": result["price"]}
    raise HTTPException(status_code=500, detail="Scrape failed")


# ¦¦ Background Task ¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦
async def scrape_and_update(product_id: str, url: str, db):
    from scrapers.engine import run_scraper_process
    from notifications.price_notifications import notify_tracked_item

    site = detect_site(url)
    pool_repo = ProductPoolRepository(db)
    history_repo = PriceHistoryRepository(db)
    tracked_repo = TrackedItemRepository(db)
    analyzer = PriceAnalyzer(history_repo)

    product = await pool_repo.get_by_id(product_id)
    old_price = product.get("current_price") if product else None

    result = await run_scraper_process(site, url)
    if result:
        await pool_repo.update_price(
            product_id,
            result["price"],
            result.get("name"),
            result.get("image_url")
        )

        await history_repo.create({
            "product_id": product_id,
            "price": result["price"],
            "currency": result.get("currency", "TRY"),
            "timestamp": datetime.utcnow(),
        })

        tracked_items = await tracked_repo.get_by_product(product_id)
        logger.info(f"Notification check: {len(tracked_items)} subscribers, old_price={old_price}")

        for item in tracked_items:
            await notify_tracked_item(
                db=db,
                tracked_repo=tracked_repo,
                analyzer=analyzer,
                item=item,
                product_id=product_id,
                product_name=result.get("name") or url,
                url=url,
                old_price=old_price,
                new_price=result["price"],
                reminder_hours=settings.target_reminder_hours,
            )

        logger.success(f"Background scrape completed: {url} › {result['price']} TRY")
    else:
        await pool_repo.increment_error(product_id)
        logger.error(f"Background scrape failed: {url}")