import { buildTourSteps } from './tour';

describe('onboarding tour', () => {
  it('reviews an existing body log before the meal journey', () => {
    expect(buildTourSteps(true).map((step) => step.id)).toEqual([
      'body-review',
      'meal-add',
      'meal-library',
      'food-search',
      'food-result',
      'food-portion',
      'food-add',
      'food-photo',
      'food-done',
    ]);
  });

  it('walks through the body fields when today is not logged', () => {
    expect(
      buildTourSteps(false)
        .map((step) => step.id)
        .slice(0, 4),
    ).toEqual(['body-weight', 'body-waist', 'body-save', 'meal-add']);
  });

  it('does not allow going back across saved body or food mutations', () => {
    const fresh = buildTourSteps(false);
    expect(fresh.find((step) => step.id === 'meal-add')?.canBack).toBe(false);
    expect(fresh.find((step) => step.id === 'food-photo')?.canBack).toBe(false);
  });
});
