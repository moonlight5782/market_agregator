import unittest

from services.scraper.source_discovery import (
    _extract_api_candidates,
    extract_catalog_urls,
)


class SourceDiscoveryTests(unittest.TestCase):
    def test_catalog_root_is_preferred_over_category(self):
        html = """
        <a href="/ro/catalog/paste">Paste</a>
        <a href="/ro/catalog">Supermarket online</a>
        <a href="/about">Despre noi</a>
        """
        urls = extract_catalog_urls("https://shop.md/ro", html)
        self.assertEqual(urls[0], "https://shop.md/ro/catalog")
        self.assertIn("https://shop.md/ro/catalog/paste", urls)
        self.assertNotIn("https://shop.md/about", urls)

    def test_romanian_katalog_route_is_detected(self):
        html = '<a href="/ru/katalog">Каталог товаров</a>'
        self.assertEqual(
            extract_catalog_urls("https://shop.md/", html),
            ["https://shop.md/ru/katalog"],
        )

    def test_cms_news_category_is_not_used_as_catalog_seed(self):
        html = '<a href="/ru/component/content/category/8-novosti">Catalog news</a>'
        self.assertEqual(extract_catalog_urls("https://shop.md/", html), [])

    def test_external_catalog_link_is_not_used_as_seed(self):
        html = '<a href="https://other.example/catalog">Catalog</a>'
        self.assertEqual(extract_catalog_urls("https://shop.md/", html), [])

    def test_localized_catalog_link_is_detected_from_text(self):
        html = '<a href="/ro/market">Supermarket online</a>'
        self.assertEqual(
            extract_catalog_urls("https://shop.md/", html),
            ["https://shop.md/ro/market"],
        )

    def test_first_party_fetch_api_candidate_is_detected(self):
        script = 'fetch("/api/v2/products?page=1").then(r => r.json())'
        self.assertEqual(
            _extract_api_candidates("https://shop.md/assets/app.js", script),
            {"https://shop.md/api/v2/products?page=1"},
        )

    def test_cross_origin_api_candidate_is_rejected(self):
        script = 'fetch("https://analytics.example/api/events")'
        self.assertEqual(
            _extract_api_candidates("https://shop.md/assets/app.js", script),
            set(),
        )


if __name__ == "__main__":
    unittest.main()
