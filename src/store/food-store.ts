import { create } from "zustand";
import type { DietLogWithNames, DietLogRow, CreateDietLogInput, UpdateDietLogInput } from "@/lib/diet-log-service";
import type { BodyMetricRow, UpsertBodyMetricInput } from "@/lib/body-metric-service";
import type { RecipeRow, RecipeWithIngredients, CreateRecipeInput, UpdateRecipeInput } from "@/lib/recipe-service";
import type { FoodRow, CreateFoodInput } from "@/lib/food-service";
import type { HealthProfile } from "@/config/dri-config";
import { DEFAULT_HEALTH_PROFILE } from "@/config/dri-config";

const STALE_MS = 5 * 60 * 1000;

interface FoodStoreState {
  userId: string | null;
  healthProfile: HealthProfile;

  // Diet logs grouped by date
  dietLogsByDate: Record<string, DietLogWithNames[]>;
  dietLogsFetchedAt: Record<string, number>;

  // Body metrics
  bodyMetrics: BodyMetricRow[];
  bodyMetricsFetchedAt: number | null;

  // Recipes
  recipes: RecipeRow[];
  recipesFetchedAt: number | null;

  // Food search cache
  foodSearchCache: Record<string, { results: FoodRow[]; fetchedAt: number }>;

  // User custom foods
  userFoods: FoodRow[];
  userFoodsFetchedAt: number | null;

  // Prefetch / ensure
  prefetchAll: (userId: string) => Promise<void>;
  ensureDietLogsForDate: (date: string) => Promise<void>;
  ensureBodyMetrics: () => Promise<void>;
  ensureRecipes: () => Promise<void>;
  ensureUserFoods: () => Promise<void>;
  searchFoods: (query: string) => Promise<FoodRow[]>;

  // Mutations — Diet Logs
  addDietLog: (input: Omit<CreateDietLogInput, "userId">) => Promise<DietLogRow | null>;
  updateDietLog: (id: string, patch: UpdateDietLogInput, date: string) => Promise<DietLogRow | null>;
  removeDietLog: (id: string, date: string) => Promise<boolean>;

  // Mutations — Body Metrics
  saveBodyMetric: (input: Omit<UpsertBodyMetricInput, "userId">) => Promise<BodyMetricRow | null>;
  removeBodyMetric: (id: string) => Promise<boolean>;

  // Mutations — Recipes
  addRecipe: (input: Omit<CreateRecipeInput, "userId">) => Promise<RecipeWithIngredients | null>;
  updateRecipe: (id: string, input: UpdateRecipeInput) => Promise<RecipeWithIngredients | null>;
  removeRecipe: (id: string) => Promise<boolean>;

  // Mutations — Foods
  addUserFood: (input: CreateFoodInput) => Promise<FoodRow | null>;
  removeUserFood: (id: string) => Promise<boolean>;

  // Health Profile
  saveHealthProfile: (profile: HealthProfile) => Promise<boolean>;
  setHealthProfile: (profile: HealthProfile) => void;

  reset: () => void;
}

// Module-level in-flight promise tracking
let dietLogsPromises: Record<string, Promise<void> | undefined> = {};
let bodyMetricsPromise: Promise<void> | null = null;
let recipesPromise: Promise<void> | null = null;
let userFoodsPromise: Promise<void> | null = null;

export const useFoodStore = create<FoodStoreState>((set, get) => ({
  userId: null,
  healthProfile: DEFAULT_HEALTH_PROFILE,
  dietLogsByDate: {},
  dietLogsFetchedAt: {},
  bodyMetrics: [],
  bodyMetricsFetchedAt: null,
  recipes: [],
  recipesFetchedAt: null,
  foodSearchCache: {},
  userFoods: [],
  userFoodsFetchedAt: null,

  prefetchAll: async (userId) => {
    set({ userId });
    await Promise.all([
      get().ensureBodyMetrics(),
      get().ensureRecipes(),
    ]);
  },

  ensureDietLogsForDate: async (date) => {
    const { userId } = get();
    if (!userId) return;
    const fetchedAt = get().dietLogsFetchedAt[date];
    if (fetchedAt && Date.now() - fetchedAt < STALE_MS) return;
    if (dietLogsPromises[date]) return dietLogsPromises[date];
    dietLogsPromises[date] = (async () => {
      try {
        const res = await fetch(`/api/diet-logs?date=${date}`);
        if (!res.ok) return;
        const data = await res.json();
        const logs: DietLogWithNames[] = data.dietLogs ?? [];
        set((s) => ({
          dietLogsByDate: { ...s.dietLogsByDate, [date]: logs },
          dietLogsFetchedAt: { ...s.dietLogsFetchedAt, [date]: Date.now() },
        }));
      } finally {
        delete dietLogsPromises[date];
      }
    })();
    return dietLogsPromises[date];
  },

  ensureBodyMetrics: async () => {
    const { userId, bodyMetricsFetchedAt } = get();
    if (!userId) return;
    if (bodyMetricsFetchedAt && Date.now() - bodyMetricsFetchedAt < STALE_MS) return;
    if (bodyMetricsPromise) return bodyMetricsPromise;
    bodyMetricsPromise = (async () => {
      try {
        const res = await fetch("/api/body-metrics?limit=90");
        if (!res.ok) return;
        const data = await res.json();
        set({ bodyMetrics: data.bodyMetrics ?? [], bodyMetricsFetchedAt: Date.now() });
      } finally {
        bodyMetricsPromise = null;
      }
    })();
    return bodyMetricsPromise;
  },

  ensureRecipes: async () => {
    const { userId, recipesFetchedAt } = get();
    if (!userId) return;
    if (recipesFetchedAt && Date.now() - recipesFetchedAt < STALE_MS) return;
    if (recipesPromise) return recipesPromise;
    recipesPromise = (async () => {
      try {
        const res = await fetch("/api/recipes");
        if (!res.ok) return;
        const data = await res.json();
        set({ recipes: data.recipes ?? [], recipesFetchedAt: Date.now() });
      } finally {
        recipesPromise = null;
      }
    })();
    return recipesPromise;
  },

  ensureUserFoods: async () => {
    const { userId, userFoodsFetchedAt } = get();
    if (!userId) return;
    if (userFoodsFetchedAt && Date.now() - userFoodsFetchedAt < STALE_MS) return;
    if (userFoodsPromise) return userFoodsPromise;
    userFoodsPromise = (async () => {
      try {
        const res = await fetch("/api/foods?limit=100");
        if (!res.ok) return;
        const data = await res.json();
        set({ userFoods: data.foods ?? [], userFoodsFetchedAt: Date.now() });
      } finally {
        userFoodsPromise = null;
      }
    })();
    return userFoodsPromise;
  },

  searchFoods: async (query) => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const cached = get().foodSearchCache[trimmed];
    if (cached && Date.now() - cached.fetchedAt < STALE_MS) {
      return cached.results;
    }
    try {
      const res = await fetch(`/api/foods?q=${encodeURIComponent(trimmed)}&limit=20`);
      if (!res.ok) return [];
      const data = await res.json();
      const results: FoodRow[] = data.foods ?? [];
      set((s) => ({
        foodSearchCache: {
          ...s.foodSearchCache,
          [trimmed]: { results, fetchedAt: Date.now() },
        },
      }));
      return results;
    } catch {
      return [];
    }
  },

  // ─── Diet Log mutations ──────────────────────────────────────
  addDietLog: async (input) => {
    try {
      const res = await fetch("/api/diet-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.dietLog) return null;
      const log = data.dietLog as DietLogRow;
      const date = input.log_date;
      set((s) => {
        const existing = s.dietLogsByDate[date] ?? [];
        return {
          dietLogsByDate: { ...s.dietLogsByDate, [date]: [...existing, data.dietLog] },
          dietLogsFetchedAt: { ...s.dietLogsFetchedAt, [date]: Date.now() },
        };
      });
      return log;
    } catch {
      return null;
    }
  },

  updateDietLog: async (id, patch, date) => {
    try {
      const res = await fetch(`/api/diet-logs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.dietLog) return null;
      const updated = data.dietLog as DietLogRow;
      set((s) => {
        const list = s.dietLogsByDate[date] ?? [];
        return {
          dietLogsByDate: {
            ...s.dietLogsByDate,
            [date]: list.map((l) =>
              l.id === id ? { ...l, ...updated } : l
            ),
          },
        };
      });
      return updated;
    } catch {
      return null;
    }
  },

  removeDietLog: async (id, date) => {
    const prev = get().dietLogsByDate[date] ?? [];
    set((s) => ({
      dietLogsByDate: {
        ...s.dietLogsByDate,
        [date]: (s.dietLogsByDate[date] ?? []).filter((l) => l.id !== id),
      },
    }));
    try {
      const res = await fetch(`/api/diet-logs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        set((s) => ({ dietLogsByDate: { ...s.dietLogsByDate, [date]: prev } }));
        return false;
      }
      return true;
    } catch {
      set((s) => ({ dietLogsByDate: { ...s.dietLogsByDate, [date]: prev } }));
      return false;
    }
  },

  // ─── Body Metric mutations ───────────────────────────────────
  saveBodyMetric: async (input) => {
    try {
      const res = await fetch("/api/body-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.bodyMetric) return null;
      const metric = data.bodyMetric as BodyMetricRow;
      set((s) => {
        const others = s.bodyMetrics.filter((m) => m.log_date !== metric.log_date);
        return { bodyMetrics: [metric, ...others].sort((a, b) => b.log_date.localeCompare(a.log_date)) };
      });
      return metric;
    } catch {
      return null;
    }
  },

  removeBodyMetric: async (id) => {
    const prev = get().bodyMetrics;
    set((s) => ({ bodyMetrics: s.bodyMetrics.filter((m) => m.id !== id) }));
    try {
      const res = await fetch(`/api/body-metrics/${id}`, { method: "DELETE" });
      if (!res.ok) {
        set({ bodyMetrics: prev });
        return false;
      }
      return true;
    } catch {
      set({ bodyMetrics: prev });
      return false;
    }
  },

  // ─── Recipe mutations ────────────────────────────────────────
  addRecipe: async (input) => {
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.recipe) return null;
      const recipe = data.recipe as RecipeWithIngredients;
      set((s) => ({
        recipes: [recipe, ...s.recipes],
        recipesFetchedAt: Date.now(),
      }));
      return recipe;
    } catch {
      return null;
    }
  },

  updateRecipe: async (id, input) => {
    try {
      const res = await fetch(`/api/recipes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.recipe) return null;
      const recipe = data.recipe as RecipeWithIngredients;
      set((s) => ({
        recipes: s.recipes.map((r) => (r.id === id ? recipe : r)),
        recipesFetchedAt: Date.now(),
      }));
      return recipe;
    } catch {
      return null;
    }
  },

  removeRecipe: async (id) => {
    const prev = get().recipes;
    set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) }));
    try {
      const res = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        set({ recipes: prev });
        return false;
      }
      return true;
    } catch {
      set({ recipes: prev });
      return false;
    }
  },

  // ─── Food mutations ──────────────────────────────────────────
  addUserFood: async (input) => {
    try {
      const res = await fetch("/api/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.food) return null;
      const food = data.food as FoodRow;
      set((s) => ({
        userFoods: [food, ...s.userFoods],
        userFoodsFetchedAt: Date.now(),
      }));
      return food;
    } catch {
      return null;
    }
  },

  removeUserFood: async (id) => {
    const prev = get().userFoods;
    set((s) => ({ userFoods: s.userFoods.filter((f) => f.id !== id) }));
    try {
      const res = await fetch(`/api/foods/${id}`, { method: "DELETE" });
      if (!res.ok) {
        set({ userFoods: prev });
        return false;
      }
      return true;
    } catch {
      set({ userFoods: prev });
      return false;
    }
  },

  // ─── Health Profile ─────────────────────────────────────────
  saveHealthProfile: async (profile) => {
    try {
      const res = await fetch("/api/health-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) return false;
      set({ healthProfile: profile });
      return true;
    } catch {
      return false;
    }
  },

  setHealthProfile: (profile) => {
    set({ healthProfile: profile });
  },

  reset: () => {
    set({
      userId: null,
      healthProfile: DEFAULT_HEALTH_PROFILE,
      dietLogsByDate: {},
      dietLogsFetchedAt: {},
      bodyMetrics: [],
      bodyMetricsFetchedAt: null,
      recipes: [],
      recipesFetchedAt: null,
      foodSearchCache: {},
      userFoods: [],
      userFoodsFetchedAt: null,
    });
    dietLogsPromises = {};
    bodyMetricsPromise = null;
    recipesPromise = null;
    userFoodsPromise = null;
  },
}));
