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


if __name__ == "__main__":
    unittest.main()
