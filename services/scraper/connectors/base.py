from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

import httpx

from ..models import RawProduct


@dataclass(frozen=True)
class ConnectorContext:
    store_slug: str
    base_url: str
    requests_per_second: float = 1.0
    timeout_seconds: float = 20.0


class StoreConnector(ABC):
    """Store-specific acquisition lives behind this interface.

    Catalog/search/business logic must never branch on store name.
    """

    def __init__(self, context: ConnectorContext) -> None:
        self.context = context

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            timeout=self.context.timeout_seconds,
            follow_redirects=True,
            headers={"User-Agent": "MoldovaCommerceBot/0.1 (+catalog-indexer)"},
        )

    @abstractmethod
    async def discover_product_urls(self) -> AsyncIterator[str]:
        raise NotImplementedError

    @abstractmethod
    async def fetch_product(self, url: str) -> RawProduct | None:
        raise NotImplementedError

    async def healthcheck(self) -> dict[str, Any]:
        async with self.client() as client:
            response = await client.get(self.context.base_url)
            return {"status_code": response.status_code, "ok": response.is_success}
