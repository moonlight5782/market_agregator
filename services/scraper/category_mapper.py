from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class CategoryRule:
    slug: str
    keywords: tuple[str, ...]


# Rules deliberately prefer product-type words over broad department names.
# Example: "Телефония и гаджеты > Наушники" must not become smartphones merely
# because the parent department contains the substring "телефон".
RULES: tuple[CategoryRule, ...] = (
    CategoryRule("smartphones", ("smartphone", "смартфон", "iphone", "galaxy", "telefon inteligent")),
    CategoryRule("laptops", ("laptop", "notebook", "ноутбук")),
    CategoryRule("computers", ("computer", "desktop", "pc", "calculator", "компьютер")),
    CategoryRule("tv-audio", ("televizor", "television", "tv", "audio", "speaker", "casti", "headphone", "earphone", "телевизор", "аудио", "наушник")),
    CategoryRule("home-appliances", (
        "electrocasnic", "frigider", "masina de spalat", "aspirator", "hota", "climat", "aer conditionat",
        "холодильник", "стиральн", "пылесос", "вытяжк", "климатическ", "мойка воздуха", "кондиционер",
    )),
    CategoryRule("beauty", (
        "cosmetic", "parfum", "sampon", "beauty", "tehnica pentru frumusete", "uscator de par", "placa de par",
        "космет", "парфюм", "шампун", "техника для красоты", "фен", "выпрямител", "стайлер", "эпилятор",
    )),
    CategoryRule("furniture", ("mobila", "mobilier", "sofa", "pat", "шкаф", "диван", "мебель")),
    CategoryRule("lighting", ("iluminat", "lampa", "bec", "led", "освещ", "лампа", "лампочка")),
    CategoryRule("building-materials", ("materiale de construct", "ciment", "adeziv", "gips", "цемент", "стройматериал", "гипс")),
    CategoryRule("tools", ("unelte", "scule", "bormasina", "masina de gaurit", "инструмент", "дрель", "шуруповерт")),
    CategoryRule("electrical", ("electric", "intrerupator", "priza", "cablu", "розетка", "выключатель", "кабель")),
    CategoryRule("ventilation", ("ventilator", "ventilatie", "вентилятор", "вентиляц")),
    CategoryRule("plumbing", ("sanitar", "robinet", "baterie", "wc", " сантех", "смеситель", "унитаз")),
    CategoryRule("dairy", ("lactate", "lapte", "iaurt", "branza", "молоко", "йогурт", "сыр")),
    CategoryRule("meat", ("carne", "mezel", "salam", "мясо", "колбас")),
    CategoryRule("fruit-vegetables", ("fruct", "legum", "mere", "rosii", "фрукт", "овощ", "яблок", "помидор")),
    CategoryRule("drinks", ("bautur", "apa", "suc", "cafea", "ceai", "напит", "вода", "сок", "кофе", "чай")),
    CategoryRule("kids", ("copii", "jucarie", "carucior", "детск", "игруш", "коляск")),
    CategoryRule("sport", ("sport", "fitness", "biciclet", "туризм", "фитнес", "велосипед")),
    CategoryRule("auto", ("auto", "anvelop", "ulei motor", "masina", "шина", "автомоб", "масло мотор")),
    CategoryRule("pets", ("animale", "pet", "hrana caini", "hrana pisici", "корм", "зоотовар")),
    CategoryRule("garden", ("gradina", "garden", "seminte", "полив", "сад", "семена")),
    CategoryRule("office", ("birou", "papetarie", "office", "канцел", "офис")),
    CategoryRule("books-hobby", ("carte", "carti", "hobby", "puzzle", "книга", "хобби", "пазл")),
    CategoryRule("fashion", ("imbracaminte", "incaltaminte", "haine", "fashion", "одежд", "обув")),
    CategoryRule("home", ("vesela", "tigaie", "sticla pentru apa", "посуда", "сковород", "бутылк", "товары для дома")),
)


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().replace("ș", "s").replace("ş", "s").replace("ț", "t").replace("ţ", "t")).strip()


def map_category(category_path: list[str], title: str = "") -> tuple[str | None, float]:
    haystack = _normalize(" ".join(category_path + [title]))
    best_slug: str | None = None
    best_hits = 0
    for rule in RULES:
        hits = sum(1 for keyword in rule.keywords if _normalize(keyword) in haystack)
        if hits > best_hits:
            best_slug, best_hits = rule.slug, hits
    if not best_slug:
        return None, 0.0
    confidence = min(0.98, 0.70 + 0.08 * best_hits)
    return best_slug, round(confidence, 2)
