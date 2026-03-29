from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger
from database.connection import get_database
from database.repository import ProductPoolRepository, TrackedItemRepository, PriceHistoryRepository
from analysis.price_analyzer import PriceAnalyzer
from datetime import datetime, timedelta
from config import settings

scheduler = AsyncIOScheduler()


async def scrape_job():
    logger.info("Starting automatic scraping...")
    from scrapers.engine import run_scraper_process
    from notifications.price_notifications import notify_tracked_item
    from datetime import datetime

    db = await get_database()
    pool_repo = ProductPoolRepository(db)
    tracked_repo = TrackedItemRepository(db)
    history_repo = PriceHistoryRepository(db)
    analyzer = PriceAnalyzer(history_repo)

    # Scrape only products that are actively tracked by at least one user.
    active_product_ids = set(await tracked_repo.get_all_active_product_ids())
    if not active_product_ids:
        logger.info("No actively tracked products found")
        return

    products = await pool_repo.get_all_active()
    products = [p for p in products if p["id"] in active_product_ids]

    if not products:
        logger.info("No active products in pool")
        return

    logger.info(f"Scraping {len(products)} actively tracked products")

    for product in products:
        product_id = product["id"]
        url = product["original_url"]
        source = product.get("source", "")
        old_price = product.get("current_price")

        try:
            result = await run_scraper_process(source, url)

            if not result:
                await pool_repo.increment_error(product_id)
                continue

            # Update price
            await pool_repo.update_price(
                product_id,
                result["price"],
                result.get("name"),
                result.get("image_url")
            )

            # Save to history
            await history_repo.create({
                "product_id": product_id,
                "price": result["price"],
                "currency": "TRY",
                "timestamp": datetime.utcnow(),
            })

            # Check if followers should be notified
            tracked_items = await tracked_repo.get_by_product(product_id)
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

            logger.success(f"✓ {url[:50]} → {result['price']} TRY")

        except Exception as e:
            logger.error(f"Scraping error ({url[:50]}): {e}")
            continue

    logger.info("Automatic scraping completed")

async def weekly_summary_job():
    logger.info("Starting weekly summary job...")
    try:
        from database.connection import get_database as get_db
        from database.repository import TrackedItemRepository, ProductPoolRepository
        from notifications.email_service import send_weekly_summary_email
        from notifications.telegram import send_alert, format_weekly_summary

        db_instance = await get_db()
        tracked_repo = TrackedItemRepository(db_instance)

        # Get all active users (regardless of notification preferences)
        users_cursor = db_instance["users"].find({"is_active": True})
        async for user in users_cursor:
            user_id = str(user["_id"])
            items = await tracked_repo.get_by_user(user_id)
            
            if items:
                formatted_items = []
                pool_repo = ProductPoolRepository(db_instance)
                
                for item in items:
                    prod = await pool_repo.get_by_id(item["product_id"])
                    if prod:
                        formatted_items.append({
                            "name": prod.get("name", "Unknown Product"),
                            "price": prod.get("current_price", 0.0),
                            "target_price": item.get("target_price"),
                            "discount": max(0, round((1 - (prod.get("current_price", 0) / item.get("target_price", 1))) * 100, 1)) if item.get("target_price") else 0
                        })
                
                # Send Email if user has email notifications enabled
                if user.get("email_notifications", True):
                    await send_weekly_summary_email(
                        to_email=user["email"],
                        user_name=user.get("full_name") or "User",
                        items=formatted_items,
                        dashboard_url="http://localhost:5173/dashboard"
                    )
                
                # Send Telegram if user has telegram connection
                if user.get("telegram_chat_id"):
                    telegram_message = format_weekly_summary(formatted_items)
                    await send_alert(telegram_message, user.get("telegram_chat_id"))
        
        logger.info("Weekly summary job completed successfully.")
    except Exception as e:
        logger.error(f"Weekly summary job error: {e}")

def start_scheduler():
    if settings.scheduler_mode == "off":
        logger.warning("Scheduler is disabled (SCHEDULER_MODE=off)")
        return

    if settings.scheduler_mode == "test":
        test_run_time = datetime.now() + timedelta(minutes=settings.scheduler_test_delay_minutes)
        scheduler.add_job(scrape_job, "date", run_date=test_run_time, id="test_scrape_once", replace_existing=True)
        scheduler.start()
        logger.info(
            f"Scheduler test mode enabled. Scrape will run once at {test_run_time.strftime('%H:%M:%S')} "
            f"(delay={settings.scheduler_test_delay_minutes}m)."
        )
        return

    scheduler.add_job(scrape_job, CronTrigger(hour=9, minute=0), id="scrape_morning", replace_existing=True)
    scheduler.add_job(scrape_job, CronTrigger(hour=21, minute=0), id="scrape_evening", replace_existing=True)
    scheduler.add_job(weekly_summary_job, CronTrigger(day_of_week="mon", hour=10, minute=0), id="weekly_summary", replace_existing=True)
    scheduler.start()
    logger.info("Scheduler started — 09:00, 21:00 (Scraping) and Monday 10:00 (Weekly Summary)")


def get_scheduler_status() -> dict:
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append(
            {
                "id": job.id,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
            }
        )

    return {
        "mode": settings.scheduler_mode,
        "running": scheduler.running,
        "jobs": jobs,
    }


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")