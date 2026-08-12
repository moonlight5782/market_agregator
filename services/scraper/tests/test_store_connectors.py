import unittest
from decimal import Decimal

from bs4 import BeautifulSoup

from services.scraper.connectors.base import ConnectorContext
from services.scraper.connectors.darwin import DarwinConnector
from services.scraper.connectors.maximum import MaximumConnector
from services.scraper.models import RawProduct, StockStatus


class StoreConnectorPatternTests(unittest.TestCase):
    def test_maximum_numeric_product_urls(self):
        self.assertIsNotNone(MaximumConnector.product_path.match("/ru/6179705/"))
        self.assertIsNotNone(MaximumConnector.product_path.match("/ro/6179705/"))
        self.assertIsNone(MaximumConnector.product_path.match("/ru/telefoniya-i-gadjety/"))
        self.assertIsNone(MaximumConnector.product_path.match("/ru/article/sale/"))

    def test_darwin_branch_stock_is_not_collapsed_to_page_text(self):
        connector = DarwinConnector(ConnectorContext(store_slug="darwin", base_url="https://darwin.md"))
        product = RawProduct(
            store_slug="darwin",
            external_id="test-product",
            title="Test Product",
            price=Decimal("100"),
            url="https://darwin.md/test-product.html",
            stock_status=StockStatus.OUT_OF_STOCK,
        )
        text = (
            "Disponibilitate Stoc disponibil Alege oraș "
            "Chișinău - cc Shopping Malldova, str. Arborilor 21 În stoc Sună Harta "
            "Bălți - str. Stefan cel Mare 37 În stoc Sună Harta "
            "Orhei - str. Vasile Lupu 37/3 Stoc epuizat Sună Harta"
        )
        enriched = connector.enrich_product(product, BeautifulSoup("<html></html>", "lxml"), text)

        self.assertEqual(len(enriched.availabilities), 3)
        self.assertEqual(enriched.stock_status, StockStatus.IN_STOCK)
        self.assertEqual(enriched.availabilities[0].city, "Chișinău")
        self.assertEqual(enriched.availabilities[0].stock_status, StockStatus.IN_STOCK)
        self.assertEqual(enriched.availabilities[2].city, "Orhei")
        self.assertEqual(enriched.availabilities[2].stock_status, StockStatus.OUT_OF_STOCK)


if __name__ == "__main__":
    unittest.main()
