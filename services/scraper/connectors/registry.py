from __future__ import annotations

from dataclasses import dataclass

from .base import ConnectorContext, StoreConnector
from .browser_generic import BrowserRenderedConnector
from .darwin import DarwinConnector
from .feed_generic import GenericFeedConnector
from .html_generic import GenericHtmlConnector
from .json_api import GenericJsonApiConnector
from .jsonld import SitemapJsonLdConnector
from ..source_discovery import SourceProfile


@dataclass(frozen=True)
class ConnectorChoice:
    name: str
    connector: StoreConnector
    reason: str
    priority: int


def build_connector_plan(context: ConnectorContext, profile: SourceProfile) -> list[ConnectorChoice]:
    """Return acquisition strategies in strict priority order.

    Structured public interfaces are preferred because they are faster, more complete
    and less fragile than HTML parsing. Lower-priority strategies remain available as
    fallbacks and can contribute products missed by earlier sources.
    """
    plan: list[ConnectorChoice] = []

    if profile.api_hints:
        plan.append(
            ConnectorChoice(
                name="json-api",
                connector=GenericJsonApiConnector(context, endpoints=profile.api_hints),
                reason=f"{len(profile.api_hints)} public API/JSON endpoint hint(s) detected",
                priority=10,
            )
        )

    if profile.feed_hints:
        plan.append(
            ConnectorChoice(
                name="catalog-feed",
                connector=GenericFeedConnector(context, feeds=profile.feed_hints),
                reason=f"{len(profile.feed_hints)} public JSON/XML/CSV/YML feed(s) detected",
                priority=20,
            )
        )

    if profile.sitemap_urls or profile.product_jsonld or profile.embedded_json:
        plan.append(
            ConnectorChoice(
                name="sitemap-jsonld",
                connector=SitemapJsonLdConnector(context),
                reason="sitemap/JSON-LD/embedded structured data detected",
                priority=30,
            )
        )

    if context.store_slug == "darwin":
        plan.append(
            ConnectorChoice(
                name="darwin-catalog",
                connector=DarwinConnector(context),
                reason="store-specific paginated public HTML catalog discovery",
                priority=35,
            )
        )

    plan.append(
        ConnectorChoice(
            name="html-generic",
            connector=GenericHtmlConnector(context),
            reason="generic HTTP/HTML parser fallback",
            priority=40,
        )
    )

    plan.append(
        ConnectorChoice(
            name="browser-rendered",
            connector=BrowserRenderedConnector(context),
            reason="last-resort JavaScript-rendered storefront fallback",
            priority=50,
        )
    )

    return sorted(plan, key=lambda item: item.priority)


def choose_connector(context: ConnectorContext, profile: SourceProfile) -> ConnectorChoice:
    """Backward-compatible helper; new code should use build_connector_plan()."""
    return build_connector_plan(context, profile)[0]
