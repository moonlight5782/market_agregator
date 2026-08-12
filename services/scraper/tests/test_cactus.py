import unittest

from bs4 import BeautifulSoup

from services.scraper.connectors.cactus import CactusConnector


class CactusConnectorTests(unittest.TestCase):
    def test_product_card_link_detected_by_nearby_price(self):
        soup = BeautifulSoup(
            '<div class="card"><a href="/ru/catalogue/electronice/telefone/mobilnye-telefony/iphone-17/">Apple iPhone 17</a><span>17 899 лей</span></div>',
            "lxml",
        )
        anchor = soup.select_one("a")
        self.assertTrue(CactusConnector._looks_like_product_anchor(anchor, anchor["href"]))

    def test_deep_category_without_price_is_not_product(self):
        soup = BeautifulSoup(
            '<nav><a href="/ru/catalogue/bytovaya-tehnika/tehnika-dlya-doma/pylesosy/">Пылесосы</a></nav>',
            "lxml",
        )
        anchor = soup.select_one("a")
        self.assertFalse(CactusConnector._looks_like_product_anchor(anchor, anchor["href"]))


if __name__ == "__main__":
    unittest.main()
