=== TELEGRAM BİLDİRİM SİSTEMİ SORUN ANALİZİ ===

✅ ÇALIŞAN KISMLAR:

1. Backend telegram.py
   - send_alert() fonksiyonu çalışıyor (chatID ve token kontrol var)
   - telegram_polling_loop() fonksiyonu startup'ta başlatılıyor
   - format_alert() mesaj formatlaması doğru

2. Main.py
   - Telegram polling loop başlatılıyor (line 102-104)
   - Product add/update işlemlerinde telegram notification gönderiliyor (lines 438-470)

3. Frontend Settings.tsx
   - Telegram bağlantı UI hazır
   - Bot link doğru: https://t.me/price_tracker_oguz_bot?start=user_{id}

❌ SORUNLAR:

1. **weekly_summary_job Telegram desteği yok** (KRITIK)
   - Location: backend/scheduler/tasks.py, lines 111-149
   - Sorun: Sadece email_notifications kontrol ediliyor
   - weekly_summary_job Telegram chat_id'leri görmüyor
   - Telegram kullananlar haftalık özet almıyor

2. **Database query yanlış** (SORUN)
   - weekly_summary_job'da: find({"email_notifications": True})
   - Bu yanlış! Telegram ve Email farklı seçenekler olabilir
   - Fix: find({"is_active": True}) olmalı veya ayrı kontrol

3. **Telegram mesaj formatı**
   - weekly_summary_job hiç telegram mesaj formatı yok
   - send_weekly_summary_telegram() fonksiyonu yok

4. **Avatar initial field sorusu**
   - UserResponse'de avatar_initial kullanılıyor ama User model'de yok
   - get_by_id de bunu handle etmiyor

5. **Frontend Watchlist.tsx**
   - useTrackedItems hook'u product.last_checked_at kullanıyor
   - Ama db'de updated_at veya last_scraped_at olabilir
   - Mismatch olabilir

ÇÖZÜM PLANI:

1. weekly_summary_job'a Telegram support ekle
2. telegram.py'de send_weekly_summary_telegram() ekle
3. Database sorgusu düzelt (email/telegram ayrı kontrol)
4. Avatar initial field'ını düzeltmeliyiz
5. Test kodları yaz (fiyat düşüş, haftalık özet vb.)
