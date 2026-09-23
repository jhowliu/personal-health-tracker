"""Seed the built-in food library.

Demo figures, not sourced nutrition data — `source` is set to 'user' so the row can be
overwritten id-for-id once AFCD/TFDA numbers are pulled in. Re-runnable: rows are keyed
by id and updated in place.

Watch the `state` column: brown rice raw and cooked differ by nearly 3x in calories per
100 g, so every food says which one it is.
"""

import asyncio
import sys

from app.db import get_conn

# id, category, zh-TW name, state, kcal, protein, fat, carb, unit, g/unit, usual, max
FOODS: list[tuple] = [
    # ---- staples -------------------------------------------------------------
    ("brown-rice-cooked", "staple", "糙米飯(熟)", "cooked", 110, 2.5, 0.9, 23, "g", None, 120, 250),
    ("white-rice-cooked", "staple", "白飯(熟)", "cooked", 130, 2.4, 0.3, 28, "g", None, 120, 250),
    ("oats-raw", "staple", "燕麥片(生)", "raw", 380, 13, 7, 66, "g", None, 30, 80),
    ("rice-cake", "staple", "年糕", "na", 220, 4, 0.5, 48, "g", None, 40, 120),
    ("sweet-potato-cooked", "staple", "地瓜(熟)", "cooked", 120, 1.6, 0.2, 28, "g", None, 150, 300),
    ("toast", "staple", "吐司", "na", 280, 9, 4, 50, "piece", 30, 60, 120),
    # ---- protein -------------------------------------------------------------
    ("chicken-breast-cooked", "protein", "雞胸肉(熟)", "cooked", 165, 31, 3.6, 0, "g", None, 100, 200),
    ("chicken-thigh-skin-on-cooked", "protein", "去骨雞腿(帶皮、熟)", "cooked", 210, 24, 13, 0, "g", None, 100, 200),
    ("pork-collar-cooked", "protein", "梅花豬(熟)", "cooked", 250, 25, 17, 0, "g", None, 80, 180),
    ("pork-belly-slices", "protein", "豬五花肉片", "cooked", 370, 14, 35, 0, "g", None, 100, 180),
    ("egg", "protein", "雞蛋", "na", 156, 12, 10, 1, "piece", 50, 50, 150),
    ("firm-tofu", "protein", "板豆腐", "na", 70, 8, 4, 2, "g", None, 150, 300),
    ("whey-protein", "protein", "乳清蛋白", "na", 400, 80, 6.7, 6.7, "scoop", 30, 30, 60),
    ("soy-milk-unsweetened", "protein", "無糖豆漿", "na", 39, 3.2, 2, 2.4, "ml", 1.03, 250, 500),
    ("salmon-cooked", "protein", "鮭魚(熟)", "cooked", 200, 22, 12, 0, "g", None, 120, 220),
    ("shredded-chicken", "protein", "雞絲", "cooked", 150, 28, 4, 0, "g", None, 100, 200),
    # ---- vegetables ----------------------------------------------------------
    ("broccoli-cooked", "vegetable", "花椰菜(熟)", "cooked", 25, 3, 0.4, 5, "g", None, 150, 300),
    ("zucchini-cooked", "vegetable", "節瓜(熟)", "cooked", 15, 1.2, 0.2, 3, "g", None, 100, 250),
    ("carrot-cooked", "vegetable", "紅蘿蔔(熟)", "cooked", 40, 0.9, 0.2, 9, "g", None, 50, 150),
    ("tomato", "vegetable", "番茄", "na", 18, 0.9, 0.2, 3.9, "g", None, 100, 250),
    ("enoki-mushroom", "vegetable", "金針菇", "cooked", 38, 2.7, 0.3, 7, "g", None, 50, 150),
    ("napa-cabbage-cooked", "vegetable", "大白菜(熟)", "cooked", 14, 1.1, 0.1, 2.5, "g", None, 200, 400),
    ("spinach-cooked", "vegetable", "菠菜(熟)", "cooked", 23, 3, 0.4, 3.6, "g", None, 150, 300),
    # ---- fruit ---------------------------------------------------------------
    ("banana", "fruit", "香蕉", "na", 89, 1.1, 0.3, 23, "piece", 100, 100, 200),
    ("apple", "fruit", "蘋果", "na", 52, 0.3, 0.2, 14, "piece", 180, 180, 360),
    ("guava", "fruit", "芭樂", "na", 38, 1.1, 0.2, 10, "g", None, 150, 300),
    # ---- fats and sauces -----------------------------------------------------
    ("sesame-dressing", "fat_sauce", "胡麻醬", "na", 550, 6, 52, 14, "g", None, 15, 30),
    ("olive-oil", "fat_sauce", "橄欖油", "na", 884, 0, 100, 0, "g", None, 10, 20),
    ("peanut-butter", "fat_sauce", "花生醬", "na", 590, 25, 50, 20, "g", None, 15, 40),
    ("soy-sauce", "fat_sauce", "醬油", "na", 60, 6, 0, 8, "ml", 1.1, 10, 30),
]

# Search synonyms — not translations. These are what people actually type.
ALIASES: dict[str, tuple[str, ...]] = {
    "chicken-thigh-skin-on-cooked": ("雞腿", "乾煎雞腿", "chicken thigh"),
    "chicken-breast-cooked": ("雞胸", "chicken breast"),
    "brown-rice-cooked": ("糙米", "brown rice"),
    "white-rice-cooked": ("白米", "飯", "rice"),
    "soy-milk-unsweetened": ("豆漿", "soy milk"),
    "whey-protein": ("乳清", "高蛋白", "whey"),
    "firm-tofu": ("豆腐", "tofu"),
    "egg": ("蛋", "水煮蛋", "egg"),
    "broccoli-cooked": ("花椰", "青花菜", "broccoli"),
    "pork-belly-slices": ("五花肉", "pork belly"),
}


async def seed() -> int:
    async with get_conn() as conn:
        await conn.executemany(
            """
            INSERT INTO foods (
                id, category_id, name, state,
                kcal_per_100g, protein_per_100g, fat_per_100g, carb_per_100g,
                unit, grams_per_unit, usual_grams, max_grams, source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'user')
            ON CONFLICT (id) DO UPDATE SET
                category_id = excluded.category_id,
                name = excluded.name,
                state = excluded.state,
                kcal_per_100g = excluded.kcal_per_100g,
                protein_per_100g = excluded.protein_per_100g,
                fat_per_100g = excluded.fat_per_100g,
                carb_per_100g = excluded.carb_per_100g,
                unit = excluded.unit,
                grams_per_unit = excluded.grams_per_unit,
                usual_grams = excluded.usual_grams,
                max_grams = excluded.max_grams,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            """,
            FOODS,
        )
        await conn.executemany(
            "INSERT INTO food_aliases (food_id, alias) VALUES (?, ?)"
            " ON CONFLICT (food_id, alias) DO NOTHING",
            [(food_id, alias) for food_id, names in ALIASES.items() for alias in names],
        )
    return len(FOODS)


if __name__ == "__main__":
    count = asyncio.run(seed())
    print(f"seeded {count} foods", file=sys.stderr)
