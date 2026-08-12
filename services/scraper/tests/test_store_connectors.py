import unittest

from services.scraper.connectors.maximum import MaximumConnector


class StoreConnectorPatternTests(unittest.TestCase):
    def test_maximum_numeric_product_urls(self):
        self.assertIsNotNone(MaximumConnector.product_path.match("/ru/6179705/"))
        self.assertIsNotNone(MaximumConnector.product_path.match("/ro/6179705/"))
        self.assertIsNone(MaximumConnector.product_path.match("/ru/telefoniya-i-gadjety/"))
        self.assertIsNone(MaximumConnector.product_path.match("/ru/article/sale/"))

    def test_maximum_product_code_is_sku(self):
        self.assertEqual(MaximumConnector._sku_from_text("Код товара: 277770"), "277770")
        self.assertEqual(MaximumConnector._sku_from_text("Cod produs: 12345"), "12345")


if __name__ == "__main__":
    unittest.main()
