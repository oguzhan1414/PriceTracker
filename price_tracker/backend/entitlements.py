from __future__ import annotations

from typing import Optional

from config import settings

PREMIUM_PLAN_KEYS = {"pro", "premium"}
ACTIVE_SUBSCRIPTION_STATES = {"active", "trialing"}


def is_premium_user(user: dict | None) -> bool:
    if not user:
        return False

    if bool(user.get("is_pro")):
        return True

    plan = str(user.get("plan") or "").strip().lower()
    subscription_status = str(user.get("subscription_status") or "").strip().lower()

    return plan in PREMIUM_PLAN_KEYS and subscription_status in ACTIVE_SUBSCRIPTION_STATES


def get_max_tracked_items_for_user(user: dict | None) -> Optional[int]:
    if is_premium_user(user):
        return None
    return settings.free_max_tracked_items


def is_telegram_allowed_for_user(user: dict | None) -> bool:
    if is_premium_user(user):
        return True
    return settings.free_telegram_enabled


def get_plan_feature_flags(user: dict | None) -> dict:
    return {
        "max_tracked_items": get_max_tracked_items_for_user(user),
        "telegram_notifications": is_telegram_allowed_for_user(user),
    }
