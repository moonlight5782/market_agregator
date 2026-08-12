from __future__ import annotations

from dataclasses import dataclass

from .base import ConnectorContext, StoreConnector
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

    Prefer structured public interfaces because they are faster, more complete and less
    fragile than HTML parsing. Fall back progressively when a higher-quality source does
    not produce usable products.
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

    if profile.sitemap_urls or profile.product_jsonld or profile.embedded_json:
        plan.append(
            ConnectorChoice(
                name="sitemap-jsonld",
                connector=SitemapJsonLdConnector(context),
                reason="sitemap/JSON-LD/embedded structured data detected",
                priority=20,
            )
        )

    plan.append(
        ConnectorChoice(
            name="html-generic",
            connector=GenericHtmlConnector(context),
            reason="generic HTML parser fallback",
            priority=30,
        )
    )

    return plan


def choose_connector(context: ConnectorContext, profile: SourceProfile) -> ConnectorChoice:
    """Backward-compatible helper; new code should use build_connector_plan()."""
    return build_connector_plan(context, profile)[0]
