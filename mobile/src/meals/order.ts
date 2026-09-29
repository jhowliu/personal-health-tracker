/** Foods in the same order as the category chips, so staples come before oils and sauces. */
export function byCategoryOrder<T extends { category_id: string }>(
  foods: T[],
  categories: { id: string }[],
): T[] {
  const rank = new Map(categories.map((category, index) => [category.id, index]));
  return [...foods].sort(
    (a, b) => (rank.get(a.category_id) ?? categories.length) - (rank.get(b.category_id) ?? categories.length),
  );
}
