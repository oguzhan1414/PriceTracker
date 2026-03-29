import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

# SMTP Settings
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL") or SMTP_USER or "noreply@pricetracker.app"
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "PriceTracker")

# Notification Preferences (Global Toggle)
NOTIFICATION_ENABLED = os.getenv("NOTIFICATION_ENABLED", "true").lower() == "true"
PRICE_DROP_ALERT_ENABLED = os.getenv("PRICE_DROP_ALERT_ENABLED", "true").lower() == "true"
WEEKLY_REMINDER_ENABLED = os.getenv("WEEKLY_REMINDER_ENABLED", "true").lower() == "true"

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")


def load_template(filename: str) -> str:
    path = os.path.join(TEMPLATE_DIR, filename)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        logger.error(f"Failed to load template: {path} - {e}")
        return ""


async def send_email_async(to_email: str, subject: str, html_body: str) -> bool:
    """Send email asynchronously (blocking smtplib runs in background)."""
    if not NOTIFICATION_ENABLED:
        logger.info("Email framework disabled (.env NOTIFICATION_ENABLED=false)")
        return False
        
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.error("SMTP settings missing (check .env)")
        return False

    import asyncio
    loop = asyncio.get_running_loop()

    def sync_send():
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg["To"] = to_email

        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)

    try:
        await loop.run_in_executor(None, sync_send)
        logger.success(f"Email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Email sending error: {e}")
        return False


async def send_price_drop_email(to_email: str, user_name: str, product_name: str, old_price: float, new_price: float, product_url: str):
    if not PRICE_DROP_ALERT_ENABLED:
        return False
        
    template = load_template("price_alert.html")
    if not template:
        return False

    # Simple replacements
    html_body = template.replace("{user_name}", user_name or "User")
    html_body = html_body.replace("{product_name}", product_name)
    html_body = html_body.replace("{old_price}", f"{old_price:,.2f}")
    html_body = html_body.replace("{new_price}", f"{new_price:,.2f}")
    html_body = html_body.replace("{product_url}", product_url)

    subject = f"🔥 Price Drop: {product_name[:30]}..."
    return await send_email_async(to_email, subject, html_body)


async def send_weekly_summary_email(to_email: str, user_name: str, items: list[dict], dashboard_url: str):
    if not WEEKLY_REMINDER_ENABLED:
        return False

    template = load_template("weekly_summary.html")
    if not template:
        return False

    # Generate products HTML list
    items_html = ""
    for item in items:
        name = item.get("name", "Unknown Product")
        price = item.get("price", 0.0)
        items_html += f'<div class="item"><strong>{name}</strong> <br> <span style="color:#10b981">{price:,.2f} TL</span></div>'
        
    if not items_html:
        items_html = "<p>You don't have any active tracked products right now.</p>"

    html_body = template.replace("{user_name}", user_name or "User")
    html_body = html_body.replace("{items_html}", items_html)
    html_body = html_body.replace("{dashboard_url}", dashboard_url)

    subject = "📅 Your Weekly Price Tracking Summary"
    return await send_email_async(to_email, subject, html_body)
