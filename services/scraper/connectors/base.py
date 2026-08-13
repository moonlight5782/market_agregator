from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass
from time import monotonic
from typing import Any

import httpx

from ..models import RawProduct
from ..robots import RobotsPolicy


@dataclass(frozen=True)
class ConnectorContext:
    store_slug: str
    base_url: str
    requests_per_second: float = 1.0
    timeout_seconds: float = 20.0
    robots_policy: RobotsPolicy | None = None


class StoreConnector(ABC):
    """Store-specific acquisition lives behind this interface.

    Catalog/search/business logic must never branch on store name. HTTP clients
    created by a connector share one rate limiter, so discovery and product-page
    fetching cannot accidentally exceed the configured request rate.
    """

    def __init__(self, context: ConnectorContext) -> None:
        self.context = context
        self._rate_lock = asyncio.Lock()
        self._last_request_started_at = 0.0

    @property
    def _request_interval(self) -> float:
        return 1.0 / max(self.context.requests_per_second, 0.1)

    def is_url_allowed(self, url: str) -> bool:
        return self.context.robots_policy is None or self.context.robots_policy.can_fetch(url)

    async def _enforce_robots(self, request: httpx.Request) -> None:
        if not self.is_url_allowed(str(request.url)):
            raise httpx.RequestError(
                f"Robots policy disallows {request.url}",
                request=request,
            )

    async def _throttle_request(self, request: httpx.Request) -> None:
        del request
        async with self._rate_lock:
            now = monotonic()
            wait_for = self._request_interval - (now - self._last_request_started_at)
            if wait_for > 0:
                await asyncio.sleep(wait_for)
            self._last_request_started_at = monotonic()

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            timeout=self.context.timeout_seconds,
            follow_redirects=True,
            headers={"User-Agent": "MoldovaCommerceBot/0.1 (+catalog-indexer)"},
            event_hooks={"request": [self._enforce_robots, self._throttle_request]},
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
