import unittest

from services.scraper.category_mapper import map_category


class CategoryMapperTests(unittest.TestCase):
    def test_headphones_under_telephony_are_audio_not_smartphones(self):
        slug, confidence = map_category(
            ["Телефония и гаджеты", "Портативное аудио", "Наушники беспроводные"],
            "Беспроводные наушники Motorola Moto Buds",
        )
        self.assertEqual(slug, "tv-audio")
        self.assertGreater(confidence, 0.0)

    def test_real_smartphone_still_maps_to_smartphones(self):
        slug, _ = map_category(["Телефония и гаджеты", "Смартфоны"], "Samsung Galaxy S25 256GB")
        self.assertEqual(slug, "smartphones")

    def test_hair_dryer_maps_to_beauty(self):
        slug, _ = map_category(["Техника для красоты и здоровья", "Фены"], "Фен Dyson Supersonic")
        self.assertEqual(slug, "beauty")

    def test_kitchen_hood_maps_to_home_appliances(self):
        slug, _ = map_category(["Крупная бытовая техника", "Вытяжки"], "Вытяжка кухонная")
        self.assertEqual(slug, "home-appliances")

    def test_pan_maps_to_home(self):
        slug, _ = map_category(["Товары для дома", "Посуда"], "Сковорода 28 см")
        self.assertEqual(slug, "home")

    def test_url_taxonomy_wins_over_ingredient_in_title(self):
        slug, confidence = map_category(
            ["pizza i patiserie congelate"],
            "Placinte cu carne de pui congelate",
        )
        self.assertEqual(slug, "food")
        self.assertGreaterEqual(confidence, 0.84)

    def test_grocery_url_categories_map_without_store_specific_rules(self):
        cases = [
            (["vin spumant"], "MOTIV Vin spumant rose", "drinks"),
            (["ingrijire corp"], "Spuma de dus Blooming Citrus", "beauty"),
            (["marinate"], "Ceafa de porc fara os", "meat"),
        ]
        for path, title, expected in cases:
            with self.subTest(path=path):
                slug, _ = map_category(path, title)
                self.assertEqual(slug, expected)

    def test_title_only_has_lower_confidence_than_taxonomy(self):
        _, title_confidence = map_category([], "Lapte UHT 3.5%")
        _, path_confidence = map_category(["lactate"], "Produs X")
        self.assertLess(title_confidence, path_confidence)


if __name__ == "__main__":
    unittest.main()
