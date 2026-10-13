import type { MessageKey } from '@/i18n';

export const CURRENT_ONBOARDING_VERSION = 1;

export type TourStepId =
  | 'body-review'
  | 'body-weight'
  | 'body-waist'
  | 'body-save'
  | 'meal-add'
  | 'meal-library'
  | 'food-search'
  | 'food-result'
  | 'food-portion'
  | 'food-add'
  | 'food-photo'
  | 'food-done';

export type TourTargetId = TourStepId;

export type TourStep = {
  id: TourStepId;
  target: TourTargetId;
  title: MessageKey;
  body: MessageKey;
  action?: MessageKey;
  canBack: boolean;
  /** Keep the highlighted control visible, but do not let this explanatory step activate it. */
  blockTarget?: boolean;
};

const mealSteps: TourStep[] = [
  {
    id: 'meal-add',
    target: 'meal-add',
    title: 'onboarding.steps.mealAdd.title',
    body: 'onboarding.steps.mealAdd.body',
    action: 'onboarding.steps.mealAdd.action',
    canBack: false,
  },
  {
    id: 'meal-library',
    target: 'meal-library',
    title: 'onboarding.steps.mealLibrary.title',
    body: 'onboarding.steps.mealLibrary.body',
    action: 'onboarding.steps.mealLibrary.action',
    canBack: true,
  },
  {
    id: 'food-search',
    target: 'food-search',
    title: 'onboarding.steps.foodSearch.title',
    body: 'onboarding.steps.foodSearch.body',
    canBack: true,
  },
  {
    id: 'food-result',
    target: 'food-result',
    title: 'onboarding.steps.foodResult.title',
    body: 'onboarding.steps.foodResult.body',
    action: 'onboarding.steps.foodResult.action',
    canBack: true,
  },
  {
    id: 'food-portion',
    target: 'food-portion',
    title: 'onboarding.steps.foodPortion.title',
    body: 'onboarding.steps.foodPortion.body',
    canBack: true,
  },
  {
    id: 'food-add',
    target: 'food-add',
    title: 'onboarding.steps.foodAdd.title',
    body: 'onboarding.steps.foodAdd.body',
    action: 'onboarding.steps.foodAdd.action',
    canBack: true,
  },
  {
    id: 'food-photo',
    target: 'food-photo',
    title: 'onboarding.steps.foodPhoto.title',
    body: 'onboarding.steps.foodPhoto.body',
    canBack: false,
    blockTarget: true,
  },
  {
    id: 'food-done',
    target: 'food-done',
    title: 'onboarding.steps.foodDone.title',
    body: 'onboarding.steps.foodDone.body',
    action: 'onboarding.steps.foodDone.action',
    canBack: false,
  },
];

export function buildTourSteps(bodyLogged: boolean): TourStep[] {
  const bodySteps: TourStep[] = bodyLogged
    ? [
        {
          id: 'body-review',
          target: 'body-review',
          title: 'onboarding.steps.bodyReview.title',
          body: 'onboarding.steps.bodyReview.body',
          canBack: false,
          blockTarget: true,
        },
      ]
    : [
        {
          id: 'body-weight',
          target: 'body-weight',
          title: 'onboarding.steps.bodyWeight.title',
          body: 'onboarding.steps.bodyWeight.body',
          canBack: false,
        },
        {
          id: 'body-waist',
          target: 'body-waist',
          title: 'onboarding.steps.bodyWaist.title',
          body: 'onboarding.steps.bodyWaist.body',
          canBack: true,
        },
        {
          id: 'body-save',
          target: 'body-save',
          title: 'onboarding.steps.bodySave.title',
          body: 'onboarding.steps.bodySave.body',
          action: 'onboarding.steps.bodySave.action',
          canBack: true,
        },
      ];

  return [...bodySteps, ...mealSteps];
}
