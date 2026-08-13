import unittest

from services.scraper.run import (
    DEFAULT_BOUNDED_CRAWL_TIMEOUT_SECONDS,
    DEFAULT_BOUNDED_STRATEGY_TIMEOUT_SECONDS,
    PRODUCT_FETCH_CONCURRENCY,
    _strategy_fetch_concurrency,
    bounded_crawl_timeout_seconds,
    bounded_strategy_timeout_seconds,
)


class RunConcurrencyTests(unittest.TestCase):
    def test_http_strategies_use_bounded_concurrency(self):
        self.assertEqual(_strategy_fetch_concurrency("catalog-generic"), PRODUCT_FETCH_CONCURRENCY)
        self.assertGreater(PRODUCT_FETCH_CONCURRENCY, 1)

    def test_browser_strategy_is_single_flight(self):
        self.assertEqual(_strategy_fetch_concurrency("browser-rendered"), 1)

    def test_bounded_strategy_timeout_uses_a_safe_default_and_bounds(self):
        self.assertEqual(bounded_strategy_timeout_seconds(None), DEFAULT_BOUNDED_STRATEGY_TIMEOUT_SECONDS)
        self.assertEqual(bounded_strategy_timeout_seconds("invalid"), DEFAULT_BOUNDED_STRATEGY_TIMEOUT_SECONDS)
        self.assertEqual(bounded_strategy_timeout_seconds("1"), 5.0)
        self.assertEqual(bounded_strategy_timeout_seconds("1000"), 120.0)
        self.assertEqual(bounded_strategy_timeout_seconds("12.5"), 12.5)

    def test_bounded_crawl_timeout_uses_a_safe_default_and_bounds(self):
        self.assertEqual(bounded_crawl_timeout_seconds(None), DEFAULT_BOUNDED_CRAWL_TIMEOUT_SECONDS)
        self.assertEqual(bounded_crawl_timeout_seconds("invalid"), DEFAULT_BOUNDED_CRAWL_TIMEOUT_SECONDS)
        self.assertEqual(bounded_crawl_timeout_seconds("1"), 15.0)
        self.assertEqual(bounded_crawl_timeout_seconds("1000"), 300.0)
        self.assertEqual(bounded_crawl_timeout_seconds("75"), 75.0)


if __name__ == "__main__":
    unittest.main()
