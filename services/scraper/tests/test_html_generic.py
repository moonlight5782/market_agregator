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
        cases = {
            "Articol: 261288": "261288",
            "Артикул: 70507": "70507",
            "SKU ABC-12/34": "ABC-12/34",
            "Код товара: 179205": "179205",
            "Cod produs: 9911": "9911",
            "Cod produsului: MD-77": "MD-77",
            "Codul produs: 55331": "55331",
            "Codul produsului: 111336": "111336",
        }
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertEqual(GenericHtmlConnector._sku_from_text(text), expected)

    def test_sku_does_not_capture_label_suffix(self):
        self.assertNotEqual(GenericHtmlConnector._sku_from_text("Codul produsului: 111336"), "ului")


if __name__ == "__main__":
    unittest.main()
