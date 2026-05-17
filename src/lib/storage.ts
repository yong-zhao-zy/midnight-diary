const STORAGE_KEY = "midnight-diary-entries";

export interface DiaryEntry {
  id: string;
  date: string;
  mode: string;
  content: Record<string, string>;
  aiResponse: string;
  summary: string;
}

export function saveDiary(entry: DiaryEntry): void {
  const entries = getAllEntries();
  const index = entries.findIndex((e) => e.id === entry.id);
  if (index >= 0) {
    entries[index] = entry;
  } else {
    entries.push(entry);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function getDiaryHistory(): DiaryEntry[] {
  return getAllEntries().sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getDiaryById(id: string): DiaryEntry | undefined {
  return getAllEntries().find((e) => e.id === id);
}

function getAllEntries(): DiaryEntry[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DiaryEntry[];
  } catch {
    return [];
  }
}
