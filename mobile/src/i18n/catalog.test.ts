import { catalogs } from "./index";

type Leaf = { key: string; value: string };

function leaves(value: unknown, prefix = ""): Leaf[] {
  if (typeof value === "string") return [{ key: prefix, value }];
  if (typeof value !== "object" || value === null) return [];

  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return leaves(child, path);
  });
}

function placeholders(message: string): string[] {
  return [...message.matchAll(/%\{([^}]+)\}/g)].map((match) => match[1]).sort();
}

describe("translation catalogs", () => {
  it("have the same keys and interpolation variables", () => {
    const reference = leaves(catalogs["zh-TW"]);
    const english = new Map(
      leaves(catalogs.en).map((leaf) => [leaf.key, leaf.value]),
    );

    expect([...english.keys()]).toEqual(reference.map((leaf) => leaf.key));
    for (const leaf of reference) {
      expect(placeholders(english.get(leaf.key) ?? "")).toEqual(
        placeholders(leaf.value),
      );
    }
  });

  it("does not leave English values blank", () => {
    expect(
      leaves(catalogs.en).every((leaf) => leaf.value.trim().length > 0),
    ).toBe(true);
  });

  it("does not leave untranslated Chinese in English copy", () => {
    const allowed = new Set(["settings.languageTraditionalChinese"]);
    const untranslated = leaves(catalogs.en).filter(
      (leaf) => /[一-鿿]/.test(leaf.value) && !allowed.has(leaf.key),
    );

    expect(untranslated).toEqual([]);
  });
});
