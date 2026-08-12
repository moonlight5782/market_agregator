import unittest

from bs4 import BeautifulSoup

from services.scraper.connectors.catalog_generic import GenericCatalogConnector


class GenericCatalogConnectorTests(unittest.TestCase):
    def _anchor(self, html: str):
        return BeautifulSoup(html, "lxml").select_one("a")

    def test_product_url_pattern_is_detected(self):
        anchor = self._anchor('<a href="/product/coffee-machine-123">Coffee machine</a>')
        self.assertTrue(GenericCatalogConnector._looks_like_product_anchor(anchor, "https://shop.md/product/coffee-machine-123"))

    def test_price_near_link_marks_product_card(self):
        soup = BeautifulSoup('<div class="card"><a href="/espresso-123">Espressor</a><span>4 999 MDL</span></div>', "lxml")
        anchor = soup.select_one("a")
        self.assertTrue(GenericCatalogConnector._looks_like_product_anchor(anchor, "https://shop.md/espresso-123"))

    def test_schema_product_marks_product_link(self):
        soup = BeautifulSoup('<article itemtype="https://schema.org/Product"><a href="/x123">Produs</a></article>', "lxml")
        anchor = soup.select_one("a")
        self.assertTrue(GenericCatalogConnector._looks_like_product_anchor(anchor, "https://shop.md/x123"))

    def test_catalog_links_are_enqueued(self):
        anchor = self._anchor('<a href="/catalogue/electronics">Electronice</a>')
        self.assertTrue(GenericCatalogConnector._looks_like_listing_link(anchor, "https://shop.md/catalogue/electronics"))

    def test_non_catalog_informational_link_is_not_enqueued(self):
        anchor = self._anchor('<a href="/about-us">Despre noi</a>')
        self.assertFalse(GenericCatalogConnector._looks_like_listing_link(anchor, "https://shop.md/about-us"))

    def test_cart_and_auth_links_are_skipped(self):
        self.assertTrue(GenericCatalogConnector._skip_href("/cart"))
        self.assertTrue(GenericCatalogConnector._skip_href("/account/login"))
        self.assertTrue(GenericCatalogConnector._skip_href("mailto:test@example.com"))


if __name__ == "__main__":
    unittest.main()
