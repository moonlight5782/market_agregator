import unittest

from services.scraper.connectors.base import ConnectorContext
from services.scraper.connectors.browser_generic import BrowserRenderedConnector
from services.scraper.connectors.json_api import GenericJsonApiConnector
from services.scraper.models import RawProduct, StockStatus
from services.scraper.quality import compute_quality


class GenericJsonProductParserTests(unittest.TestCase):
    def setUp(self) -> None:
        self.context = ConnectorContext(store_slug="generic", base_url="https://shop.example")

    def test_nested_price_and_numeric_stock_are_normalized(self) -> None:
        parser = GenericJsonApiConnector(self.context)
        product = parser.product_from_item(
            {
                "id": 123,
                "name": "Lapte 1L",
                "price": {"amount": "24.50", "currency": "MDL"},
                "stock": 6,
                "images": [{"url": "/media/lapte.webp"}],
                "category": {"name": "Lactate"},
                "url": "/catalog/lactate/lapte-1l",
            },
            "https://shop.example/api/product/123",
        )

        self.assertIsNotNone(product)
        assert product is not None
        self.assertEqual(str(product.price), "24.50")
        self.assertEqual(product.quantity, 6)
        self.assertEqual(product.stock_status, StockStatus.LOW_STOCK)
        self.assertEqual(str(product.image_url), "https://shop.example/media/lapte.webp")
        self.assertEqual(product.category_path, ["Lactate"])


class BrowserNetworkEnrichmentTests(unittest.TestCase):
    def setUp(self) -> None:
        self.connector = BrowserRenderedConnector(
            ConnectorContext(store_slug="generic", base_url="https://shop.example")
        )
        self.dom = RawProduct(
            store_slug="generic",
            external_id="2010156",
            title="COSMEPLANT Spuma de dus Blooming Citrus 500ml",
            sku="2010156",
            price="76.50",
            stock_status=StockStatus.UNKNOWN,
            url="https://shop.example/ro/catalog/ingrijire-corp/cosmeplant-spuma",
            image_url="https://shop.example/static/default.webp",
            attributes={"source": "browser-rendered"},
        )

    def test_selects_matching_network_product_and_enriches_dom(self) -> None:
        payloads = [
            (
                "https://shop.example/api/catalog",
                {
                    "products": [
                        {"id": "999", "name": "Alt produs", "price": 10, "stock": 50},
                        {
                            "id": "2010156",
                            "sku": "2010156",
                            "name": "COSMEPLANT Spuma de dus Blooming Citrus 500ml",
                            "price": 76.5,
                            "stock": 4,
                            "image": "/media/cosmeplant.webp",
                            "category": "Ingrijire corp",
                            "url": "/ro/catalog/ingrijire-corp/cosmeplant-spuma",
                        },
                    ]
                },
            )
        ]

        network = self.connector._network_product(str(self.dom.url), self.dom, payloads)
        self.assertIsNotNone(network)
        assert network is not None
        merged = self.connector._merge_network_product(self.dom, network, observed_json_responses=3)

        self.assertEqual(merged.quantity, 4)
        self.assertEqual(merged.stock_status, StockStatus.LOW_STOCK)
        self.assertEqual(str(merged.image_url), "https://shop.example/media/cosmeplant.webp")
        self.assertTrue(merged.attributes["network_json_enriched"])
        self.assertEqual(merged.attributes["network_json_responses"], 3)
        self.assertTrue(merged.attributes["network_json_product_match"])

        quality = compute_quality([merged.model_dump(mode="json")], limit=1)
        self.assertEqual(quality["network_json_observed_product_pct"], 100.0)
        self.assertEqual(quality["network_json_matched_product_pct"], 100.0)
        self.assertEqual(quality["network_json_response_count"], 3)

    def test_rejects_unrelated_network_products_but_records_observation(self) -> None:
        payloads = [
            (
                "https://shop.example/api/recommendations",
                {"products": [{"id": "999", "name": "Complet diferit", "price": 10, "stock": 3}]},
            )
        ]
        network = self.connector._network_product(str(self.dom.url), self.dom, payloads)
        self.assertIsNone(network)
        merged = self.connector._merge_network_product(self.dom, network, observed_json_responses=1)
        self.assertEqual(merged.attributes["network_json_responses"], 1)
        self.assertFalse(merged.attributes["network_json_product_match"])


if __name__ == "__main__":
    unittest.main()
