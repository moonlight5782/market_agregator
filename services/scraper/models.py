from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field, HttpUrl


class StockStatus(str, Enum):
    IN_STOCK = "IN_STOCK"
    LOW_STOCK = "LOW_STOCK"
    OUT_OF_STOCK = "OUT_OF_STOCK"
    PREORDER = "PREORDER"
    UNKNOWN = "UNKNOWN"


class RawAvailability(BaseModel):
    location_external_id: str | None = None
    location_name: str | None = None
    city: str
    address: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    stock_status: StockStatus = StockStatus.UNKNOWN
    quantity: int | None = None


class RawProduct(BaseModel):
    store_slug: str
    external_id: str | None = None
    title: str
    description: str | None = None
    brand: str | None = None
    sku: str | None = None
    ean: str | None = None
    mpn: str | None = None
    category_path: list[str] = Field(default_factory=list)
    price: Decimal
    old_price: Decimal | None = None
    currency: str = "MDL"
    stock_status: StockStatus = StockStatus.UNKNOWN
    quantity: int | None = None
    url: HttpUrl
    image_url: HttpUrl | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)
    location_external_id: str | None = None
    availabilities: list[RawAvailability] = Field(default_factory=list)
    fetched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class NormalizedProduct(RawProduct):
    normalized_title: str
    normalized_brand: str | None = None
    category_slug: str | None = None
    data_quality: float = Field(ge=0, le=1)
