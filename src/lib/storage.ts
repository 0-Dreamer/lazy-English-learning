export interface TaskProgress {
  /** Лучшая точность 0..1 */
  best: number;
  attempts: number;
  completed: boolean;
  lastAt: number;
}

export interface Progress {
  v: 1;
  tasks: Record<string, TaskProgress>;
  /** верно набранные буквы */
  ok: number;
  /** ошибочно набранные буквы */
  bad: number;
  /** серия заданий подряд с 100% */
  streak: number;
  bestStreak: number;
  lastTaskId: string | null;
}

const KEY = "pravopisimo-progress-v1";

export function emptyProgress(): Progress {
  return { v: 1, tasks: {}, ok: 0, bad: 0, streak: 0, bestStreak: 0, lastTaskId: null };
}

export function loadProgress(): Progress {
  if (typeof window === "undefined") return emptyProgress();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const p = JSON.parse(raw) as Progress;
    if (!p || p.v !== 1 || typeof p.tasks !== "object") return emptyProgress();
    return { ...emptyProgress(), ...p };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* quota — ignore */
  }
}

/** Обновить прогресс после завершения задания. Точность 0..1 */
export function applyResult(p: Progress, taskId: string, accuracy: number, ok: number, bad: number): Progress {
  const prev = p.tasks[taskId];
  const task: TaskProgress = {
    best: Math.max(prev?.best ?? 0, accuracy),
    attempts: (prev?.attempts ?? 0) + 1,
    completed: true,
    lastAt: Date.now(),
  };
  const streak = accuracy >= 0.9999 ? p.streak + 1 : 0;
  const next: Progress = {
    ...p,
    tasks: { ...p.tasks, [taskId]: task },
    ok: p.ok + ok,
    bad: p.bad + bad,
    streak,
    bestStreak: Math.max(p.bestStreak, streak),
    lastTaskId: taskId,
  };
  saveProgress(next);
  return next;
}

export function touchLastTask(p: Progress, taskId: string): Progress {
  if (p.lastTaskId === taskId) return p;
  const next = { ...p, lastTaskId: taskId };
  saveProgress(next);
  return next;
}

export function progressStats(p: Progress) {
  const total = Object.keys(p.tasks).length;
  const perfect = Object.values(p.tasks).filter((t) => t.best >= 0.9999).length;
  const letters = p.ok + p.bad;
  const accuracy = letters > 0 ? p.ok / letters : null;
  return { done: total, perfect, letters, accuracy };
}
