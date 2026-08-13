import unittest

from services.scraper.quality import browser_enrichment_reasons, compute_quality, merge_product_payload, publish_readiness


class QualityTests(unittest.TestCase):
    def test_repeated_images_and_unknown_stock_trigger_browser_enrichment(self) -> None:
        payloads = [
            {
                "price": "10.00",
                "stock_status": "UNKNOWN",
                "image_url": "https://shop.example/static/default.webp",
                "category_slug": "food" if index < 2 else None,
                "sku": f"SKU-{index}",
                "availabilities": [],
            }
            for index in range(5)
        ]

        quality = compute_quality(payloads, limit=5)
        reasons = browser_enrichment_reasons(quality)

        self.assertEqual(quality["known_stock_pct"], 0.0)
        self.assertEqual(quality["distinct_image_pct"], 20.0)
        self.assertEqual(quality["max_image_reuse_pct"], 100.0)
        self.assertTrue(any(reason.startswith("known_stock=") for reason in reasons))
        self.assertTrue(any(reason.startswith("category=") for reason in reasons))
        self.assertTrue(any(reason.startswith("image_reuse=") for reason in reasons))

    def test_good_quality_does_not_trigger_browser_enrichment(self) -> None:
        payloads = [
            {
                "price": "10.00",
                "stock_status": "IN_STOCK",
                "image_url": f"https://shop.example/media/{index}.webp",
                "category_slug": "food",
                "sku": f"SKU-{index}",
                "availabilities": [],
            }
            for index in range(5)
        ]

        quality = compute_quality(payloads, limit=5)
        self.assertEqual(browser_enrichment_reasons(quality), [])

    def test_merge_keeps_price_but_fills_browser_quality_fields(self) -> None:
        existing = {
            "price": "49.90",
            "stock_status": "UNKNOWN",
            "quantity": None,
            "image_url": "https://shop.example/static/default.webp",
            "category_slug": None,
            "category_confidence": 0.0,
            "sku": "ABC-123",
            "attributes": {"source": "html-generic"},
            "data_quality": 0.7,
        }
        candidate = {
            "price": "51.00",
            "stock_status": "LOW_STOCK",
            "quantity": 7,
            "image_url": "https://shop.example/media/product.webp",
            "category_slug": "drinks",
            "category_confidence": 0.9,
            "category_path": ["bauturi"],
            "description": "Rendered product description",
            "attributes": {"source": "browser-rendered"},
            "source_connector": "browser-rendered",
            "data_quality": 0.8,
        }

        merged, changed = merge_product_payload(existing, candidate, replace_suspicious_image=True)

        self.assertTrue(changed)
        self.assertEqual(merged["price"], "49.90")
        self.assertEqual(merged["stock_status"], "LOW_STOCK")
        self.assertEqual(merged["quantity"], 7)
        self.assertEqual(merged["image_url"], "https://shop.example/media/product.webp")
        self.assertEqual(merged["category_slug"], "drinks")
        self.assertEqual(merged["description"], "Rendered product description")
        self.assertEqual(merged["enriched_by"], ["browser-rendered"])

    def complete_quality(self):
        return {
            "unique_products": 10,
            "price_complete_pct": 100.0,
            "category_complete_pct": 100.0,
            "identity_complete_pct": 100.0,
            "known_stock_pct": 100.0,
            "image_complete_pct": 100.0,
            "max_image_reuse_pct": 10.0,
        }

    def test_full_quality_requires_verified_coverage(self) -> None:
        result = publish_readiness(self.complete_quality(), coverage_verified=False)
        self.assertFalse(result["ready"])
        self.assertIn("catalog_coverage_unverified", result["blockers"])

    def test_unknown_stock_blocks_publication(self) -> None:
        quality = self.complete_quality()
        quality["known_stock_pct"] = 90.0
        result = publish_readiness(quality, coverage_verified=True)
        self.assertFalse(result["ready"])
        self.assertTrue(any(item.startswith("known_stock_pct=90.0%") for item in result["blockers"]))

    def test_complete_verified_catalog_is_ready(self) -> None:
        result = publish_readiness(self.complete_quality(), coverage_verified=True)
        self.assertTrue(result["ready"])
        self.assertEqual(result["blockers"], [])

    def test_uncapped_quality_has_no_fake_target_fill(self) -> None:
        payload = {
            "price": "1.00",
            "stock_status": "IN_STOCK",
            "image_url": "https://example.test/a.webp",
            "category_slug": "food",
            "sku": "ABC",
            "availabilities": [],
            "attributes": {},
        }
        quality = compute_quality([payload], 0)
        self.assertIsNone(quality["target_fill_pct"])


if __name__ == "__main__":
    unittest.main()
