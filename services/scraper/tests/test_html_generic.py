import unittest

from services.scraper.connectors.html_generic import GenericHtmlConnector
from services.scraper.models import StockStatus


class GenericHtmlConnectorTests(unittest.TestCase):
    def test_quantity_parsing_multilingual(self):
        self.assertEqual(GenericHtmlConnector._quantity_from_text("Disponibilitate: 13"), 13)
        self.assertEqual(GenericHtmlConnector._quantity_from_text("Наличие: 4"), 4)
        self.assertEqual(GenericHtmlConnector._quantity_from_text("Availability 0"), 0)

    def test_stock_status_from_quantity(self):
        self.assertEqual(GenericHtmlConnector._stock_status("", 0), StockStatus.OUT_OF_STOCK)
        self.assertEqual(GenericHtmlConnector._stock_status("", 4), StockStatus.LOW_STOCK)
        self.assertEqual(GenericHtmlConnector._stock_status("", 10), StockStatus.LOW_STOCK)
        self.assertEqual(GenericHtmlConnector._stock_status("", 11), StockStatus.IN_STOCK)
        self.assertEqual(GenericHtmlConnector._stock_status("", 62), StockStatus.IN_STOCK)

    def test_stock_status_multilingual_negative_phrases(self):
        self.assertEqual(GenericHtmlConnector._stock_status("Товар не в наличии", None), StockStatus.OUT_OF_STOCK)
        self.assertEqual(GenericHtmlConnector._stock_status("Nu este disponibil", None), StockStatus.OUT_OF_STOCK)

    def test_sku_parsing_multilingual(self):
        self.assertEqual(GenericHtmlConnector._sku_from_text("Articol: 261288"), "261288")
        self.assertEqual(GenericHtmlConnector._sku_from_text("Артикул: 70507"), "70507")
        self.assertEqual(GenericHtmlConnector._sku_from_text("SKU ABC-12/34"), "ABC-12/34")
        self.assertEqual(GenericHtmlConnector._sku_from_text("Код товара: 179205"), "179205")
        self.assertEqual(GenericHtmlConnector._sku_from_text("Codul produsului: 111336"), "111336")


if __name__ == "__main__":
    unittest.main()
