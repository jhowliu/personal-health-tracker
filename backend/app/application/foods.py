"""The food library: browsing, searching, custom entries, and swap candidates."""

from dataclasses import replace

from app.application.ports import FoodStore
from app.domain.errors import NotFound, PermissionDenied
from app.domain.exchange import options
from app.domain.ids import new_id
from app.domain.models import Exchange, Food, FoodCategory, SwapBasis


class FoodCatalogService:
    def __init__(self, store: FoodStore) -> None:
        self._store = store

    async def categories(self) -> tuple[FoodCategory, ...]:
        return await self._store.categories()

    async def search(
        self, user_id: str, query: str | None = None, category_id: str | None = None
    ) -> tuple[Food, ...]:
        return await self._store.search(user_id, query, category_id)

    async def get(self, user_id: str, food_id: str) -> Food:
        found = await self._store.load(user_id, food_id)
        if found is None:
            raise NotFound("找不到這個食物")
        return found

    async def add_custom(self, user_id: str, draft: Food) -> Food:
        food = replace(draft, id=new_id(), is_builtin=False)
        await self._store.save_custom(user_id, food)
        return food

    async def edit_custom(self, user_id: str, food: Food) -> None:
        existing = await self.get(user_id, food.id)
        if existing.is_builtin:
            raise PermissionDenied("內建食物不能修改,請先複製一份")
        await self._store.save_custom(user_id, food)

    async def remove_custom(self, user_id: str, food_id: str) -> None:
        existing = await self.get(user_id, food_id)
        if existing.is_builtin:
            raise PermissionDenied("內建食物不能刪除")
        await self._store.archive_custom(user_id, food_id)

    async def exchanges(
        self, user_id: str, food_id: str, grams: float, basis: SwapBasis | None = None
    ) -> tuple[Exchange, ...]:
        """Same-category swaps for one food at a given portion.

        The basis defaults to the category's own rule (staples on carbs, protein on
        protein); the substitute screen can override it to calories.
        """
        source = await self.get(user_id, food_id)
        candidates = await self._store.in_category(user_id, source.category_id)

        if basis is None:
            by_id = {c.id: c for c in await self._store.categories()}
            category = by_id.get(source.category_id)
            basis = category.swap_by if category else SwapBasis.KCAL

        return options(source, grams, candidates, basis)
