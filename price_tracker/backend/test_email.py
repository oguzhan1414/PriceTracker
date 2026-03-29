import asyncio
import os
import sys

# Proje dizinini yola ekle ki absolute import'lar (backend.*) çalışabilsin
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.notifications.email_service import send_price_drop_email, send_weekly_summary_email

async def test_email_system():
    test_email = input("Lütfen test e-postasının gönderileceği mail adresini girin: ")
    test_name = "Oğuzhan"

    print("\n[1] Fiyat Düşüşü (Price Drop) Maili Test Ediliyor...")
    success1 = await send_price_drop_email(
        to_email=test_email,
        user_name=test_name,
        product_name="Apple iPhone 15 Pro Max 256 GB Titanyum",
        old_price=85000.00,
        new_price=79999.00,
        product_url="https://www.hepsiburada.com/iphone-15-pro-max"
    )
    if success1:
        print("✅ Fiyat düşüş e-postası başarıyla gönderildi!")
    else:
        print("❌ Fiyat düşüş e-postası gönderilemedi. Lütfen .env SMTP ayarlarını kontrol ediniz.")

    print("\n[2] Haftalık Özet (Weekly Summary) Maili Test Ediliyor...")
    success2 = await send_weekly_summary_email(
        to_email=test_email,
        user_name=test_name,
        items=[
            {"name": "Apple MacBook Pro M3 Çip", "price": 63400.50},
            {"name": "Sony PlayStation 5", "price": 28999.00}
        ],
        dashboard_url="http://localhost:5173/dashboard"
    )

    if success2:
        print("✅ Haftalık özet e-postası başarıyla gönderildi!")
    else:
        print("❌ Haftalık özet e-postası gönderilemedi.")

if __name__ == "__main__":
    asyncio.run(test_email_system())