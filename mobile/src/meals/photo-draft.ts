export type RecognizedFood = {
  food_id: string;
  category_id: string;
  label: string;
};

export type EstimatedFood = {
  category_id: string;
  kcal_per_100g: number;
  protein_per_100g: number;
  fat_per_100g: number;
  carb_per_100g: number;
};

export type RecognizedItem = {
  label: string;
  category_id: string | null;
  food_id: string | null;
  grams: number;
  recognition_confidence: number;
  match_confidence: number;
  alternatives: RecognizedFood[];
  estimate: EstimatedFood | null;
};

export type PhotoAnalysis = {
  id: string;
  status: string;
  items: RecognizedItem[];
};

// The capture and review routes are adjacent in the stack, so an in-memory handoff avoids
// serialising a potentially large recognition response into route parameters. Results are
// keyed by analysis id so an abandoned flow cannot surface in a later review screen.
const analyses = new Map<string, PhotoAnalysis>();

export const photoDraft = {
  set(analysis: PhotoAnalysis) {
    analyses.set(analysis.id, analysis);
  },
  get(id: string | undefined) {
    return id ? analyses.get(id) ?? null : null;
  },
  clear(id: string | undefined) {
    if (id) analyses.delete(id);
  },
  clearAll() {
    analyses.clear();
  },
};
