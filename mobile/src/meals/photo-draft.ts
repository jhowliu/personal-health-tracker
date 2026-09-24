export type RecognizedFood = {
  food_id: string;
  category_id: string;
  label: string;
};

export type RecognizedItem = {
  label: string;
  category_id: string | null;
  food_id: string | null;
  grams: number;
  confidence: number;
  alternatives: RecognizedFood[];
};

export type PhotoAnalysis = {
  id: string;
  status: string;
  items: RecognizedItem[];
};

// The capture and review routes are adjacent in the stack, so an in-memory handoff avoids
// serialising a potentially large recognition response into route parameters.
let current: PhotoAnalysis | null = null;

export const photoDraft = {
  set(analysis: PhotoAnalysis) {
    current = analysis;
  },
  get() {
    return current;
  },
  clear() {
    current = null;
  },
};
