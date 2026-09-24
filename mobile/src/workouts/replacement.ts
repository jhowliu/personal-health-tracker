type Selection = { index: number; exercise_id: string; exercise_name: string };

let current: Selection | null = null;
const listeners = new Set<() => void>();

export const replacement = {
  choose(selection: Selection) {
    current = selection;
    listeners.forEach((notify) => notify());
  },
  take() {
    const selection = current;
    current = null;
    return selection;
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
