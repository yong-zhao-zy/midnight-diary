import { WritingSteps } from "@/components/diary/WritingSteps";

export default function WritePage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <header className="mb-10 text-center space-y-2">
        <h1 className="text-3xl font-semibold text-glow-gold">今夜想聊些什么？</h1>
        <p className="text-muted">跟随引导，一步步写下此刻的心境</p>
      </header>
      <WritingSteps />
    </main>
  );
}
