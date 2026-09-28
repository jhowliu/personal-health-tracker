import sqlite3

from yoyo import get_backend, read_migrations

from scripts.migrate import MIGRATIONS_DIR


def test_existing_shared_food_references_are_moved_to_each_owner(tmp_path):
    db_path = tmp_path / "existing.sqlite"
    backend = get_backend(f"sqlite:///{db_path}")
    migrations = read_migrations(str(MIGRATIONS_DIR))
    with backend.lock():
        backend.apply_migrations(
            backend.to_apply(migrations).filter(lambda m: m.id != "0013_private_food_catalog")
        )

    with sqlite3.connect(db_path) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.executemany(
            "INSERT INTO users (id, email) VALUES (?, ?)",
            [("owner-1", "one@example.com"), ("owner-2", "two@example.com")],
        )
        conn.execute(
            "INSERT INTO foods (id, category_id, name, state, kcal_per_100g,"
            " protein_per_100g, fat_per_100g, carb_per_100g, usual_grams, max_grams)"
            " VALUES ('shared', 'protein', '雞胸', 'cooked', 165, 31, 3.6, 0, 100, 200)"
        )
        conn.execute("INSERT INTO food_aliases (food_id, alias) VALUES ('shared', '雞肉')")
        conn.execute(
            "INSERT INTO foods (id, user_id, category_id, name, kcal_per_100g,"
            " protein_per_100g, fat_per_100g, carb_per_100g, usual_grams, max_grams)"
            " VALUES ('my-food', 'owner-1', 'protein', '自建蛋白質', 100, 15, 3, 0, 100, 200)"
        )
        conn.executemany(
            "INSERT INTO meals (id, user_id, name) VALUES (?, ?, ?)",
            [("meal-1", "owner-1", "一號餐"), ("meal-2", "owner-2", "二號餐")],
        )
        conn.executemany(
            "INSERT INTO meal_items (id, meal_id, food_id, grams) VALUES (?, ?, 'shared', 100)",
            [("item-1", "meal-1"), ("item-2", "meal-2")],
        )
        conn.execute(
            "INSERT INTO days (user_id, date, workout_time, location)"
            " VALUES ('owner-1', '2026-09-22', 'pm', 'home')"
        )
        conn.execute(
            "INSERT INTO day_meals (user_id, date, meal_time, eaten_at)"
            " VALUES ('owner-1', '2026-09-22', 'breakfast', '2026-09-22T12:00:00Z')"
        )
        # The cached 165 is stale after changing the portion from 100 g to 200 g.
        conn.execute(
            "INSERT INTO day_meal_items (id, user_id, date, meal_time, food_id, grams,"
            " kcal, protein_g, fat_g, carb_g) VALUES"
            " ('day-1', 'owner-1', '2026-09-22', 'breakfast', 'shared', 200, 165, 31, 3.6, 0)"
        )

    with backend.lock():
        backend.apply_migrations(backend.to_apply(migrations))

    with sqlite3.connect(db_path) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        assert conn.execute("PRAGMA foreign_key_check").fetchall() == []
        assert conn.execute("SELECT COUNT(*) FROM food_templates").fetchone()[0] == 1
        assert conn.execute(
            "SELECT COUNT(*) FROM foods WHERE template_id = 'shared'"
        ).fetchone()[0] == 2
        assert conn.execute(
            "SELECT f.user_id, i.food_id FROM meal_items i JOIN meals m ON m.id = i.meal_id"
            " JOIN foods f ON f.id = i.food_id ORDER BY f.user_id"
        ).fetchall() == [
            ("owner-1", "seed:owner-1:shared"),
            ("owner-2", "seed:owner-2:shared"),
        ]
        assert conn.execute(
            "SELECT food_id, kcal, nutrition_snapshot_grams FROM day_meal_items WHERE id = 'day-1'"
        ).fetchone() == ("seed:owner-1:shared", 330, 200)
        assert conn.execute("SELECT COUNT(*) FROM food_aliases").fetchone()[0] == 2
        custom = conn.execute(
            "SELECT user_id, template_id FROM foods WHERE id = 'my-food'"
        ).fetchone()
        assert custom == ("owner-1", None)

    with backend.lock():
        backend.rollback_migrations(
            backend.to_rollback(migrations).filter(lambda m: m.id == "0013_private_food_catalog")
        )
    with sqlite3.connect(db_path) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        assert conn.execute("PRAGMA foreign_key_check").fetchall() == []
        assert conn.execute("SELECT COUNT(*) FROM foods").fetchone()[0] == 4
        assert conn.execute("SELECT COUNT(*) FROM meal_items").fetchone()[0] == 2
