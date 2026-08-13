import asyncio
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from services.scraper.connectors.base import ConnectorContext, StoreConnector
from services.scraper.robots import RobotsPolicy, policy_from_text
from services.scraper.source_discovery import discover_sources


class DummyConnector(StoreConnector):
    async def discover_product_urls(self):
        if False:
            yield ""

    async def fetch_product(self, url):
        del url
        return None


class DisallowAllHandler(BaseHTTPRequestHandler):
    paths: list[str] = []

    def do_GET(self):  # noqa: N802 - required by BaseHTTPRequestHandler
        type(self).paths.append(self.path)
        if self.path == "/robots.txt":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"User-agent: *" + bytes([10]) + b"Disallow: /" + bytes([10]))
            return
        self.send_response(500)
        self.end_headers()

    def log_message(self, format, *args):
        del format, args


class RobotsPolicyTests(unittest.TestCase):
    def test_allows_catalog_and_blocks_declared_path(self):
        policy = policy_from_text(
            "https://shop.example",
            "User-agent: MoldovaCommerceBot\nDisallow: /account\nDisallow: /checkout\n",
        )
        self.assertEqual(policy.status, "AVAILABLE")
        self.assertTrue(policy.base_allowed)
        self.assertTrue(policy.can_fetch("https://shop.example/catalog/phones"))
        self.assertFalse(policy.can_fetch("https://shop.example/account/orders"))
        self.assertFalse(policy.can_fetch("https://other.example/catalog"))

    def test_root_disallow_blocks_the_crawl(self):
        policy = policy_from_text("https://shop.example", "User-agent: *\nDisallow: /\n")
        self.assertEqual(policy.status, "DISALLOWED")
        self.assertFalse(policy.base_allowed)
        self.assertFalse(policy.can_fetch("https://shop.example/catalog"))

    def test_missing_robots_allows_same_origin_but_never_cross_origin(self):
        policy = RobotsPolicy(
            origin="https://shop.example",
            robots_url="https://shop.example/robots.txt",
            status="MISSING",
            reason=None,
        )
        self.assertTrue(policy.can_fetch("https://shop.example/product/1"))
        self.assertFalse(policy.can_fetch("https://cdn.example/image.jpg"))

    def test_shared_connector_gate_uses_the_policy(self):
        policy = policy_from_text("https://shop.example", "User-agent: *\nDisallow: /private\n")
        connector = DummyConnector(ConnectorContext(store_slug="shop", base_url="https://shop.example", robots_policy=policy))
        self.assertTrue(connector.is_url_allowed("https://shop.example/catalog"))
        self.assertFalse(connector.is_url_allowed("https://shop.example/private/feed"))

    def test_discovery_does_not_fetch_a_disallowed_store_root(self):
        DisallowAllHandler.paths = []
        server = ThreadingHTTPServer(("127.0.0.1", 0), DisallowAllHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base_url = f"http://127.0.0.1:{server.server_port}"
            profile = asyncio.run(discover_sources(base_url, timeout_seconds=2))
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

        self.assertTrue(profile.blocked)
        self.assertEqual(profile.robots_status, "DISALLOWED")
        self.assertEqual(DisallowAllHandler.paths, ["/robots.txt"])


if __name__ == "__main__":
    unittest.main()
