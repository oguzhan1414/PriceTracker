import os
import sys
from dataclasses import dataclass
from typing import List

from dotenv import load_dotenv
from loguru import logger

load_dotenv()


@dataclass(frozen=True)
class Settings:
    app_env: str
    cookie_secure: bool
    allowed_origins: List[str]
    login_max_attempts: int
    login_window_seconds: int
    scheduler_mode: str
    scheduler_test_delay_minutes: int
    target_reminder_hours: int
    internal_debug_enabled: bool
    internal_debug_require_admin: bool
    payment_enabled: bool
    payment_providers_enabled: List[str]
    payment_default_provider: str
    payment_sandbox_mode: bool
    payment_public_notice: str
    payment_currency: str
    payment_price_pro_monthly: float
    payment_price_pro_yearly: float
    free_max_tracked_items: int
    free_telegram_enabled: bool
    payment_success_url: str
    payment_cancel_url: str
    payment_webhook_tolerance_seconds: int
    stripe_secret_key: str
    stripe_publishable_key: str
    stripe_webhook_secret: str
    stripe_price_id_pro_monthly: str
    stripe_price_id_pro_yearly: str
    stripe_product_id: str
    stripe_monthly_product_id: str
    stripe_yearly_product_id: str
    iyzico_api_key: str
    iyzico_secret_key: str
    iyzico_base_url: str
    iyzico_callback_url: str
    iyzico_webhook_secret: str
    iyzico_subscription_plan_pro_monthly: str
    iyzico_subscription_plan_pro_yearly: str
    iyzico_checkout_url_template: str
    telegram_bot_username: str
    telegram_link_code_ttl_minutes: int
    log_level: str
    mongo_url: str


VALID_LOG_LEVELS = {"TRACE", "DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}


def _as_bool(value: str, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_allowed_origins(raw_value: str) -> List[str]:
    return [origin.strip() for origin in raw_value.split(",") if origin.strip()]


def _parse_csv(raw_value: str) -> List[str]:
    return [value.strip().lower() for value in raw_value.split(",") if value.strip()]


def _resolve_scheduler_mode(app_env: str) -> str:
    explicit = os.getenv("SCHEDULER_MODE")
    if explicit:
        mode = explicit.strip().lower()
        if mode in {"cron", "test", "off"}:
            return mode

    # Backward compatibility with old flag.
    old_test_flag = _as_bool(os.getenv("SCHEDULER_TEST_MODE"), False)
    if old_test_flag:
        return "test"

    return "cron" if app_env == "production" else "test"


def load_settings() -> Settings:
    app_env = os.getenv("APP_ENV", os.getenv("ENV", "development")).strip().lower()
    cookie_secure_default = app_env == "production"
    internal_debug_default = app_env != "production"
    internal_debug_admin_default = app_env == "production"
    log_level_default = "INFO" if app_env == "production" else "DEBUG"

    allowed_origins = _parse_allowed_origins(os.getenv("ALLOWED_ORIGINS", "http://localhost:5173"))

    return Settings(
        app_env=app_env,
        cookie_secure=_as_bool(os.getenv("COOKIE_SECURE"), cookie_secure_default),
        allowed_origins=allowed_origins,
        login_max_attempts=int(os.getenv("LOGIN_MAX_ATTEMPTS", "5")),
        login_window_seconds=int(os.getenv("LOGIN_WINDOW_SECONDS", "900")),
        scheduler_mode=_resolve_scheduler_mode(app_env),
        scheduler_test_delay_minutes=int(os.getenv("SCHEDULER_TEST_DELAY_MINUTES", "2")),
        target_reminder_hours=int(os.getenv("TARGET_REMINDER_HOURS", "24")),
        internal_debug_enabled=_as_bool(os.getenv("INTERNAL_DEBUG_ENABLED"), internal_debug_default),
        internal_debug_require_admin=_as_bool(os.getenv("INTERNAL_DEBUG_REQUIRE_ADMIN"), internal_debug_admin_default),
        payment_enabled=_as_bool(os.getenv("PAYMENT_ENABLED"), False),
        payment_providers_enabled=_parse_csv(os.getenv("PAYMENT_PROVIDERS_ENABLED", "stripe,iyzico")),
        payment_default_provider=os.getenv("PAYMENT_DEFAULT_PROVIDER", "stripe").strip().lower(),
        payment_sandbox_mode=_as_bool(os.getenv("PAYMENT_SANDBOX_MODE"), True),
        payment_public_notice=os.getenv(
            "PAYMENT_PUBLIC_NOTICE",
            "Payments are currently in sandbox/test mode. Do not use real card information.",
        ).strip(),
        payment_currency=os.getenv("PAYMENT_CURRENCY", "TRY").strip().upper(),
        payment_price_pro_monthly=float(os.getenv("PAYMENT_PRICE_PRO_MONTHLY", "2.99")),
        payment_price_pro_yearly=float(os.getenv("PAYMENT_PRICE_PRO_YEARLY", "29.99")),
        free_max_tracked_items=int(os.getenv("FREE_MAX_TRACKED_ITEMS", "5")),
        free_telegram_enabled=_as_bool(os.getenv("FREE_TELEGRAM_ENABLED"), False),
        payment_success_url=os.getenv("PAYMENT_SUCCESS_URL", "http://localhost:5173/payment/success").strip(),
        payment_cancel_url=os.getenv("PAYMENT_CANCEL_URL", "http://localhost:5173/payment/cancel").strip(),
        payment_webhook_tolerance_seconds=int(os.getenv("PAYMENT_WEBHOOK_TOLERANCE_SECONDS", "300")),
        stripe_secret_key=os.getenv("STRIPE_SECRET_KEY", "").strip(),
        stripe_publishable_key=os.getenv("STRIPE_PUBLISHABLE_KEY", "").strip(),
        stripe_webhook_secret=os.getenv("STRIPE_WEBHOOK_SECRET", "").strip(),
        stripe_price_id_pro_monthly=os.getenv("STRIPE_PRICE_ID_PRO_MONTHLY", "").strip(),
        stripe_price_id_pro_yearly=os.getenv("STRIPE_PRICE_ID_PRO_YEARLY", "").strip(),
        stripe_product_id=os.getenv("STRIPE_PRODUCT_ID", "").strip(),
        stripe_monthly_product_id=(
            os.getenv("MONTHLY_PRODUCT_ID")
            or os.getenv("STRIPE_MONTHLY_PRODUCT_ID", "")
        ).strip(),
        stripe_yearly_product_id=(
            os.getenv("YEARLY_PRODUCT_ID")
            or os.getenv("STRIPE_YEARLY_PRODUCT_ID", "")
        ).strip(),
        iyzico_api_key=os.getenv("IYZICO_API_KEY", "").strip(),
        iyzico_secret_key=os.getenv("IYZICO_SECRET_KEY", "").strip(),
        iyzico_base_url=os.getenv("IYZICO_BASE_URL", "https://sandbox-api.iyzipay.com").strip(),
        iyzico_callback_url=os.getenv("IYZICO_CALLBACK_URL", "http://localhost:8000/api/payments/callback/iyzico").strip(),
        iyzico_webhook_secret=os.getenv("IYZICO_WEBHOOK_SECRET", "").strip(),
        iyzico_subscription_plan_pro_monthly=os.getenv("IYZICO_SUBSCRIPTION_PLAN_PRO_MONTHLY", "").strip(),
        iyzico_subscription_plan_pro_yearly=os.getenv("IYZICO_SUBSCRIPTION_PLAN_PRO_YEARLY", "").strip(),
        iyzico_checkout_url_template=os.getenv("IYZICO_CHECKOUT_URL_TEMPLATE", "").strip(),
        telegram_bot_username=os.getenv("TELEGRAM_BOT_USERNAME", "price_tracker_oguz_bot").strip().lstrip("@"),
        telegram_link_code_ttl_minutes=int(os.getenv("TELEGRAM_LINK_CODE_TTL_MINUTES", "10")),
        log_level=os.getenv("LOG_LEVEL", log_level_default).strip().upper(),
        mongo_url=os.getenv("MONGO_URL", "").strip(),
    )


def validate_startup_settings(settings: Settings) -> List[str]:
    errors: List[str] = []

    if not settings.mongo_url:
        errors.append("MONGO_URL is required")

    if settings.log_level not in VALID_LOG_LEVELS:
        errors.append(f"LOG_LEVEL must be one of: {', '.join(sorted(VALID_LOG_LEVELS))}")

    if settings.scheduler_mode not in {"cron", "test", "off"}:
        errors.append("SCHEDULER_MODE must be one of: cron, test, off")

    valid_providers = {"stripe", "iyzico"}
    invalid_providers = [p for p in settings.payment_providers_enabled if p not in valid_providers]
    if invalid_providers:
        errors.append(f"Unsupported payment provider(s): {', '.join(invalid_providers)}")

    if settings.payment_default_provider and settings.payment_default_provider not in valid_providers:
        errors.append("PAYMENT_DEFAULT_PROVIDER must be one of: stripe, iyzico")

    if settings.payment_enabled and settings.payment_default_provider not in settings.payment_providers_enabled:
        errors.append("PAYMENT_DEFAULT_PROVIDER must be included in PAYMENT_PROVIDERS_ENABLED")

    if settings.free_max_tracked_items <= 0:
        errors.append("FREE_MAX_TRACKED_ITEMS must be a positive integer")

    if settings.telegram_link_code_ttl_minutes <= 0:
        errors.append("TELEGRAM_LINK_CODE_TTL_MINUTES must be a positive integer")

    if settings.app_env == "production":
        if not settings.cookie_secure:
            errors.append("COOKIE_SECURE must be true in production")
        if any(origin == "*" for origin in settings.allowed_origins):
            errors.append("ALLOWED_ORIGINS cannot contain '*' in production")
        if not settings.allowed_origins:
            errors.append("ALLOWED_ORIGINS must contain at least one origin in production")

    return errors


def configure_logging(settings: Settings):
    logger.remove()
    logger.add(sys.stderr, level=settings.log_level)


settings = load_settings()
