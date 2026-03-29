from datetime import datetime, timedelta
from bson import ObjectId
from loguru import logger

from notifications.telegram import send_alert, format_alert, format_target_hit_alert
from notifications.email_service import send_price_drop_email
from entitlements import is_telegram_allowed_for_user


def _is_reminder_due(last_sent_at, now: datetime, reminder_hours: int) -> bool:
    if not last_sent_at:
        return True
    return (now - last_sent_at) >= timedelta(hours=reminder_hours)


async def notify_tracked_item(
    *,
    db,
    tracked_repo,
    analyzer,
    item: dict,
    product_id: str,
    product_name: str,
    url: str,
    old_price: float | None,
    new_price: float,
    reminder_hours: int = 24,
) -> bool:
    now = datetime.utcnow()

    if not item.get("alerts_active", True):
        await tracked_repo.collection.update_one(
            {"_id": item["_id"]},
            {
                "$set": {
                    "last_notification_check_at": now,
                    "last_notification_status": "skipped",
                    "last_notification_reason": "alerts_disabled",
                }
            },
        )
        return False

    target_price = item.get("target_price")
    below_target = target_price is not None and new_price <= target_price

    # When price rises above target, reset both channel reminder timestamps.
    if not below_target and (item.get("last_target_telegram_alert_at") or item.get("last_target_email_alert_at")):
        await tracked_repo.collection.update_one(
            {"_id": item["_id"]},
            {
                "$unset": {
                    "last_target_telegram_alert_at": "",
                    "last_target_email_alert_at": "",
                }
            },
        )

    target_crossed = (
        target_price is not None
        and new_price <= target_price
        and (old_price is None or old_price > target_price)
    )

    target_zone_drop = (
        target_price is not None
        and new_price <= target_price
        and old_price is not None
        and new_price < old_price
    )

    significant_drop = False
    if old_price is not None and new_price < old_price:
        significant_drop = await analyzer.is_significant_drop(product_id)

    base_target_due = target_crossed or target_zone_drop

    telegram_target_due = base_target_due or (
        below_target and _is_reminder_due(item.get("last_target_telegram_alert_at"), now, reminder_hours)
    )
    email_target_due = base_target_due or (
        below_target and _is_reminder_due(item.get("last_target_email_alert_at"), now, reminder_hours)
    )

    user = await db["users"].find_one({"_id": ObjectId(item.get("user_id"))})
    if not user or not user.get("is_active", True):
        await tracked_repo.collection.update_one(
            {"_id": item["_id"]},
            {
                "$set": {
                    "last_notification_check_at": now,
                    "last_notification_status": "error",
                    "last_notification_reason": "user_inactive_or_missing",
                    "last_notification_error": "User is inactive or does not exist",
                }
            },
        )
        logger.debug(f"Skip notify: inactive/missing user for tracked item {item.get('id')}")
        return False

    sent_any = False
    attempted_any = False
    send_failures: list[str] = []
    sent_channels: list[str] = []
    update_fields: dict = {}
    telegram_allowed_for_plan = is_telegram_allowed_for_user(user)

    trigger_reason = "target_or_significant_drop"
    if significant_drop and not (telegram_target_due or email_target_due):
        trigger_reason = "significant_drop"
    elif telegram_target_due or email_target_due:
        trigger_reason = "target_due"

    if user.get("telegram_chat_id") and telegram_allowed_for_plan and (telegram_target_due or significant_drop):
        attempted_any = True
        if telegram_target_due:
            message = format_target_hit_alert(
                name=product_name,
                target_price=target_price,
                new_price=new_price,
                url=url,
                old_price=old_price,
            )
        else:
            message = format_alert(
                name=product_name,
                old_price=old_price if old_price is not None else new_price,
                new_price=new_price,
                url=url,
            )

        sent_tg = await send_alert(message, user.get("telegram_chat_id"))
        sent_any = sent_any or bool(sent_tg)
        if sent_tg:
            sent_channels.append("telegram")
        else:
            send_failures.append("Telegram send failed")
        if sent_tg and telegram_target_due:
            update_fields["last_target_telegram_alert_at"] = now
    elif user.get("telegram_chat_id") and not telegram_allowed_for_plan:
        logger.debug(f"Skip Telegram: current plan does not include telegram notifications for user {user.get('email')}")
    elif not user.get("telegram_chat_id"):
        logger.debug(f"Skip Telegram: no telegram_chat_id for user {user.get('email')}")

    if user.get("email_notifications", True) and (email_target_due or significant_drop):
        attempted_any = True
        email_ok = await send_price_drop_email(
            to_email=user["email"],
            user_name=user.get("full_name") or "User",
            product_name=product_name,
            old_price=old_price if old_price is not None else new_price,
            new_price=new_price,
            product_url=url,
        )
        sent_any = sent_any or bool(email_ok)
        if email_ok:
            sent_channels.append("email")
        else:
            send_failures.append("Email send failed")
        if email_ok and email_target_due:
            update_fields["last_target_email_alert_at"] = now

    if sent_any:
        update_fields.update(
            {
                "last_notification_at": now,
                "last_notification_check_at": now,
                "last_notification_status": "sent",
                "last_notification_reason": trigger_reason,
                "last_notification_channel": ",".join(sent_channels),
            }
        )
        update_fields["last_notification_error"] = None
    elif attempted_any and send_failures:
        update_fields.update(
            {
                "last_notification_check_at": now,
                "last_notification_status": "error",
                "last_notification_reason": trigger_reason,
                "last_notification_error": "; ".join(send_failures),
            }
        )
    else:
        skip_reason = "condition_not_met"
        if user.get("telegram_chat_id") and not telegram_allowed_for_plan and not user.get("email_notifications", True):
            skip_reason = "telegram_not_in_plan"
        elif not user.get("telegram_chat_id") and not user.get("email_notifications", True):
            skip_reason = "no_notification_channel_enabled"
        elif below_target and not (telegram_target_due or email_target_due):
            skip_reason = "reminder_not_due"
        update_fields.update(
            {
                "last_notification_check_at": now,
                "last_notification_status": "skipped",
                "last_notification_reason": skip_reason,
                "last_notification_error": None,
            }
        )

    if update_fields:
        await tracked_repo.collection.update_one(
            {"_id": item["_id"]},
            {"$set": update_fields},
        )

    if not sent_any:
        logger.debug(
            f"Skip notify product={product_id} user={item.get('user_id')} "
            f"old={old_price} new={new_price} target={target_price} "
            f"below_target={below_target} target_crossed={target_crossed} "
            f"target_zone_drop={target_zone_drop} significant_drop={significant_drop} "
            f"telegram_target_due={telegram_target_due} email_target_due={email_target_due}"
        )

    return sent_any
