"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useFoodStore } from "@/store/food-store";
import type { FoodRow } from "@/lib/food-service";

interface FoodSearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (food: FoodRow) => void;
  excludeIds?: string[];
}

export function FoodSearchSheet({ open, onOpenChange, onSelect, excludeIds }: FoodSearchSheetProps) {
  const searchFoods = useFoodStore((s) => s.searchFoods);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const found = await searchFoods(q);
    setResults(found);
    setLoading(false);
  }, [searchFoods]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 300);
  };

  const excluded = new Set(excludeIds ?? []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-midnight border-white/10 rounded-t-3xl h-[80vh]">
        <SheetHeader>
          <SheetTitle className="text-glow-gold">搜索食物</SheetTitle>
          <SheetDescription className="text-muted/60">从系统食物库或自定义食物中选择</SheetDescription>
        </SheetHeader>

        <div className="px-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/40" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              placeholder="如：鸡蛋、西兰花、米饭"
              className="w-full bg-white/[0.03] border border-white/8 rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted/30 focus:outline-none focus:border-glow-gold/30"
            />
          </div>
        </div>

        <div className="flex-1 px-4 overflow-y-auto pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-glow-gold/40" />
            </div>
          ) : query.trim() === "" ? (
            <p className="text-center text-xs text-muted/40 py-10">输入食物名称开始搜索</p>
          ) : results.length === 0 ? (
            <p className="text-center text-xs text-muted/40 py-10">未找到，可在下方自定义</p>
          ) : (
            <div className="space-y-2 mt-2">
              {results
                .filter((f) => !excluded.has(f.id))
                .map((food) => (
                  <button
                    key={food.id}
                    onClick={() => {
                      onSelect(food);
                      onOpenChange(false);
                    }}
                    className="w-full flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/8 p-3 hover:bg-white/[0.06] transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm text-foreground/90">{food.name}</p>
                      <p className="text-xs text-muted/40 mt-0.5">
                        {food.category ?? "其他"} · {food.default_serving_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-glow-gold/80">{Math.round(food.energy_kcal)}<span className="text-xs text-muted/40 ml-0.5">kcal</span></p>
                      <p className="text-[10px] text-muted/40">每 100g</p>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
