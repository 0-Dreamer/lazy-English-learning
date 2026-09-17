import { useMemo } from "react";
import type { Exercise } from "@/lib/exercises";
import { progressStats, type Progress } from "@/lib/storage";
import { themes } from "@/data";
import { Bar, BestBadge, Card, LevelChip } from "./bits";
import { IconChevronRight, IconDice, IconFlame, IconGrid, IconPlay, IconTarget } from "./icons";

interface Props {
  exercises: Exercise[];
  progress: Progress;
  onOpen: (id: string) => void;
  onOpenTasks: (themeId?: string) => void;
}

export default function Dashboard({ exercises, progress, onOpen, onOpenTasks }: Props) {
  const stats = progressStats(progress);
  const total = exercises.length;

  const nextTask = useMemo(() => {
    const last = progress.lastTaskId ? exercises.find((e) => e.id === progress.lastTaskId) : null;
    if (last && !progress.tasks[last.id]?.completed) return last;
    return exercises.find((e) => !progress.tasks[e.id]?.completed) ?? exercises[0];
  }, [progress, exercises]);

  const randomTask = () => {
    const undone = exercises.filter((e) => !progress.tasks[e.id]?.completed);
    const pool = undone.length > 0 ? undone : exercises;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    onOpen(pick.id);
  };

  const themeStats = useMemo(() => {
    const m = new Map<string, { total: number; done: number; perfect: number }>();
    for (const t of themes) m.set(t.id, { total: 0, done: 0, perfect: 0 });
    for (const e of exercises) {
      const s = m.get(e.themeId);
      if (!s) continue;
      s.total++;
      const p = progress.tasks[e.id];
      if (p?.completed) {
        s.done++;
        if (p.best >= 0.9999) s.perfect++;
      }
    }
    return m;
  }, [exercises, progress]);

  const best = nextTask ? progress.tasks[nextTask.id]?.best ?? null : null;

  return (
    <div className="animate-fade space-y-6">
      {/* герой + статистика */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="p-5 md:p-6">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Тренажёр написания английских слов
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink md:text-[28px]">
            Читай, переписывай и запомни spelling навсегда
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            Переписывай предложения с экрана. Правильная буква становится{" "}
            <span className="font-bold text-good-deep">зелёной</span>, ошибочная —{" "}
            <span className="font-bold text-bad-deep">красной</span>. Слова кликабельны: там их
            значения, а справа — полный перевод и объяснение правил.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => nextTask && onOpen(nextTask.id)}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-card shadow-sm transition hover:bg-primary-deep"
            >
              <IconPlay className="h-4 w-4" /> Продолжить тренировку
            </button>
            <button
              onClick={randomTask}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink-soft transition hover:border-ink/30 hover:text-ink"
            >
              <IconDice className="h-4 w-4" /> Случайное задание
            </button>
            <button
              onClick={() => onOpenTasks()}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink-soft transition hover:border-ink/30 hover:text-ink"
            >
              <IconGrid className="h-4 w-4" /> Все задания
            </button>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Пройдено"
            value={`${stats.done}`}
            sub={`из ${total} заданий`}
            extra={<Bar value={stats.done / Math.max(1, total)} className="mt-2" />}
          />
          <StatTile
            label="Точность"
            value={stats.accuracy === null ? "—" : `${Math.round(stats.accuracy * 100)}%`}
            sub={`${stats.letters.toLocaleString("ru-RU")} букв набрано`}
          />
          <StatTile
            label="Серия без ошибок"
            value={`${progress.streak}`}
            sub={`рекорд: ${progress.bestStreak}`}
            icon={<IconFlame className="h-4 w-4 text-amber" />}
          />
          <StatTile
            label="Идеальных"
            value={`${stats.perfect}`}
            sub="заданий со 100%"
            icon={<IconTarget className="h-4 w-4 text-primary" />}
          />
        </div>
      </div>

      {/* следующее задание */}
      {nextTask && (
        <Card className="p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  Следующее задание
                </span>
                <LevelChip level={nextTask.level} compact />
                <span className="text-[11px] font-semibold text-muted">
                  {nextTask.themeTitle} · {nextTask.typeLabel} · {nextTask.letters} букв
                </span>
              </div>
              <div className="mt-1.5 truncate font-display text-[17px] font-semibold text-ink">
                {nextTask.en}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <BestBadge best={best} />
              <button
                onClick={() => onOpen(nextTask.id)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-paper transition hover:bg-ink-soft"
              >
                Начать <IconChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* темы */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink">Темы</h2>
          <button
            onClick={() => onOpenTasks()}
            className="text-xs font-bold text-primary transition hover:text-primary-deep"
          >
            Все {total} заданий →
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {themes.map((t) => {
            const s = themeStats.get(t.id) ?? { total: 0, done: 0, perfect: 0 };
            const pct = s.total ? s.done / s.total : 0;
            return (
              <button
                key={t.id}
                onClick={() => onOpenTasks(t.id)}
                className="group rounded-xl border border-line bg-card p-4 text-left shadow-[0_1px_2px_rgba(38,34,25,0.05)] transition hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-[0_6px_18px_-8px_rgba(38,34,25,0.25)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-display text-[15px] font-bold text-ink">{t.title}</div>
                  <LevelChip level={t.level} compact />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Bar value={pct} className="flex-1" />
                  <span className="whitespace-nowrap text-[11px] font-bold text-muted">
                    {s.done}/{s.total}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-muted">
                  <span>{s.perfect > 0 ? `${s.perfect} идеальных` : "ещё не начата"}</span>
                  <IconChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  icon,
  extra,
}: {
  label: string;
  value: string;
  sub: string;
  icon?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col justify-between p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</span>
        {icon}
      </div>
      <div className="mt-1 font-display text-2xl font-bold text-ink">{value}</div>
      <div className="text-[11px] font-semibold text-muted">{sub}</div>
      {extra}
    </Card>
  );
}
