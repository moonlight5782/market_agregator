import unittest

from services.scraper.catalog_estimate import parse_catalog_estimate


class CatalogEstimateTests(unittest.TestCase):
    def test_darwin_exact_count(self):
        result = parse_catalog_estimate("darwin", "Найдено товаров: 94 929", "https://darwin.md/ru/poisk")
        self.assertEqual(result.value, 94929)
        self.assertEqual(result.kind, "exact")

    def test_maximum_exact_count(self):
        result = parse_catalog_estimate("maximum", "Поиск среди 163 694 товаров", "https://maximum.md/ru/")
        self.assertEqual(result.value, 163694)
        self.assertEqual(result.kind, "exact")

    def test_supraten_lower_bound(self):
        result = parse_catalog_estimate("supraten", "Свыше 50 000 товаров!", "https://supraten.md/")
        self.assertEqual(result.value, 50000)
        self.assertEqual(result.kind, "lower-bound")

    def test_unknown_store_is_not_invented(self):
        result = parse_catalog_estimate("cactus", "Каталог", "https://www.cactus.md/ru/catalogue/")
        self.assertIsNone(result.value)
        self.assertEqual(result.kind, "unknown")


if __name__ == "__main__":
    unittest.main()
