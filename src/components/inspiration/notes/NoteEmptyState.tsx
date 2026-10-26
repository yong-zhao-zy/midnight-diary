import { Lightbulb } from "lucide-react";

interface NoteEmptyStateProps {
  onManualAdd: () => void;
}

export function NoteEmptyState({ onManualAdd }: NoteEmptyStateProps) {
  return (
    <div className="text-center py-16 space-y-4">
      <div className="flex justify-center">
        <div className="h-14 w-14 rounded-full bg-accent/5 border border-accent/15 flex items-center justify-center">
          <Lightbulb className="h-6 w-6 text-accent/40" />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-ink-2/80 text-sm leading-relaxed">
          在 AI 解读时长按任意文字
        </p>
        <p className="text-ink-2/70 text-xs">
          把触动你的句子存到这里
        </p>
      </div>
      <button
        onClick={onManualAdd}
        className="px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-sm text-accent hover:bg-accent/20 transition-colors"
      >
        手动添加笔记
      </button>
    </div>
  );
}
