import { Sparkles } from "lucide-react";

interface PracticeEmptyStateProps {
  onManualAdd: () => void;
}

export function PracticeEmptyState({ onManualAdd }: PracticeEmptyStateProps) {
  return (
    <div className="text-center py-16 space-y-4">
      <div className="flex justify-center">
        <div className="h-14 w-14 rounded-full bg-glow-gold/5 border border-glow-gold/15 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-glow-gold/40" />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-muted/80 text-sm leading-relaxed">
          长按 AI 解读里的建议
        </p>
        <p className="text-muted/60 text-xs">
          把它变成每日练习，打卡追踪
        </p>
      </div>
      <button
        onClick={onManualAdd}
        className="px-4 py-2 rounded-full bg-glow-gold/10 border border-glow-gold/20 text-sm text-glow-gold hover:bg-glow-gold/20 transition-colors"
      >
        手动添加练习
      </button>
    </div>
  );
}
