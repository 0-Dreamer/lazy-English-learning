"use client";

import { useEffect, useMemo, useState } from "react";
import { allExercises } from "@/lib/exercises";
import { applyResult, loadProgress, touchLastTask, type Progress } from "@/lib/storage";
import Dashboard from "@/components/Dashboard";
import TaskList from "@/components/TaskList";
import Exercise from "@/components/Exercise";
import { IconFlame, IconGrid, IconHome } from "@/components/icons";

type View =
  | { name: "home" }
  | { name: "tasks"; theme?: string }
  | { name: "exercise"; id: string };

export default function Home() {
  const exercises = useMemo(() => allExercises(), []);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [view, setView] = useState<View>({ name: "home" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  const openExercise = (id: string) => {
    setProgress((p) => (p ? touchLastTask(p, id) : p));
    setView({ name: "exercise", id });
  };

  const handleResult = (id: string, accuracy: number, ok: number, bad: number) => {
    setProgress((p) => (p ? applyResult(p, id, accuracy, ok, bad) : p));
  };

  const copyCurrentUrl = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const exIndex = useMemo(() => {
    const m = new Map<string, number>();
    exercises.forEach((e, i) => m.set(e.id, i));
    return m;
  }, [exercises]);

  let content: React.ReactNode = null;
  if (!progress) {
    content = (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-sm font-bold text-muted">Загружаем прогресс…</div>
      </div>
    );
  } else if (view.name === "home") {
    content = (
      <Dashboard
        exercises={exercises}
        progress={progress}
        onOpen={openExercise}
        onOpenTasks={(theme) => setView({ name: "tasks", theme })}
      />
    );
  } else if (view.name === "tasks") {
    content = (
      <TaskList
        exercises={exercises}
        progress={progress}
        onOpen={openExercise}
        initialTheme={view.theme}
      />
    );
  } else {
    const idx = exIndex.get(view.id) ?? 0;
    const ex = exercises[idx];
    const nextId = exercises[(idx + 1) % exercises.length].id;
    content = (
      <Exercise
        ex={ex}
        index={idx}
        total={exercises.length}
        best={progress.tasks[ex.id]?.best ?? null}
        onBack={() => setView({ name: "home" })}
        onNext={() => openExercise(nextId)}
        onResult={handleResult}
      />
    );
  }

  const stats = progress
    ? progress.ok + progress.bad > 0
      ? Math.round((progress.ok / (progress.ok + progress.bad)) * 100)
      : null
    : null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <button
            onClick={() => setView({ name: "home" })}
            className="flex items-center gap-2.5"
            aria-label="На главную"
          >
            <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-ink font-display text-[15px] font-bold text-paper">
              а
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-good ring-2 ring-paper" />
            </span>
            <span className="hidden flex-col items-start leading-none sm:flex">
              <span className="text-[15px] font-extrabold tracking-tight text-ink">ПравоПисьмо</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
                spelling trainer
              </span>
            </span>
          </button>

          <nav className="ml-2 flex items-center gap-1">
            <NavBtn
              active={view.name === "home"}
              onClick={() => setView({ name: "home" })}
              icon={<IconHome className="h-4 w-4" />}
              label="Обзор"
            />
            <NavBtn
              active={view.name === "tasks"}
              onClick={() => setView({ name: "tasks" })}
              icon={<IconGrid className="h-4 w-4" />}
              label="Задания"
            />
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {stats !== null && (
              <span className="hidden rounded-lg bg-card px-2.5 py-1.5 text-[11px] font-bold text-ink-soft ring-1 ring-line md:inline-block">
                точность {stats}%
              </span>
            )}
            {progress && progress.streak > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-soft px-2.5 py-1.5 text-[11px] font-bold text-amber ring-1 ring-amber/25">
                <IconFlame className="h-3.5 w-3.5" /> {progress.streak}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 md:py-7">{content}</main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-2">
        <div className="flex flex-col items-start justify-between gap-2 border-t border-line-soft pt-4 sm:flex-row sm:items-center">
          <p className="text-[11px] font-semibold text-muted">
            Прогресс сохраняется в этом браузере — можно закрыть вкладку и вернуться позже.{" "}
            {exercises.length} заданий · 24 темы · 4 уровня.
          </p>
          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={copyCurrentUrl}
              className="font-bold text-primary transition hover:text-primary-deep"
            >
              {copied ? "Ссылка скопирована!" : "Скопировать ссылку"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-bold transition ${
        active ? "bg-ink text-paper" : "text-ink-soft hover:bg-line-soft hover:text-ink"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
