from __future__ import annotations

from collections.abc import AsyncIterator
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from .base import StoreConnector
from .html_generic import GenericHtmlConnector
from ..models import RawProduct, StockStatus


class BrowserRenderedConnector(StoreConnector):
    """Last-resort connector for JavaScript-rendered storefronts.

    Uses Playwright only after cheaper structured/HTTP strategies have been tried.
    It does not bypass authentication, CAPTCHAs or access controls.
    """

    product_link_selectors = GenericHtmlConnector.product_link_selectors

    async def _render(self, url: str) -> tuple[str, str] | None:
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
                try:
                    response = await page.goto(url, wait_until="domcontentloaded", timeout=int(self.context.timeout_seconds * 1000))
                    if response and response.status in (401, 403, 429):
                        return None
                    try:
                        await page.wait_for_load_state("networkidle", timeout=5000)
                    except Exception:
                        pass
                    html = await page.content()
                    return page.url, html
                finally:
                    await browser.close()
        except Exception:
            return None

    async def discover_product_urls(self) -> AsyncIterator[str]:
        rendered = await self._render(self.context.base_url)
        if not rendered:
            return
        base_url, html = rendered
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

    async def fetch_product(self, url: str) -> RawProduct | None:
        rendered = await self._render(url)
        if not rendered:
            return None
        final_url, html = rendered
        return self._parse_rendered_product(final_url, html)
