import unittest

from bs4 import BeautifulSoup

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

    def test_price_parser_deduplicates_repeated_current_price_label(self):
        self.assertEqual(str(GenericHtmlConnector._decimal("129 900 129 900 EUR")), "129900")
        self.assertEqual(str(GenericHtmlConnector._decimal("1 299,90 MDL")), "1299.90")
        self.assertEqual(
            str(GenericHtmlConnector._decimal("Цена со скидкой: 1299,00 MDL 1299,00 MDL")),
            "1299.00",
        )

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

    def test_url_category_path_is_store_agnostic(self):
        path = GenericHtmlConnector._category_path_from_url(
            "https://shop.example/ro/catalog/pizza_i_patiserie_congelate/product_slug?ref=home"
        )
        self.assertEqual(path, ["pizza i patiserie congelate"])

    def test_lazy_product_image_wins_over_placeholder_src(self):
        soup = BeautifulSoup(
            '<main><div class="product-image"><img src="/img/placeholder.png" data-src="/products/real-coffee.jpg"></div></main>',
            "lxml",
        )
        self.assertEqual(
            GenericHtmlConnector._extract_product_image(soup, "https://shop.example/product/coffee"),
            "https://shop.example/products/real-coffee.jpg",
        )

    def test_social_placeholder_is_not_treated_as_product_image(self):
        soup = BeautifulSoup(
            '<html><head><meta property="og:image" content="/public/thumbs/version_500x300xog500x300x1/site.jpg"></head></html>',
            "lxml",
        )
        self.assertIsNone(GenericHtmlConnector._extract_product_image(soup, "https://shop.example/product/coffee"))


if __name__ == "__main__":
    unittest.main()
