from __future__ import annotations

from dataclasses import dataclass
from typing import Type

from .base import ConnectorContext, StoreConnector
from .html_generic import GenericHtmlConnector
from .jsonld import SitemapJsonLdConnector
from ..source_discovery import SourceProfile


@dataclass(frozen=True)
class ConnectorChoice:
    name: str
    connector: StoreConnector
    reason: str


def choose_connector(context: ConnectorContext, profile: SourceProfile) -> ConnectorChoice:
    if profile.sitemap_urls or profile.product_jsonld:
        return ConnectorChoice(
            name="sitemap-jsonld",
            connector=SitemapJsonLdConnector(context),
            reason="sitemap or Product JSON-LD detected",
        )
    return ConnectorChoice(
        name="html-generic",
        connector=GenericHtmlConnector(context),
        reason="fallback to common HTML product conventions",
    )
