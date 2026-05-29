import { ChatPanel } from "@/components/chat/chat-panel";
import { SourceSidebar } from "@/components/layout/source-sidebar";

export default function Home() {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 lg:px-6">
        <div>
          <h1 className="font-serif text-xl font-normal tracking-tight">
            BuilderBrain
          </h1>
          <p className="text-[11px] text-muted-foreground">
            GitHub + Notion · Coral SQL
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <SourceSidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <ChatPanel />
        </main>
      </div>
    </div>
  );
}
