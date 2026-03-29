import os
import httpx
import asyncio
from datetime import datetime
from dotenv import load_dotenv
from loguru import logger
from bson import ObjectId

load_dotenv()

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
TELEGRAM_GLOBAL_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")  # Eskiden listelenen sabit ID
TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "price_tracker_oguz_bot").strip().lstrip("@")


def build_start_url(start_payload: str) -> str:
    return f"https://t.me/{TELEGRAM_BOT_USERNAME}?start={start_payload}"


def _extract_start_payload(text: str) -> str | None:
    if not text.startswith("/start"):
        return None
    parts = text.split(maxsplit=1)
    if len(parts) == 1:
        return None
    payload = parts[1].strip()
    return payload or None

async def send_alert(text: str, chat_id: str = None) -> bool:
    """Belirli bir chat_id ye veya verilmezse genel chat_id'ye mesaj atar"""
    target_chat_id = chat_id or TELEGRAM_GLOBAL_CHAT_ID
    
    if not TELEGRAM_TOKEN or not target_chat_id:
        logger.error("Telegram token veya chat ID eksik!")
        return False

    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(url, json={
                "chat_id": target_chat_id,
                "text": text,
                "parse_mode": "HTML"
            })
            if response.status_code == 200:
                logger.success(f"Telegram bildirimi gönderildi -> {target_chat_id}")
                return True
            else:
                logger.error(f"Telegram hatası: {response.text}")
                return False
    except Exception as e:
        logger.error(f"Telegram bağlantı hatası: {e}")
        return False

def format_alert(name: str, old_price: float, new_price: float, url: str) -> str:
    diff = old_price - new_price
    pct = round((diff / old_price) * 100, 1) if old_price else 0.0

    return (
        f"🔔 <b>Price Drop Alert!</b>\n\n"
        f"📦 <b>{name}</b>\n\n"
        f"💰 <s>{old_price} TRY</s> → <b>{new_price} TRY</b>\n"
        f"📉 <b>{pct}% discount</b> (Save {round(diff, 2)} TRY)\n\n"
        f"🔗 <a href='{url}'>View Product</a>"
    )


def format_target_hit_alert(
    name: str,
    target_price: float,
    new_price: float,
    url: str,
    old_price: float | None = None,
) -> str:
    savings_vs_target = round(target_price - new_price, 2)
    below_pct = round(((target_price - new_price) / target_price) * 100, 1) if target_price else 0.0

    old_line = ""
    if old_price is not None and old_price != new_price:
        old_line = f"📊 Previous: <s>{old_price} TRY</s>\n"

    return (
        f"🎯 <b>Target Reached!</b>\n\n"
        f"📦 <b>{name}</b>\n\n"
        f"🎯 Your Target: <b>{target_price} TRY</b>\n"
        f"💰 Current Price: <b>{new_price} TRY</b>\n"
        f"{old_line}"
        f"✅ Opportunity: <b>{savings_vs_target} TRY below your target</b> ({below_pct}%)\n\n"
        f"🛒 Good time to buy.\n"
        f"🔗 <a href='{url}'>View Product</a>"
    )

def format_weekly_summary(items: list[dict]) -> str:
    """Format haftalık özet mesajı Telegram için"""
    if not items:
        return (
            "📅 <b>Weekly Summary</b>\n\n"
            "You have no active tracked items this week.\n"
            "Start tracking products to get alerts!"
        )
    
    items_text = ""
    for idx, item in enumerate(items[:10], 1):  # Max 10 item göster
        name = item.get("name", "Unknown Product")[:40]
        price = item.get("price", 0.0)
        discount = item.get("discount", 0)
        items_text += f"{idx}. <b>{name}</b>\n   💰 {price:,.2f} TRY"
        if discount > 0:
            items_text += f" <b>(-{discount}%)</b>"
        items_text += "\n\n"
    
    return (
        f"📅 <b>Weekly Summary</b>\n\n"
        f"You're tracking {len(items)} products:\n\n"
        f"{items_text}"
        f"Check your dashboard for full details!"
    )

# Telegram Uzun Dinleme (Polling) İşlemi - Kullanıcı hesabını entegre etmek için
async def telegram_polling_loop():
    if not TELEGRAM_TOKEN:
        logger.warning("TELEGRAM_TOKEN not set. Polling cannot start.")
        return
        
    logger.info("Starting Telegram Polling...")
    
    # Döngüsel bağımlılığı önlemek için DB importunu buraya koyuyoruz
    from database.connection import get_database
    db = await get_database()
    link_tokens = db["telegram_link_tokens"]
    
    offset = 0
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/getUpdates"

    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            try:
                response = await client.post(url, json={"offset": offset, "timeout": 20})
                if response.status_code == 200:
                    data = response.json()
                    for update in data.get("result", []):
                        offset = update["update_id"] + 1
                        
                        message = update.get("message", {})
                        text = message.get("text", "")
                        chat_id = str(message.get("chat", {}).get("id"))
                        payload = _extract_start_payload(text)
                        
                        if payload and payload.startswith("link_"):
                            try:
                                token_doc = await link_tokens.find_one(
                                    {
                                        "code": payload,
                                        "expires_at": {"$gt": datetime.utcnow()},
                                        "consumed_at": None,
                                    }
                                )

                                if not token_doc:
                                    await send_alert(
                                        "❌ This connection code is invalid or expired. Please generate a new one in Settings.",
                                        chat_id=chat_id,
                                    )
                                    continue

                                user_id = token_doc.get("user_id")
                                if not user_id:
                                    await send_alert(
                                        "❌ Invalid connection payload. Please generate a new one in Settings.",
                                        chat_id=chat_id,
                                    )
                                    continue

                                await db["users"].update_one(
                                    {"_id": ObjectId(user_id)},
                                    {
                                        "$set": {
                                            "telegram_chat_id": chat_id,
                                            "telegram_connected_at": datetime.utcnow(),
                                        }
                                    },
                                )

                                await link_tokens.update_one(
                                    {"_id": token_doc["_id"]},
                                    {
                                        "$set": {
                                            "consumed_at": datetime.utcnow(),
                                            "consumed_by_chat_id": chat_id,
                                        }
                                    },
                                )
                                await link_tokens.delete_many(
                                    {
                                        "user_id": user_id,
                                        "consumed_at": None,
                                        "code": {"$ne": payload},
                                    }
                                )

                                logger.success(f"User ({user_id}) connected Telegram via secure token. Chat ID: {chat_id}")
                                await send_alert(
                                    "✅ Your account has been connected to Telegram successfully. You can return to the app and refresh status.",
                                    chat_id=chat_id,
                                )
                            except Exception as db_err:
                                logger.error(f"Telegram token-link DB error: {db_err}")
                                await send_alert("❌ An error occurred during connection setup.", chat_id=chat_id)

                        elif payload and payload.startswith("user_"):
                            # Backward compatibility with old deep-link format.
                            user_id = payload.split("user_", 1)[1].strip()
                            try:
                                result = await db["users"].update_one(
                                    {"_id": ObjectId(user_id)},
                                    {
                                        "$set": {
                                            "telegram_chat_id": chat_id,
                                            "telegram_connected_at": datetime.utcnow(),
                                        }
                                    },
                                )

                                if result.modified_count > 0:
                                    welcome_msg = "✅ Your account has been successfully connected to Telegram!"
                                    logger.success(f"User ({user_id}) connected Telegram with legacy payload.")
                                else:
                                    welcome_msg = "✅ Connection updated (your account is already linked)."

                                await send_alert(welcome_msg, chat_id=chat_id)
                            except Exception as db_err:
                                logger.error(f"Telegram legacy connection DB error: {db_err}")
                                await send_alert("❌ An error occurred during connection setup.", chat_id=chat_id)

                        elif text == "/start":
                            await send_alert("👋 Welcome to PriceTracker bot. You can link your account from the app.", chat_id=chat_id)

            except Exception as e:
                logger.error(f"Telegram polling error (or timeout): {e}")
                await asyncio.sleep(2)

