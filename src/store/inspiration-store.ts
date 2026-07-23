import { create } from "zustand";
import {
  fetchNotes,
  createNote,
  updateNoteContent,
  type NoteRow,
  type NoteSourceType,
} from "@/lib/note-service";
import {
  fetchPracticesByStatus,
  createPractice,
  updatePracticeTitle,
  completePractice as completePracticeApi,
  toggleCheckin as toggleCheckinApi,
  type PracticeRow,
  type PracticeSourceType,
  type PracticeStats,
} from "@/lib/practice-service";
import { todayShanghaiStr } from "@/lib/date-utils";

const STALE_MS = 5 * 60 * 1000;

interface InspirationStoreState {
  // Data
  notes: NoteRow[];
  practicesActive: PracticeRow[];
  practicesCompleted: PracticeRow[];
  todayCheckedIds: Set<string>;
  // Timestamps (null = never fetched → show skeleton)
  notesFetchedAt: number | null;
  practicesFetchedAt: number | null;
  userId: string | null;
  isLoadingStats: boolean;

  // Prefetch / ensure
  prefetchAll: (userId: string) => Promise<void>;
  prefetchIdleData: () => void;
  ensureNotes: () => Promise<void>;
  ensurePractices: () => Promise<void>;

  // Mutations — Notes
  addNote: (input: { content: string; source_type: NoteSourceType; source_diary_id?: string }) => Promise<NoteRow | null>;
  updateNote: (id: string, content: string) => Promise<boolean>;
  removeNote: (id: string) => Promise<boolean>;

  // Mutations — Practices
  addPractice: (input: { title: string; source_type: PracticeSourceType; source_diary_id?: string }) => Promise<PracticeRow | null>;
  updatePracticeTitle: (id: string, title: string) => Promise<boolean>;
  completePractice: (id: string) => Promise<boolean>;
  removePractice: (id: string) => Promise<boolean>;

  // Mutations — Checkin (optimistic + rollback)
  toggleCheckin: (practiceId: string, date: string) => Promise<PracticeStats | null>;

  reset: () => void;
}

// Module-level in-flight promise tracking — dedup concurrent requests
let notesPromise: Promise<void> | null = null;
let practicesPromise: Promise<void> | null = null;

export const useInspirationStore = create<InspirationStoreState>((set, get) => ({
  notes: [],
  practicesActive: [],
  practicesCompleted: [],
  todayCheckedIds: new Set<string>(),
  notesFetchedAt: null,
  practicesFetchedAt: null,
  userId: null,
  isLoadingStats: false,

  prefetchAll: async (userId) => {
    set({ userId });
    await get().ensureNotes();
  },

  prefetchIdleData: () => {
    get().ensurePractices();
  },

  ensureNotes: async () => {
    const { userId, notesFetchedAt } = get();
    if (!userId) return;
    if (notesFetchedAt && Date.now() - notesFetchedAt < STALE_MS) return;
    if (notesPromise) return notesPromise;
    notesPromise = (async () => {
      try {
        const data = await fetchNotes(userId);
        // Preserve optimistically added notes not yet in the server response
        // (race: LongPressMenu/addNote wrote to store while this fetch was in-flight)
        const currentNotes = get().notes;
        const fetchedIds = new Set(data.map((n) => n.id));
        const optimistic = currentNotes.filter((n) => !fetchedIds.has(n.id));
        set({ notes: [...optimistic, ...data], notesFetchedAt: Date.now() });
      } finally {
        notesPromise = null;
      }
    })();
    return notesPromise;
  },

  ensurePractices: async () => {
    const { userId, practicesFetchedAt } = get();
    if (!userId) return;
    if (practicesFetchedAt && Date.now() - practicesFetchedAt < STALE_MS) return;
    if (practicesPromise) return practicesPromise;
    practicesPromise = (async () => {
      try {
        const [active, completed] = await Promise.all([
          fetchPracticesByStatus(userId, "active"),
          fetchPracticesByStatus(userId, "completed"),
        ]);
        // Also compute today's checked IDs (one round-trip per practice is heavy;
        // instead, fetch today's logs in a single query)
        const supabase = (await import("@/lib/supabase/client")).createClient();
        const today = todayShanghaiStr();
        const { data: todayLogs } = await supabase
          .from("practice_logs")
          .select("practice_id")
          .eq("user_id", userId)
          .eq("is_deleted", false)
          .eq("practiced_at", today);

        const checkedIds = new Set<string>(
          (todayLogs ?? []).map((l: { practice_id: string }) => l.practice_id)
        );

        // Preserve optimistically added active practices not yet in the server response
        const currentActive = get().practicesActive;
        const fetchedActiveIds = new Set(active.map((p) => p.id));
        const optimisticActive = currentActive.filter((p) => !fetchedActiveIds.has(p.id));
        set({
          practicesActive: [...optimisticActive, ...active],
          practicesCompleted: completed,
          todayCheckedIds: checkedIds,
          practicesFetchedAt: Date.now(),
        });
      } finally {
        practicesPromise = null;
      }
    })();
    return practicesPromise;
  },

  // ─── Notes mutations ───────────────────────────────────────────
  addNote: async (input) => {
    const { userId } = get();
    if (!userId) return null;
    const note = await createNote({ userId, ...input });
    if (note) {
      set((s) => ({ notes: [note, ...s.notes] }));
    }
    return note;
  },

  updateNote: async (id, content) => {
    const updated = await updateNoteContent(id, content);
    if (updated) {
      set((s) => ({
        notes: s.notes.map((n) => (n.id === id ? updated : n)),
      }));
      return true;
    }
    return false;
  },

  removeNote: async (id) => {
    // Confirmed removal — wait for API before removing from store to prevent flash-back
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        return false;
      }
      set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
      return true;
    } catch {
      return false;
    }
  },

  // ─── Practices mutations ──────────────────────────────────────
  addPractice: async (input) => {
    const { userId } = get();
    if (!userId) return null;
    const practice = await createPractice({ userId, ...input });
    if (practice) {
      set((s) => ({ practicesActive: [practice, ...s.practicesActive] }));
    }
    return practice;
  },

  updatePracticeTitle: async (id, title) => {
    const updated = await updatePracticeTitle(id, title);
    if (updated) {
      set((s) => ({
        practicesActive: s.practicesActive.map((p) => (p.id === id ? updated : p)),
        practicesCompleted: s.practicesCompleted.map((p) => (p.id === id ? updated : p)),
      }));
      return true;
    }
    return false;
  },

  completePractice: async (id) => {
    const prev = get().practicesActive;
    const target = prev.find((p) => p.id === id);
    if (!target) return false;

    // Optimistic move
    const completedPractice: PracticeRow = {
      ...target,
      status: "completed",
      completed_at: new Date().toISOString(),
    };
    set((s) => ({
      practicesActive: s.practicesActive.filter((p) => p.id !== id),
      practicesCompleted: [completedPractice, ...s.practicesCompleted],
    }));

    const result = await completePracticeApi(id);
    if (!result) {
      // Rollback
      set({
        practicesActive: prev,
        practicesCompleted: get().practicesCompleted.filter((p) => p.id !== id),
      });
      return false;
    }
    // Use server-returned row (canonical completed_at timestamp)
    set((s) => ({
      practicesCompleted: s.practicesCompleted.map((p) => (p.id === id ? result : p)),
    }));
    return true;
  },

  removePractice: async (id) => {
    const prevActive = get().practicesActive;
    const prevCompleted = get().practicesCompleted;
    const prevChecked = new Set(get().todayCheckedIds);

    // Optimistic removal
    set((s) => ({
      practicesActive: s.practicesActive.filter((p) => p.id !== id),
      practicesCompleted: s.practicesCompleted.filter((p) => p.id !== id),
      todayCheckedIds: new Set([...s.todayCheckedIds].filter((pid) => pid !== id)),
    }));

    try {
      const res = await fetch(`/api/practices/${id}`, { method: "DELETE" });
      if (!res.ok) {
        set({
          practicesActive: prevActive,
          practicesCompleted: prevCompleted,
          todayCheckedIds: prevChecked,
        });
        return false;
      }
      return true;
    } catch {
      set({
        practicesActive: prevActive,
        practicesCompleted: prevCompleted,
        todayCheckedIds: prevChecked,
      });
      return false;
    }
  },

  // ─── Checkin (optimistic + rollback) ─────────────────────────
  toggleCheckin: async (practiceId, date) => {
    const isChecked = get().todayCheckedIds.has(practiceId);
    const action = isChecked ? "uncheckin" : "checkin";

    // Optimistic update
    const prevChecked = new Set(get().todayCheckedIds);
    const nextChecked = new Set(prevChecked);
    if (action === "checkin") {
      nextChecked.add(practiceId);
    } else {
      nextChecked.delete(practiceId);
    }
    set({ todayCheckedIds: nextChecked });

    const stats = await toggleCheckinApi(practiceId, date, action);
    if (!stats) {
      // Rollback
      set({ todayCheckedIds: prevChecked });
      return null;
    }
    return stats;
  },

  reset: () => {
    set({
      notes: [],
      practicesActive: [],
      practicesCompleted: [],
      todayCheckedIds: new Set<string>(),
      notesFetchedAt: null,
      practicesFetchedAt: null,
      userId: null,
      isLoadingStats: false,
    });
  },
}));
