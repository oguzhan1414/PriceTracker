from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

class Product(BaseModel):
    name: str = ""
    url: str
    site: str                              # "trendyol", "amazon", "hepsiburada"
    target_price: Optional[float] = None
    current_price: Optional[float] = None
    active: bool = True
    currency: str = "TRY"
    last_scraped_at: Optional[datetime] = None
    error_count: int = 0
    # DÃœZELTME: default_factory ile her seferinde gÃ¼ncel zamanÄ± alÄ±r
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PriceHistory(BaseModel):
    product_id: str
    price: float
    # DÃœZELTME: default_factory eklendi
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    currency: str = "TRY"
    scrape_ms: Optional[int] = None      # kaÃ§ ms'de Ã§ekildi

class ProductCreate(BaseModel):
    """API'den Ã¼rÃ¼n eklerken kullanÄ±lacak model"""
    url: str
    target_price: Optional[float] = None

class ProductUpdate(BaseModel):
    """PATCH /products/{id} iÃ§in â€” sadece bu alanlar gÃ¼ncellenebilir"""
    target_price: Optional[float] = None
    active: Optional[bool] = None


class TrackUpdate(BaseModel):
    """PATCH /track/update/{id} iÃ§in â€” tracked item alanlarÄ±"""
    target_price: Optional[float] = None
    is_active: Optional[bool] = None
    alerts_active: Optional[bool] = None

class ProductResponse(BaseModel):
    """API'nin dÃ¶ndÃ¼receÄŸi model"""
    id: str
    name: str
    url: str
    site: str
    target_price: Optional[float]
    current_price: Optional[float]
    active: bool
    currency: str
    last_scraped_at: Optional[datetime]
    error_count: int
    created_at: datetime



# â”€â”€ Yeni: User Modelleri â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class User(BaseModel):
    email: str
    hashed_password: str
    full_name: Optional[str] = None
    language: str = "en"
    role: str = "user"
    plan: str = "free"
    is_active: bool = True
    push_notifications: bool = True
    email_notifications: bool = True
    telegram_chat_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserRegister(BaseModel):
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    language: str = "en"
    avatar_initial: str
    role: str
    plan: str
    is_active: bool
    push_notifications: bool = True
    email_notifications: bool = True
    telegram_chat_id: Optional[str] = None
    created_at: datetime


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    push_notifications: Optional[bool] = None
    email_notifications: Optional[bool] = None
    language: Optional[Literal["en", "tr"]] = None


# â”€â”€ Yeni: TrackedItem Modelleri â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TrackedItem(BaseModel):
    user_id: str
    product_id: str
    target_price: Optional[float] = None
    is_active: bool = True
    alerts_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TrackRequest(BaseModel):
    url: str
    target_price: Optional[float] = None


class TrackedItemResponse(BaseModel):
    id: str
    user_id: str
    product_id: str
    target_price: Optional[float]
    is_active: bool
    alerts_active: bool = True
    created_at: datetime
    # ÃœrÃ¼n detaylarÄ± (join sonrasÄ±)
    product: Optional[dict] = None


