import { useMemo, useState } from "react";
import type { Exercise } from "@/lib/exercises";
import type { Progress } from "@/lib/storage";
import { themes } from "@/data";
import { BestBadge, Card, LevelChip, TypeChip } from "./bits";
import { IconCheck, IconChevronRight } from "./icons";

interface Props {
  exercises: Exercise[];
  progress: Progress;
  onOpen: (id: string) => void;
  initialTheme?: string;
}

export default function TaskList({ exercises, progress, onOpen, initialTheme }: Props) {
  const [level, setLevel] = useState(0);
  const [theme, setTheme] = useState(initialTheme ?? "all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => {
      if (level && e.level !== level) return false;
      if (theme !== "all" && e.themeId !== theme) return false;
      if (q && !e.en.toLowerCase().includes(q) && !e.ru.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [exercises, level, theme, query]);

  const doneInFilter = filtered.filter((e) => progress.tasks[e.id]?.completed).length;

  return (
    <div className="animate-fade">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Все задания</h1>
          <p className="mt-0.5 text-sm text-muted">
            Показано {filtered.length} из {exercises.length} · пройдено в подборке: {doneInFilter}
          </p>
        </div>
      </div>

      {/* фильтры */}
      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[0, 1, 2, 3, 4].map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                level === l
                  ? "bg-ink text-paper"
                  : "bg-card-2 text-ink-soft ring-1 ring-line-soft hover:ring-ink/25"
              }`}
            >
              {l === 0 ? "Все уровни" : `Уровень ${l}`}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="h-9 rounded-lg border border-line bg-card px-2.5 text-xs font-bold text-ink-soft outline-none transition focus:border-ink/40"
          >
            <option value="all">Все темы</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по тексту…"
            className="h-9 w-44 rounded-lg border border-line bg-card px-3 text-xs font-semibold text-ink outline-none transition placeholder:text-muted/70 focus:border-ink/40 md:w-56"
          />
        </div>
      </Card>

      {/* список */}
      <Card className="overflow-hidden">
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm font-semibold text-muted">
            Ничего не найдено. Сбрось фильтры.
          </div>
        )}
        <ul className="max-h-[calc(100vh-280px)] overflow-y-auto">
          {filtered.map((e, i) => {
            const p = progress.tasks[e.id];
            const perfect = p?.completed && p.best >= 0.9999;
            return (
              <li key={e.id} className="border-b border-line-soft last:border-0">
                <button
                  onClick={() => onOpen(e.id)}
                  className="group flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-card-2"
                >
                  <span className="w-9 shrink-0 text-right font-mono text-[11px] text-muted/70">
                    {i + 1}
                  </span>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      perfect
                        ? "bg-good-soft text-good-deep"
                        : p?.completed
                          ? "bg-amber-soft text-amber"
                          : "border border-dashed border-line text-transparent"
                    }`}
                  >
                    <IconCheck className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-display text-[14px] font-semibold text-ink">
                    {e.en}
                  </span>
                  <span className="hidden shrink-0 items-center gap-1.5 md:flex">
                    <LevelChip level={e.level} compact />
                    <TypeChip label={e.typeLabel} />
                  </span>
                  <span className="hidden w-20 shrink-0 text-right text-[11px] font-bold text-muted sm:block">
                    {e.letters} букв
                  </span>
                  <span className="w-20 shrink-0 text-right">
                    <BestBadge best={p?.best ?? null} />
                  </span>
                  <IconChevronRight className="h-4 w-4 shrink-0 text-muted/50 transition group-hover:translate-x-0.5 group-hover:text-ink" />
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
