"""Give a user a handful of starter meals so today's flow has something to serve.

The spec lists this as an optional seed: a brand-new account with no meals shows
"還沒有適合這個時段的餐點" at every slot, which is a poor first run.

Idempotent per user — skips anyone who already has meals, so it is safe to re-run.
Goes through MealStore rather than raw SQL so the rows land exactly as the API writes
them.

    python -m seeds.sample_meals              # every user who has no meals yet
    python -m seeds.sample_meals a@b.com      # just this one
"""

import asyncio
import sys

from app.adapters.sqlite.meals import SqliteMealStore
from app.db import get_conn
from app.domain.ids import new_id
from app.domain.models import Meal, MealItem, MealTag, MealTime

# name, tag, slots, [(food_id, grams)]
RECIPES: list[tuple[str, MealTag, tuple[MealTime, ...], list[tuple[str, float]]]] = [
    (
        "燕麥豆漿早餐",
        MealTag.REGULAR,
        (MealTime.BREAKFAST,),
        [("oats-raw", 30), ("soy-milk-unsweetened", 250), ("banana", 100)],
    ),
    (
        "雞蛋吐司早餐",
        MealTag.REGULAR,
        (MealTime.BREAKFAST,),
        [("toast", 60), ("egg", 100), ("apple", 180)],
    ),
    (
        "雞胸胡麻花椰飯",
        MealTag.REGULAR,
        (MealTime.LUNCH, MealTime.DINNER),
        [
            ("brown-rice-cooked", 120),
            ("chicken-breast-cooked", 100),
            ("broccoli-cooked", 150),
            ("sesame-dressing", 15),
        ],
    ),
    (
        "乾煎雞腿蛋花湯",
        MealTag.REGULAR,
        (MealTime.LUNCH, MealTime.DINNER),
        [
            ("brown-rice-cooked", 100),
            ("chicken-thigh-skin-on-cooked", 100),
            ("egg", 50),
            ("zucchini-cooked", 100),
            ("enoki-mushroom", 50),
        ],
    ),
    (
        "鮭魚地瓜菠菜",
        MealTag.REGULAR,
        (MealTime.LUNCH, MealTime.DINNER),
        [("sweet-potato-cooked", 150), ("salmon-cooked", 120), ("spinach-cooked", 150)],
    ),
    (
        "豆腐蔬菜清淡餐",
        MealTag.LIGHT,
        (MealTime.DINNER,),
        [("firm-tofu", 150), ("napa-cabbage-cooked", 200), ("carrot-cooked", 50)],
    ),
    (
        "壽喜燒",
        MealTag.OCCASIONAL,
        (MealTime.DINNER,),
        [
            ("rice-cake", 40),
            ("pork-belly-slices", 100),
            ("firm-tofu", 150),
            ("napa-cabbage-cooked", 200),
        ],
    ),
]


async def seed(email: str | None = None) -> dict[str, int]:
    added: dict[str, int] = {}

    async with get_conn() as conn:
        sql = "SELECT id, email FROM users"
        params: tuple = ()
        if email:
            sql += " WHERE email = ?"
            params = (email,)

        async with conn.execute(sql, params) as cursor:
            users = await cursor.fetchall()

        store = SqliteMealStore(conn)
        foods = await _food_lookup(conn)

        for user in users:
            if await store.list(user["id"], None, None):
                continue

            for name, tag, slots, items in RECIPES:
                resolved = [
                    MealItem(id=new_id(), food=foods[fid], grams=grams, sort_order=i)
                    for i, (fid, grams) in enumerate(items)
                    if fid in foods
                ]
                if len(resolved) != len(items):
                    missing = {fid for fid, _ in items} - set(foods)
                    print(f"跳過「{name}」,食物庫缺:{missing}", file=sys.stderr)
                    continue

                await store.save(
                    user["id"],
                    Meal(
                        id=new_id(),
                        name=name,
                        tag=tag,
                        meal_times=frozenset(slots),
                        items=tuple(resolved),
                    ),
                )
            added[user["email"]] = len(RECIPES)

    return added


async def _food_lookup(conn) -> dict:
    from app.adapters.sqlite.foods import SqliteFoodStore

    store = SqliteFoodStore(conn)
    ids = {fid for _, _, _, items in RECIPES for fid, _ in items}
    found = {}
    for fid in ids:
        # user_id is irrelevant here: every seeded food is built-in.
        food = await store.load("", fid)
        if food:
            found[fid] = food
    return found


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    result = asyncio.run(seed(target))
    if not result:
        print("沒有需要處理的使用者(都已經有餐點了)", file=sys.stderr)
    for email, count in result.items():
        print(f"{email}: 加入 {count} 道範例餐點", file=sys.stderr)
