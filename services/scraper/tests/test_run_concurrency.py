import unittest

from services.scraper.run import PRODUCT_FETCH_CONCURRENCY, _strategy_fetch_concurrency


class RunConcurrencyTests(unittest.TestCase):
    def test_http_strategies_use_bounded_concurrency(self):
        self.assertEqual(_strategy_fetch_concurrency("catalog-generic"), PRODUCT_FETCH_CONCURRENCY)
        self.assertGreater(PRODUCT_FETCH_CONCURRENCY, 1)

    def test_browser_strategy_is_single_flight(self):
        self.assertEqual(_strategy_fetch_concurrency("browser-rendered"), 1)


if __name__ == "__main__":
    unittest.main()
