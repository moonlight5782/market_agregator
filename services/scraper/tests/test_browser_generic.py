import unittest

from services.scraper.connectors.base import ConnectorContext
from services.scraper.connectors.browser_generic import BrowserRenderedConnector
from services.scraper.models import StockStatus


class BrowserRenderedConnectorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.connector = BrowserRenderedConnector(
            ConnectorContext(store_slug="generic", base_url="https://shop.example")
        )

    def test_rendered_parser_reuses_generic_quality_extractors(self) -> None:
        html = """
        <html><body>
          <main>
            <h1>Produs test 500 ml</h1>
            <div class="price">49,90 MDL</div>
            <div class="description">Descriere produs</div>
            <div>Codul produsului: ABC-123</div>
            <div>În stoc: 7 buc</div>
            <div class="product-image"><img src="/placeholder.svg" data-src="/media/produs.webp"></div>
          </main>
        </body></html>
        """

        product = self.connector._parse_rendered_product(
            "https://shop.example/ro/catalog/bauturi/produs-test",
            html,
        )

        self.assertIsNotNone(product)
        assert product is not None
        self.assertEqual(product.sku, "ABC-123")
        self.assertEqual(product.external_id, "ABC-123")
        self.assertEqual(product.quantity, 7)
        self.assertEqual(product.stock_status, StockStatus.LOW_STOCK)
        self.assertEqual(str(product.image_url), "https://shop.example/media/produs.webp")
        self.assertEqual(product.category_path, ["bauturi"])
        self.assertEqual(product.description, "Descriere produs")

    def test_zero_quantity_is_out_of_stock(self) -> None:
        html = """
        <html><body><main>
          <h1>Produs indisponibil</h1>
          <div class="price">10 MDL</div>
          <div>Disponibilitate: 0</div>
        </main></body></html>
        """

        product = self.connector._parse_rendered_product(
            "https://shop.example/catalog/test/produs",
            html,
        )

        self.assertIsNotNone(product)
        assert product is not None
        self.assertEqual(product.quantity, 0)
        self.assertEqual(product.stock_status, StockStatus.OUT_OF_STOCK)


if __name__ == "__main__":
    unittest.main()
