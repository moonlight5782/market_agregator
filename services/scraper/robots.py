from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

BOT_USER_AGENT = "MoldovaCommerceBot"


@dataclass(frozen=True)
class RobotsPolicy:
    """Robots permission evidence for one store origin.

    A missing robots file allows crawling, while an unavailable, rejected, or
    malformed policy fails closed. This avoids treating a transient access
    control error as permission to expand a crawl.
    """

    origin: str
    robots_url: str
    status: str
    reason: str | None
    parser: RobotFileParser | None = None

    @property
    def base_allowed(self) -> bool:
        return self.can_fetch(self.origin)

    def can_fetch(self, url: str) -> bool:
        candidate = urlparse(url)
        origin = urlparse(self.origin)
        if candidate.scheme not in {"http", "https"} or candidate.netloc.lower() != origin.netloc.lower():
            return False
        if self.status == "MISSING":
            return True
        if self.status != "AVAILABLE" or self.parser is None:
            return False
        return self.parser.can_fetch(BOT_USER_AGENT, url)


def policy_from_text(base_url: str, robots_text: str, robots_url: str | None = None) -> RobotsPolicy:
    origin = f"{urlparse(base_url).scheme}://{urlparse(base_url).netloc}"
    location = robots_url or urljoin(origin, "/robots.txt")
    parser = RobotFileParser()
    parser.set_url(location)
    parser.parse(robots_text.splitlines())
    if not parser.can_fetch(BOT_USER_AGENT, origin):
        return RobotsPolicy(origin, location, "DISALLOWED", "robots.txt disallows the crawler at the store root", parser)
    return RobotsPolicy(origin, location, "AVAILABLE", None, parser)


async def load_robots_policy(
    client: httpx.AsyncClient,
    base_url: str,
    timeout_seconds: float,
) -> RobotsPolicy:
    origin = f"{urlparse(base_url).scheme}://{urlparse(base_url).netloc}"
    robots_url = urljoin(origin, "/robots.txt")
    try:
        response = await client.get(robots_url, timeout=timeout_seconds)
    except httpx.HTTPError as error:
        return RobotsPolicy(origin, robots_url, "UNAVAILABLE", f"robots.txt request failed: {type(error).__name__}")

    if response.status_code == 404:
        return RobotsPolicy(origin, str(response.url), "MISSING", None)
    if not response.is_success:
        return RobotsPolicy(origin, str(response.url), "UNAVAILABLE", f"robots.txt returned HTTP {response.status_code}")
    return policy_from_text(origin, response.text, str(response.url))
