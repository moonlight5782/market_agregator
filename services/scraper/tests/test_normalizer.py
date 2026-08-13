from decimal import Decimal
import unittest

from services.scraper.models import RawProduct
from services.scraper.normalizer import is_non_product_service


class NormalizerTests(unittest.TestCase):
    def _raw(self, title: str) -> RawProduct:
        return RawProduct(
            store_slug="test-store",
            external_id="item-1",
            title=title,
            price=Decimal("99.00"),
            url="https://shop.example/product/item-1",
        )

    def test_clearly_named_individual_course_service_is_excluded(self):
        self.assertTrue(is_non_product_service(self._raw("Составление индивидуального курса препаратов")))

    def test_physical_supplement_is_not_excluded(self):
        self.assertFalse(is_non_product_service(self._raw("California Gold Creatine 454 g")))


if __name__ == "__main__":
    unittest.main()
