from __future__ import annotations

import asyncio
import re
from collections.abc import AsyncIterator
from typing import Any
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from .base import StoreConnector
from .html_generic import GenericHtmlConnector
from .json_api import GenericJsonApiConnector
from ..models import RawProduct, StockStatus


class BrowserRenderedConnector(StoreConnector):
    """Last-resort connector for JavaScript-rendered storefronts.

    Uses Playwright only after cheaper structured/HTTP strategies have been tried.
    It does not bypass authentication, CAPTCHAs or access controls. While the page
    renders, it may observe public JSON responses already requested by the storefront
    and reuse the generic JSON parser to enrich the matching product.
    """

    product_link_selectors = GenericHtmlConnector.product_link_selectors
    max_json_responses = 30

    async def _render(self, url: str) -> tuple[str, str, list[tuple[str, Any]]] | None:
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            return None

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page(
                    user_agent="MoldovaCommerceBot/0.2 (+catalog-indexer)",
                    viewport={"width": 1365, "height": 900},
                )
                network_json: list[tuple[str, Any]] = []
                capture_tasks: list[asyncio.Task] = []

                async def capture_json(response) -> None:
                    if len(network_json) >= self.max_json_responses:
                        return
                    try:
                        if response.status >= 400:
                            return
                        content_type = (response.headers.get("content-type") or "").lower()
                        resource_type = response.request.resource_type
                        if "json" not in content_type and resource_type not in ("xhr", "fetch"):
                            return
                        payload = await response.json()
                        if isinstance(payload, (dict, list)):
                            network_json.append((response.url, payload))
                    except Exception:
                        return

                def on_response(response) -> None:
                    if len(network_json) + len(capture_tasks) >= self.max_json_responses:
                        return
                    capture_tasks.append(asyncio.create_task(capture_json(response)))

                page.on("response", on_response)
                try:
                    response = await page.goto(url, wait_until="domcontentloaded", timeout=int(self.context.timeout_seconds * 1000))
                    if response and response.status in (401, 403, 429):
                        return None
                    try:
                        await page.wait_for_load_state("networkidle", timeout=5000)
                    except Exception:
                        pass
                    if capture_tasks:
                        await asyncio.gather(*capture_tasks, return_exceptions=True)
                    html = await page.content()
                    return page.url, html, network_json
                finally:
                    await browser.close()
        except Exception:
            return None

    async def discover_product_urls(self) -> AsyncIterator[str]:
        rendered = await self._render(self.context.base_url)
        if not rendered:
            return
        base_url, html, _network_json = rendered
        soup = BeautifulSoup(html, "lxml")
        seen: set[str] = set()
        for selector in self.product_link_selectors:
            for anchor in soup.select(selector):
                href = anchor.get("href")
                if not href:
                    continue
                url = urljoin(base_url, str(href))
                if url not in seen:
                    seen.add(url)
                    yield url

    def _parse_rendered_product(self, final_url: str, html: str) -> RawProduct | None:
        soup = BeautifulSoup(html, "lxml")
        page_text = soup.get_text(" ", strip=True)

        title = GenericHtmlConnector._first_text(soup, ["h1", '[itemprop="name"]', '.product-title', '.product__title'])
        if not title:
            return None

        price_text = GenericHtmlConnector._first_text(
            soup,
            ['[itemprop="price"]', '[data-price]', '.price-current', '.product-price', '.price', '.current-price'],
        )
        price = GenericHtmlConnector._decimal(price_text)
        if price is None:
            meta_price = soup.find("meta", attrs={"property": "product:price:amount"}) or soup.find("meta", attrs={"itemprop": "price"})
            price = GenericHtmlConnector._decimal(meta_price.get("content") if meta_price else None)
        if price is None:
            return None

        old_price = GenericHtmlConnector._decimal(
            GenericHtmlConnector._first_text(soup, ['.old-price', '.price-old', '.regular-price', 'del'])
        )
        image = GenericHtmlConnector._extract_product_image(soup, final_url)
        quantity = GenericHtmlConnector._quantity_from_text(page_text)

        availability_text = " ".join(
            filter(
                None,
                [
                    GenericHtmlConnector._first_text(soup, ['[itemprop="availability"]', '.stock', '.availability', '.product-stock']),
                    str(soup.find("meta", attrs={"property": "product:availability"}) or ""),
                ],
            )
        ).lower()
        if quantity == 0 or any(x in availability_text for x in ("out of stock", "indisponibil", "stoc epuizat", "нет в наличии")):
            status = StockStatus.OUT_OF_STOCK
        elif quantity is not None and quantity <= 10:
            status = StockStatus.LOW_STOCK
        elif quantity is not None and quantity > 10:
            status = StockStatus.IN_STOCK
        elif any(x in availability_text for x in ("low stock", "stoc limitat", "ultimele", "мало")):
            status = StockStatus.LOW_STOCK
        elif any(x in availability_text for x in ("in stock", "in stoc", "disponibil", "в наличии")):
            status = StockStatus.IN_STOCK
        else:
            status = StockStatus.UNKNOWN

        sku_node = soup.find(attrs={"itemprop": "sku"})
        sku = sku_node.get("content") if sku_node and sku_node.has_attr("content") else (sku_node.get_text(" ", strip=True) if sku_node else None)
        if not sku:
            sku = GenericHtmlConnector._sku_from_text(page_text)
        brand = GenericHtmlConnector._first_text(soup, ['[itemprop="brand"]', '.brand', '.product-brand'])
        category_path = [x.get_text(" ", strip=True) for x in soup.select('.breadcrumb a, nav[aria-label*="breadcrumb" i] a')][1:]
        if not category_path:
            category_path = GenericHtmlConnector._category_path_from_url(final_url)
        description = GenericHtmlConnector._first_text(soup, ['[itemprop="description"]', '.product-description', '#description', '.description'])

        return RawProduct(
            store_slug=self.context.store_slug,
            external_id=str(sku or GenericHtmlConnector._url_key(final_url)),
            title=title,
            description=description,
            brand=brand,
            sku=str(sku).strip() if sku else None,
            category_path=category_path,
            price=price,
            old_price=old_price,
            currency=GenericHtmlConnector._currency(soup),
            stock_status=status,
            quantity=quantity,
            url=final_url,
            image_url=image,
            attributes={"source": "browser-rendered"},
        )

    @staticmethod
    def _normalized_words(value: str) -> set[str]:
        return {part for part in re.findall(r"[a-z0-9]+", value.lower()) if len(part) > 1}

    @classmethod
    def _candidate_score(cls, dom: RawProduct, candidate: RawProduct, final_url: str) -> float:
        score = 0.0
        dom_ids = {str(value).lower() for value in (dom.sku, dom.ean, dom.external_id) if value}
        candidate_ids = {str(value).lower() for value in (candidate.sku, candidate.ean, candidate.external_id) if value}
        if dom_ids & candidate_ids:
            score += 8.0

        dom_words = cls._normalized_words(dom.title)
        candidate_words = cls._normalized_words(candidate.title)
        if dom_words and candidate_words:
            overlap = len(dom_words & candidate_words) / max(1, len(dom_words | candidate_words))
            score += overlap * 6.0
            if dom.title.strip().lower() == candidate.title.strip().lower():
                score += 4.0

        final_path = urlparse(final_url).path.rstrip("/").lower()
        candidate_path = urlparse(str(candidate.url)).path.rstrip("/").lower()
        if final_path and candidate_path and (final_path == candidate_path or final_path.endswith(candidate_path) or candidate_path.endswith(final_path)):
            score += 5.0
        return score

    def _network_product(
        self,
        final_url: str,
        dom_product: RawProduct,
        network_json: list[tuple[str, Any]],
    ) -> RawProduct | None:
        parser = GenericJsonApiConnector(self.context)
        best: tuple[float, RawProduct] | None = None
        for response_url, payload in network_json:
            for item in parser._walk(payload):
                if not parser._looks_like_product(item):
                    continue
                candidate = parser.product_from_item(item, response_url)
                if candidate is None:
                    continue
                score = self._candidate_score(dom_product, candidate, final_url)
                if score < 4.0:
                    continue
                if best is None or score > best[0]:
                    best = (score, candidate)
        return best[1] if best else None

    @staticmethod
    def _merge_network_product(
        dom: RawProduct,
        network: RawProduct | None,
        *,
        observed_json_responses: int = 0,
    ) -> RawProduct:
        data = dom.model_dump()
        data["attributes"] = {
            **(dom.attributes or {}),
            "network_json_responses": observed_json_responses,
            "network_json_product_match": network is not None,
        }
        if network is None:
            return RawProduct.model_validate(data)
        if dom.stock_status == StockStatus.UNKNOWN and network.stock_status != StockStatus.UNKNOWN:
            data["stock_status"] = network.stock_status
        if dom.quantity is None and network.quantity is not None:
            data["quantity"] = network.quantity
        if network.image_url and (not dom.image_url or str(network.image_url) != str(dom.image_url)):
            data["image_url"] = network.image_url
        if not dom.brand and network.brand:
            data["brand"] = network.brand
        if not dom.sku and network.sku:
            data["sku"] = network.sku
        if not dom.ean and network.ean:
            data["ean"] = network.ean
        if not dom.description and network.description:
            data["description"] = network.description
        if not dom.category_path and network.category_path:
            data["category_path"] = network.category_path
        data["attributes"] = {
            **data["attributes"],
            "network_json_enriched": True,
            "network_source": str((network.attributes or {}).get("source") or "generic-json-api"),
        }
        return RawProduct.model_validate(data)

    async def fetch_product(self, url: str) -> RawProduct | None:
        rendered = await self._render(url)
        if not rendered:
            return None
        final_url, html, network_json = rendered
        dom_product = self._parse_rendered_product(final_url, html)
        if dom_product is None:
            return None
        network_product = self._network_product(final_url, dom_product, network_json)
        return self._merge_network_product(
            dom_product,
            network_product,
            observed_json_responses=len(network_json),
        )
