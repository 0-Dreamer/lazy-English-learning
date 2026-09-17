import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Exercise } from "@/lib/exercises";
import { lookupWord, type WordLookup } from "@/lib/exercises";
import { Bar, Card, LevelChip, TypeChip } from "./bits";
import {
  IconBack,
  IconBook,
  IconCheck,
  IconChevronRight,
  IconInfo,
  IconKeyboard,
  IconNext,
  IconRefresh,
  IconX,
} from "./icons";

const LETTER_RE = /[A-Za-zÀ-ÿ]/;
const WORD_SPLIT = /([0-9A-Za-zÀ-ÿ][0-9A-Za-zÀ-ÿ'’-]*)/g;

interface Slot {
  ch: string;
  letterIndex: number; // -1 для знаков препинания
}

interface Group {
  slots: Slot[];
  wordStart: number; // первая буква группы (индекс в letters)
  wordEnd: number; // последняя буква (включительно)
}

function parseText(text: string): { groups: Group[]; letters: string[] } {
  const groups: Group[] = [];
  const letters: string[] = [];
  let cur: Slot[] = [];
  let curStart = -1;
  let curEnd = -1;
  const flush = () => {
    if (cur.length > 0) {
      groups.push({ slots: cur, wordStart: curStart, wordEnd: curEnd });
      cur = [];
      curStart = -1;
      curEnd = -1;
    }
  };
  for (const ch of text) {
    if (ch === " ") {
      flush();
    } else if (LETTER_RE.test(ch)) {
      if (curStart === -1) curStart = letters.length;
      cur.push({ ch, letterIndex: letters.length });
      letters.push(ch);
      curEnd = letters.length - 1;
    } else {
      cur.push({ ch, letterIndex: -1 });
    }
  }
  flush();
  return { groups, letters };
}

interface DoneInfo {
  accuracy: number;
  ok: number;
  bad: number;
  errors: { correct: string; typed: { ch: string; ok: boolean }[] }[];
}

function finishCalc(letters: string[], groups: Group[], typed: string[]): DoneInfo {
  let ok = 0;
  for (let i = 0; i < letters.length; i++) if (typed[i] === letters[i]) ok++;

  const errors: DoneInfo["errors"] = [];
  for (const g of groups) {
    if (g.wordStart === -1) continue;
    const typedArr: { ch: string; ok: boolean }[] = [];
    let anyBad = false;
    for (let i = g.wordStart; i <= g.wordEnd; i++) {
      const t = typed[i];
      const isOk = t === letters[i];
      if (!isOk) anyBad = true;
      typedArr.push({ ch: t ?? "", ok: isOk });
    }
    if (anyBad) {
      errors.push({ correct: letters.slice(g.wordStart, g.wordEnd + 1).join(""), typed: typedArr });
    }
  }

  const total = letters.length;
  return { accuracy: total ? ok / total : 1, ok, bad: total - ok, errors };
}

function WordMeanings({ lookup, word }: { lookup: WordLookup; word: string }) {
  if (!lookup.key) {
    return (
      <div className="text-sm leading-relaxed text-muted">
        Значение слова <span className="font-semibold text-ink-soft">«{word.toLowerCase()}»</span> пока
        не добавлено в словарь. Попробуй другое слово.
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {lookup.key !== word.toLowerCase() && (
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          основа: {lookup.key}
        </div>
      )}
      <ul className="space-y-1">
        {lookup.meanings.map((m, i) => (
          <li key={i} className="flex gap-2 text-sm leading-snug">
            <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${i === 0 ? "bg-primary" : "bg-line"}`} />
            <span className={i === 0 ? "font-semibold text-ink" : "text-ink-soft"}>{m}</span>
          </li>
        ))}
      </ul>
      {lookup.contextual && (
        <div className="text-[11px] text-muted">первое значение — для этого предложения</div>
      )}
    </div>
  );
}

interface Props {
  ex: Exercise;
  index: number;
  total: number;
  best: number | null;
  onBack: () => void;
  onNext: () => void;
  onResult: (taskId: string, accuracy: number, ok: number, bad: number) => void;
}

export default function Exercise({ ex, index, total, best, onBack, onNext, onResult }: Props) {
  const parsed = useMemo(() => parseText(ex.en), [ex.id]);
  const [typed, setTyped] = useState<string[]>([]);
  const [done, setDone] = useState<DoneInfo | null>(null);
  const [showRule, setShowRule] = useState(false);
  const [sel, setSel] = useState<{
    word: string;
    lookup: WordLookup;
    idx: number;
    x: number;
    y: number; // верх слова
    y2: number; // низ слова
    w: number;
  } | null>(null);

  const typedRef = useRef(typed);
  typedRef.current = typed;
  const doneRef = useRef(done);
  doneRef.current = done;
  const ruleRef = useRef(showRule);
  ruleRef.current = showRule;
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const curCellRef = useRef<HTMLDivElement>(null);

  const totalLetters = parsed.letters.length;
  const okNow = useMemo(
    () => typed.filter((ch, i) => ch === parsed.letters[i]).length,
    [typed, parsed]
  );
  const badNow = typed.length - okNow;

  const finish = (arr: string[]) => {
    if (doneRef.current) return;
    const info = finishCalc(parsed.letters, parsed.groups, arr);
    setDone(info);
    setSel(null);
    onResultRef.current(ex.id, info.accuracy, info.ok, info.bad);
  };

  const reset = () => {
    setTyped([]);
    setDone(null);
  };

  // клавиатура
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (doneRef.current || ruleRef.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Backspace") {
        e.preventDefault();
        setTyped((t) => t.slice(0, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (typedRef.current.length > 0) finish(typedRef.current);
      } else if (e.key.length === 1 && !e.repeat) {
        e.preventDefault();
        setTyped((t) => (t.length >= totalLetters ? t : [...t, e.key]));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex.id, totalLetters]);

  // автоскролл к текущей ячейке
  useEffect(() => {
    curCellRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [typed.length]);

  // сброс при смене задания
  useEffect(() => {
    setTyped([]);
    setDone(null);
    setSel(null);
  }, [ex.id]);

  const handleWordClick = (word: string, idx: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (done) return;
    const lookup = lookupWord(word, ex.id);
    const r = e.currentTarget.getBoundingClientRect();
    setSel({ word, lookup, idx, x: r.left, y: r.top, y2: r.bottom, w: r.width });
  };

  // позиция попапа (fixed, к viewport)
  let popStyle: React.CSSProperties = { left: 16, top: 16 };
  if (sel && typeof window !== "undefined") {
    const popW = Math.min(320, window.innerWidth - 24);
    const left = Math.min(Math.max(sel.x + sel.w / 2 - popW / 2, 12), window.innerWidth - popW - 12);
    const below = sel.y2 + 300 < window.innerHeight;
    popStyle = below
      ? { left, width: popW, top: sel.y2 + 8 }
      : { left, width: popW, bottom: Math.max(12, window.innerHeight - sel.y + 8) };
  }

  const refParts = useMemo(() => ex.en.split(WORD_SPLIT), [ex.id]);

  return (
    <div className="animate-fade">
      {/* верхняя панель */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={onBack}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-sm font-semibold text-ink-soft transition hover:border-ink/30 hover:text-ink"
        >
          <IconBack className="h-4 w-4" /> Назад
        </button>
        <div className="hidden h-6 w-px bg-line sm:block" />
        <div className="flex flex-wrap items-center gap-1.5">
          <LevelChip level={ex.level} compact />
          <TypeChip label={ex.typeLabel} />
          <span className="text-[11px] font-semibold text-muted">{ex.themeTitle}</span>
        </div>
        <span className="ml-auto text-xs font-bold text-muted">
          Задание {index + 1} из {total}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {!done && typed.length > 0 && (
            <button
              onClick={reset}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-sm font-semibold text-ink-soft transition hover:border-ink/30 hover:text-ink"
            >
              <IconRefresh className="h-4 w-4" /> Перезаписать
            </button>
          )}
          {!done && (
            <button
              onClick={() => finish(typedRef.current)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-bad/30 bg-bad-soft px-3 text-sm font-semibold text-bad-deep transition hover:border-bad/60"
            >
              <IconX className="h-4 w-4" /> Сдаться
            </button>
          )}
          <button
            onClick={onNext}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-sm font-semibold text-ink-soft transition hover:border-ink/30 hover:text-ink"
          >
            Следующее <IconNext className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* левая колонка */}
        <div className="min-w-0 space-y-4">
          {/* эталон */}
          <Card className="p-4 md:p-5">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted">
              <IconBook className="h-3.5 w-3.5" />
              Прочитай и нажми на любое слово
            </div>
            <p className="font-display text-[19px] font-semibold leading-[1.75] text-ink md:text-[22px]">
              {refParts.map((part, i) => {
                const isWord = /^[0-9A-Za-zÀ-ÿ]/.test(part);
                if (!isWord) return <span key={i}>{part}</span>;
                const selected = sel?.idx === i;
                return (
                  <button
                    key={i}
                    onClick={(e) => handleWordClick(part, i, e)}
                    className={`-mx-0.5 rounded-md px-0.5 transition ${
                      selected ? "bg-amber-soft shadow-[0_0_0_1.5px_var(--color-amber)]" : "hover:bg-line-soft"
                    }`}
                  >
                    {part}
                  </button>
                );
              })}
            </p>
          </Card>

          {/* лист для письма */}
          <Card className="relative p-4 pl-9 md:p-5 md:pl-12">
            <div className="pointer-events-none absolute inset-y-0 left-6 w-px bg-bad/25 md:left-9" />
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted">
                <IconKeyboard className="h-3.5 w-3.5" />
                Перепиши с клавиатуры
              </div>
              <div className="flex min-w-[140px] flex-1 items-center gap-2">
                <Bar value={typed.length / Math.max(1, totalLetters)} className="max-w-[220px]" />
                <span className="whitespace-nowrap text-[11px] font-bold text-ink-soft">
                  {typed.length}/{totalLetters}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-bold">
                <span className="text-good-deep">верно {okNow}</span>
                <span className={badNow > 0 ? "text-bad-deep" : "text-muted/60"}>ошибок {badNow}</span>
                {best !== null && <span className="text-muted">лучший: {Math.round(best * 100)}%</span>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg p-2">
              {parsed.groups.map((g, gi) => (
                <div key={gi} className="flex items-center gap-[3px]">
                  {g.slots.map((s, si) => {
                    if (s.letterIndex === -1) {
                      return (
                        <span
                          key={si}
                          className="flex h-full items-center px-[1px] font-mono text-lg text-ink-soft/60"
                        >
                          {s.ch}
                        </span>
                      );
                    }
                    const ti = s.letterIndex;
                    const isCur = ti === typed.length && !done;
                    const t = typed[ti];
                    const ok = t === s.ch;
                    const justTyped = ti === typed.length - 1;
                    return (
                      <div
                        key={si}
                        ref={isCur ? curCellRef : undefined}
                        className={[
                          "flex h-9 w-[26px] items-center justify-center rounded-md border font-mono text-[17px] md:h-[42px] md:w-[31px] md:text-[20px]",
                          t
                            ? ok
                              ? "border-good/40 bg-good-soft text-good-deep"
                              : "border-bad/40 bg-bad-soft text-bad-deep"
                            : isCur
                              ? "border-amber bg-amber-soft/50"
                              : "border-dashed border-line bg-card-2/60",
                          justTyped ? (ok ? "animate-cell" : "animate-shake") : "",
                        ].join(" ")}
                      >
                        {t ? (
                          <span>{t}</span>
                        ) : isCur ? (
                          <span className="animate-cursor h-4 w-[2px] rounded bg-amber" />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-muted">
              <span>
                <Kbd>Enter</Kbd> — закончить
              </span>
              <span>
                <Kbd>Backspace</Kbd> — стереть последнюю
              </span>
              <span className="hidden items-center gap-1 sm:flex">
                <span className="inline-block h-2.5 w-2.5 rounded-[3px] border border-good/40 bg-good-soft" />
                верно
              </span>
              <span className="hidden items-center gap-1 sm:flex">
                <span className="inline-block h-2.5 w-2.5 rounded-[3px] border border-bad/40 bg-bad-soft" />
                ошибка
              </span>
              <span>регистр важен: первые буквы — заглавные</span>
            </div>
          </Card>
        </div>

        {/* правая колонка */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
              Полный перевод
            </div>
            {ex.length > 1 ? (
              <ol className="space-y-1.5 text-[15px] leading-relaxed text-ink-soft">
                {ex.parts.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-px w-4 shrink-0 text-right font-mono text-xs text-muted">{i + 1}</span>
                    {p.ru}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[15px] leading-relaxed text-ink-soft">{ex.ru}</p>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">Слово</div>
            {sel ? (
              <div className="animate-fade">
                <div className="mb-1.5 font-display text-lg font-bold text-ink">{sel.word}</div>
                <WordMeanings lookup={sel.lookup} word={sel.word} />
              </div>
            ) : (
              <div className="text-sm leading-relaxed text-muted">
                Нажми на английское слово слева — здесь появится его перевод: значение в этом
                предложении и другие популярные.
              </div>
            )}
          </Card>

          <button
            onClick={() => setShowRule(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm font-bold text-primary-deep transition hover:border-primary/60"
          >
            <IconInfo className="h-4 w-4" /> Подробнее: как построено предложение
          </button>
        </div>
      </div>

      {/* попап значения слова */}
      {sel && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setSel(null)} />
          <div
            className="fixed z-40 animate-pop rounded-xl border border-line bg-card p-3 shadow-[0_10px_30px_-10px_rgba(38,34,25,0.4)]"
            style={popStyle}
          >
            <div className="mb-1.5 flex items-start justify-between gap-3">
              <div className="font-display text-lg font-bold text-ink">{sel.word}</div>
              <button
                onClick={() => setSel(null)}
                className="rounded-md p-1 text-muted transition hover:bg-line-soft hover:text-ink"
                aria-label="Закрыть"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            </div>
            <WordMeanings lookup={sel.lookup} word={sel.word} />
          </div>
        </>
      )}

      {/* модалка правил */}
      {showRule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px]"
          onClick={() => setShowRule(false)}
        >
          <Card
            className="max-h-[85vh] w-full max-w-lg animate-pop overflow-y-auto p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  Как построены предложения
                </div>
                <div className="font-display text-lg font-bold text-ink">{ex.themeTitle}</div>
              </div>
              <button
                onClick={() => setShowRule(false)}
                className="rounded-lg border border-line p-2 text-muted transition hover:bg-line-soft hover:text-ink"
                aria-label="Закрыть"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              {ex.parts.map((p, i) => (
                <div key={i} className="rounded-lg border border-line-soft bg-card-2/70 p-3">
                  <div className="font-display text-[15px] font-semibold text-ink">{p.en}</div>
                  <div className="mt-0.5 text-[13px] text-muted">{p.ru}</div>
                  <div className="mt-2 flex gap-2 text-[13px] leading-relaxed text-ink-soft">
                    <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    {p.rule}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* модалка результата */}
      {done && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px]">
          <Card className="w-full max-w-md animate-pop p-5">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl font-display text-2xl font-bold ${
                  done.accuracy >= 1
                    ? "bg-good-soft text-good-deep"
                    : done.accuracy >= 0.85
                      ? "bg-amber-soft text-amber"
                      : "bg-bad-soft text-bad-deep"
                }`}
              >
                {Math.round(done.accuracy * 100)}%
              </div>
              <div className="min-w-0">
                <div className="font-display text-lg font-bold text-ink">
                  {done.accuracy >= 1
                    ? "Без ошибок!"
                    : done.accuracy >= 0.85
                      ? "Почти идеально"
                      : "Стоит повторить"}
                </div>
                <div className="text-sm text-muted">
                  верно {done.ok} из {totalLetters} букв · ошибок: {done.bad}
                </div>
              </div>
            </div>

            {done.errors.length > 0 && (
              <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  Где были ошибки
                </div>
                {done.errors.slice(0, 8).map((e, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line-soft bg-card-2/70 px-3 py-2"
                  >
                    <span className="font-mono text-[15px] font-semibold tracking-wide">
                      {e.typed.map((c, j) => (
                        <span key={j} className={c.ok ? "text-ink-soft" : "text-bad-deep underline"}>
                          {c.ok ? c.ch : c.ch || "·"}
                        </span>
                      ))}
                    </span>
                    <IconChevronRight className="h-3.5 w-3.5 text-muted" />
                    <span className="font-mono text-[15px] font-bold tracking-wide text-good-deep">
                      {e.correct}
                    </span>
                  </div>
                ))}
                {done.errors.length > 8 && (
                  <div className="text-xs font-semibold text-muted">
                    + ещё {done.errors.length - 8} слов
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={reset}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:border-ink/30 hover:text-ink"
              >
                <IconRefresh className="h-4 w-4" /> Попробовать снова
              </button>
              <button
                onClick={onNext}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-card transition hover:bg-primary-deep"
              >
                Следующее задание <IconNext className="h-4 w-4" />
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-card-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-soft">
      {children}
    </kbd>
  );
}
