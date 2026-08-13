from __future__ import annotations

from dataclasses import dataclass

from .base import ConnectorContext, StoreConnector
from .browser_generic import BrowserRenderedConnector
from .catalog_generic import GenericCatalogConnector
from .cactus import CactusConnector
from .darwin import DarwinConnector
from .feed_generic import GenericFeedConnector
from .html_generic import GenericHtmlConnector
from .json_api import GenericJsonApiConnector
from .jsonld import SitemapJsonLdConnector
from .maximum import MaximumConnector
from ..source_discovery import SourceProfile


@dataclass(frozen=True)
class ConnectorChoice:
    name: str
    connector: StoreConnector
    reason: str
    priority: int


def build_connector_plan(context: ConnectorContext, profile: SourceProfile) -> list[ConnectorChoice]:
    """Return acquisition strategies in strict priority order.

    The default path must work for previously unknown stores. Store-specific
    connectors are optional optimizers/enrichers, never the foundation of the
    acquisition engine.
    """
    plan: list[ConnectorChoice] = []

    if profile.api_hints:
        plan.append(ConnectorChoice(
            name="json-api",
            connector=GenericJsonApiConnector(context, endpoints=profile.api_hints),
            reason=f"{len(profile.api_hints)} public API/JSON endpoint hint(s) detected",
            priority=10,
        ))

    if profile.feed_hints:
        plan.append(ConnectorChoice(
            name="catalog-feed",
            connector=GenericFeedConnector(context, feeds=profile.feed_hints),
            reason=f"{len(profile.feed_hints)} public JSON/XML/CSV/YML feed(s) detected",
            priority=20,
        ))

    if profile.sitemap_urls or profile.product_jsonld or profile.embedded_json:
        plan.append(ConnectorChoice(
            name="sitemap-jsonld",
            connector=SitemapJsonLdConnector(context, sitemap_urls=profile.sitemap_urls),
            reason="sitemap/JSON-LD/embedded structured data detected",
            priority=30,
        ))

    # Universal same-origin catalog traversal works even when the store has no
    # registry-specific implementation. Source discovery supplies official
    # catalog roots first so we do not depend on homepage traversal order.
    plan.append(ConnectorChoice(
        name="catalog-generic",
        connector=GenericCatalogConnector(context, seed_urls=profile.catalog_urls),
        reason=(
            f"generic same-origin catalog/category discovery; "
            f"{len(profile.catalog_urls)} official catalog seed(s)"
        ),
        priority=34,
    ))

    # Optional store-specific accelerators/enrichers. They may improve coverage
    # or branch-level stock, but an unknown store still has a complete plan.
    if context.store_slug == "darwin":
        plan.append(ConnectorChoice(
            name="darwin-catalog",
            connector=DarwinConnector(context),
            reason="optional store-specific paginated public HTML discovery + branch stock",
            priority=35,
        ))

    if context.store_slug == "maximum":
        plan.append(ConnectorChoice(
            name="maximum-catalog",
            connector=MaximumConnector(context),
            reason="optional store-specific category traversal with stable numeric product URLs",
            priority=35,
        ))

    if context.store_slug == "cactus":
        plan.append(ConnectorChoice(
            name="cactus-catalog",
            connector=CactusConnector(context),
            reason="optional store-specific catalogue discovery accelerator",
            priority=35,
        ))

    plan.append(ConnectorChoice(
        name="html-generic",
        connector=GenericHtmlConnector(context),
        reason="generic HTTP/HTML product-page parser fallback",
        priority=40,
    ))

    plan.append(ConnectorChoice(
        name="browser-rendered",
        connector=BrowserRenderedConnector(context),
        reason="last-resort JavaScript-rendered storefront fallback",
        priority=50,
    ))

    return sorted(plan, key=lambda item: item.priority)


def choose_connector(context: ConnectorContext, profile: SourceProfile) -> ConnectorChoice:
    return build_connector_plan(context, profile)[0]
