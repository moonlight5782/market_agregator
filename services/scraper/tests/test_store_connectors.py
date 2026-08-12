import unittest

from services.scraper.connectors.maximum import MaximumConnector


class StoreConnectorPatternTests(unittest.TestCase):
    def test_maximum_numeric_product_urls(self):
        self.assertIsNotNone(MaximumConnector.product_path.match("/ru/6179705/"))
        self.assertIsNotNone(MaximumConnector.product_path.match("/ro/6179705/"))
        self.assertIsNone(MaximumConnector.product_path.match("/ru/telefoniya-i-gadjety/"))
        self.assertIsNone(MaximumConnector.product_path.match("/ru/article/sale/"))


if __name__ == "__main__":
    unittest.main()
