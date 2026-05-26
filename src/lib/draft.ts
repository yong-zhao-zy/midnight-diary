const DRAFT_KEY = "midnight-diary-draft";

export interface Draft {
  content: Record<string, string>;
  currentStep: number;
  lastUpdated: number;
  date: string; // YYYY-MM-DD
}

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function saveDraft(content: Record<string, string>, currentStep: number): void {
  const draft: Draft = {
    content,
    currentStep,
    lastUpdated: Date.now(),
    date: getToday(),
  };
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;

    const draft: Draft = JSON.parse(raw);
    const now = Date.now();
    const isToday = draft.date === getToday();
    const within24h = now - draft.lastUpdated < 24 * 60 * 60 * 1000;

    if (isToday && within24h) return draft;

    // Expired draft — clean up
    clearDraft();
    return null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore
  }
}
