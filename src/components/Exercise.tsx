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
  const totalLetters = parsed.letters.length;

  const [rawInput, setRawInput] = useState("");
  const [done, setDone] = useState<DoneInfo | null>(null);
  const [showRule, setShowRule] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [sel, setSel] = useState<{
    word: string;
    lookup: WordLookup;
    idx: number;
    x: number;
    y: number; // верх слова
    y2: number; // низ слова
    w: number;
  } | null>(null);

  // Извлекаем только буквы из сырого ввода пользователя
  const typed = useMemo(() => {
    const letters = rawInput.match(LETTER_RE) || [];
    return letters.slice(0, totalLetters);
  }, [rawInput, totalLetters]);

  const typedRef = useRef(typed);
  typedRef.current = typed;
  const rawInputRef = useRef(rawInput);
  rawInputRef.current = rawInput;
  const doneRef = useRef(done);
  doneRef.current = done;
  const ruleRef = useRef(showRule);
  ruleRef.current = showRule;
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const inputRef = useRef<HTMLInputElement>(null);
  const curCellRef = useRef<HTMLDivElement>(null);

  const okNow = useMemo(
    () => typed.filter((ch, i) => ch === parsed.letters[i]).length,
    [typed, parsed]
  );
  const badNow = typed.length - okNow;

  const finish = () => {
    if (doneRef.current) return;
    const info = finishCalc(parsed.letters, parsed.groups, typedRef.current);
    setDone(info);
    setSel(null);
    onResultRef.current(ex.id, info.accuracy, info.ok, info.bad);
  };

  const reset = () => {
    setRawInput("");
    setDone(null);
    inputRef.current?.focus();
  };

  const focusInput = () => {
    if (!done) {
      inputRef.current?.focus();
    }
  };

  // Автоматический фокус при смене задания
  useEffect(() => {
    setRawInput("");
    setDone(null);
    setSel(null);
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [ex.id]);

  // Обработка изменений в реальном поле ввода (для мобильных Android/iOS и десктопа)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (doneRef.current || ruleRef.current) return;
    const val = e.target.value;

    // Извлекаем буквы
    const letters = val.match(LETTER_RE) || [];
    if (letters.length > totalLetters) {
      // Не позволяем вводить лишние буквы сверх лимита задания
      return;
    }
    setRawInput(val);
  };

  // Обработка специальных клавиш на поле ввода
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (doneRef.current || ruleRef.current) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (typedRef.current.length > 0) {
        finish();
      }
    }
  };

  // Глобальный перехватчик для десктопа (если поле случайно потеряло фокус)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (doneRef.current || ruleRef.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Если ввод уже происходит в инпуте, не дублируем
      if (document.activeElement === inputRef.current) return;

      if (e.key === "Backspace") {
        e.preventDefault();
        setRawInput((r) => r.slice(0, -1));
        inputRef.current?.focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (typedRef.current.length > 0) finish();
      } else if (e.key.length === 1) {
        e.preventDefault();
        setRawInput((r) => {
          const letters = (r + e.key).match(LETTER_RE) || [];
          return letters.length <= totalLetters ? r + e.key : r;
        });
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex.id, totalLetters]);

  // Автоскролл к текущей букве
  useEffect(() => {
    curCellRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [typed.length]);

  const handleWordClick = (word: string, idx: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (done) return;
    const lookup = lookupWord(word, ex.id);
    const r = e.currentTarget.getBoundingClientRect();
    setSel({ word, lookup, idx, x: r.left, y: r.top, y2: r.bottom, w: r.width });
  };

  // Мобильные быстрые кнопки
  const handleMobileBackspace = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRawInput((r) => r.slice(0, -1));
    focusInput();
  };

  const handleMobileSpace = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRawInput((r) => r + " ");
    focusInput();
  };

  // Позиция попапа (fixed, к viewport)
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
      {/* Верхняя панель */}
      <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4">
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
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 text-xs font-semibold text-ink-soft transition hover:border-ink/30 hover:text-ink sm:px-3 sm:text-sm"
            >
              <IconRefresh className="h-4 w-4" /> Перезаписать
            </button>
          )}
          {!done && (
            <button
              onClick={finish}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-bad/30 bg-bad-soft px-2.5 text-xs font-semibold text-bad-deep transition hover:border-bad/60 sm:px-3 sm:text-sm"
            >
              <IconX className="h-4 w-4" /> Сдаться
            </button>
          )}
          <button
            onClick={onNext}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 text-xs font-semibold text-ink-soft transition hover:border-ink/30 hover:text-ink sm:px-3 sm:text-sm"
          >
            Следующее <IconNext className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Левая колонка */}
        <div className="min-w-0 space-y-3 sm:space-y-4">
          {/* Эталон */}
          <Card className="p-3.5 sm:p-4 md:p-5">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted">
              <IconBook className="h-3.5 w-3.5" />
              Прочитай и нажми на любое слово
            </div>
            <p className="font-display text-[18px] font-semibold leading-[1.75] text-ink sm:text-[19px] md:text-[22px]">
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

          {/* Лист для письма */}
          <Card
            className="relative cursor-text p-3 pl-6 transition-all sm:p-4 sm:pl-9 md:p-5 md:pl-12"
            onClick={focusInput}
          >
            {/* Красная вертикальная поля-линия школьной тетради */}
            <div className="pointer-events-none absolute inset-y-0 left-3.5 w-px bg-bad/25 sm:left-6 md:left-9" />

            {/* Мобильная плашка активации клавиатуры (для Android и iOS) */}
            <div className="mb-3 sm:hidden">
              <button
                type="button"
                onClick={focusInput}
                className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-xs font-bold transition ${
                  isFocused
                    ? "border-good/50 bg-good-soft text-good-deep"
                    : "border-primary/50 bg-primary-soft text-primary-deep shadow-sm"
                }`}
              >
                <span className="flex items-center gap-2">
                  <IconKeyboard className="h-4 w-4" />
                  {isFocused ? "Клавиатура активна (печатайте)" : "Нажмите, чтобы открыть клавиатуру"}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                    isFocused ? "bg-good text-card" : "bg-primary text-card"
                  }`}
                >
                  {isFocused ? "Активна" : "Открыть ⌨️"}
                </span>
              </button>
            </div>

            {/* Шапка листа */}
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="hidden items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted sm:flex">
                <IconKeyboard className="h-3.5 w-3.5" />
                Перепиши с клавиатуры
              </div>
              <div className="flex min-w-[120px] flex-1 items-center gap-2">
                <Bar value={typed.length / Math.max(1, totalLetters)} className="max-w-[220px]" />
                <span className="whitespace-nowrap text-[11px] font-bold text-ink-soft">
                  {typed.length}/{totalLetters}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-[11px] font-bold">
                <span className="text-good-deep">верно {okNow}</span>
                <span className={badNow > 0 ? "text-bad-deep" : "text-muted/60"}>ошибок {badNow}</span>
                {best !== null && <span className="hidden text-muted sm:inline">лучший: {Math.round(best * 100)}%</span>}
              </div>
            </div>

            {/* Контейнер ячеек с прозрачным инпутом для гарантированного открытия виртуальной клавиатуры Android */}
            <div className="relative flex flex-wrap items-center gap-x-2.5 gap-y-2.5 rounded-lg p-1 sm:gap-x-4 sm:gap-y-3 sm:p-2">
              {/* Реальное поле ввода: покрывает всю область ячеек, прозрачно, перехватывает клики и жесты на мобильном */}
              <input
                ref={inputRef}
                type="text"
                inputMode="text"
                autoCapitalize="sentences"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                value={rawInput}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0 text-base"
                aria-label="Поле для ввода предложения"
              />

              {parsed.groups.map((g, gi) => (
                <div key={gi} className="flex items-center gap-[2px] sm:gap-[3px]">
                  {g.slots.map((s, si) => {
                    if (s.letterIndex === -1) {
                      return (
                        <span
                          key={si}
                          className="flex h-full items-center px-[1px] font-mono text-base text-ink-soft/60 sm:text-lg"
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
                          "flex h-8 w-[22px] items-center justify-center rounded border font-mono text-[15px] sm:h-9 sm:w-[26px] sm:rounded-md sm:text-[17px] md:h-[42px] md:w-[31px] md:text-[20px]",
                          t
                            ? ok
                              ? "border-good/40 bg-good-soft text-good-deep"
                              : "border-bad/40 bg-bad-soft text-bad-deep"
                            : isCur
                              ? "border-amber bg-amber-soft/50 ring-2 ring-amber/30"
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

            {/* Мобильная панель быстрых действий (нажатия пальцем без закрытия клавиатуры) */}
            <div className="relative z-20 mt-3 flex items-center justify-between gap-1.5 border-t border-line-soft pt-2.5 sm:hidden">
              <button
                type="button"
                onClick={handleMobileBackspace}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-line bg-card py-2 text-xs font-bold text-ink-soft active:bg-line-soft"
              >
                ⌫ Стереть
              </button>
              <button
                type="button"
                onClick={handleMobileSpace}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-line bg-card py-2 text-xs font-bold text-ink-soft active:bg-line-soft"
              >
                ␣ Пробел
              </button>
              <button
                type="button"
                onClick={focusInput}
                className="inline-flex items-center justify-center rounded-lg border border-line bg-card px-3 py-2 text-xs font-bold text-ink-soft active:bg-line-soft"
                title="Активировать клавиатуру"
              >
                ⌨️
              </button>
              <button
                type="button"
                onClick={finish}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary py-2 text-xs font-bold text-card active:bg-primary-deep"
              >
                ↵ Готово
              </button>
            </div>

            {/* Подсказки для десктопа */}
            <div className="mt-3 hidden flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-muted sm:flex">
              <span>
                <Kbd>Enter</Kbd> — закончить
              </span>
              <span>
                <Kbd>Backspace</Kbd> — стереть
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-[3px] border border-good/40 bg-good-soft" />
                верно
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-[3px] border border-bad/40 bg-bad-soft" />
                ошибка
              </span>
              <span>регистр важен: первые буквы — заглавные</span>
            </div>
          </Card>
        </div>

        {/* Правая колонка */}
        <div className="space-y-3 sm:space-y-4">
          <Card className="p-3.5 sm:p-4">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
              Полный перевод
            </div>
            {ex.length > 1 ? (
              <ol className="space-y-1.5 text-[14px] leading-relaxed text-ink-soft sm:text-[15px]">
                {ex.parts.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-px w-4 shrink-0 text-right font-mono text-xs text-muted">{i + 1}</span>
                    {p.ru}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[14px] leading-relaxed text-ink-soft sm:text-[15px]">{ex.ru}</p>
            )}
          </Card>

          <Card className="p-3.5 sm:p-4">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">Слово</div>
            {sel ? (
              <div className="animate-fade">
                <div className="mb-1.5 font-display text-lg font-bold text-ink">{sel.word}</div>
                <WordMeanings lookup={sel.lookup} word={sel.word} />
              </div>
            ) : (
              <div className="text-xs leading-relaxed text-muted sm:text-sm">
                Нажми на любое английское слово в предложении слева — здесь появится его перевод: значение в этом
                предложении и другие популярные варианты.
              </div>
            )}
          </Card>

          <button
            onClick={() => setShowRule(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 text-xs font-bold text-primary-deep transition hover:border-primary/60 sm:text-sm"
          >
            <IconInfo className="h-4 w-4" /> Подробнее: как построено предложение
          </button>
        </div>
      </div>

      {/* Попап значения слова */}
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

      {/* Модалка правил */}
      {showRule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px]"
          onClick={() => setShowRule(false)}
        >
          <Card
            className="max-h-[85vh] w-full max-w-lg animate-pop overflow-y-auto p-4 sm:p-5"
            onClick={(e) => e.stopPropagation()}
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

      {/* Модалка результата */}
      {done && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px]">
          <Card className="w-full max-w-md animate-pop p-4 sm:p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-display text-xl font-bold sm:h-16 sm:w-16 sm:text-2xl ${
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
                <div className="font-display text-base font-bold text-ink sm:text-lg">
                  {done.accuracy >= 1
                    ? "Без ошибок!"
                    : done.accuracy >= 0.85
                      ? "Почти идеально"
                      : "Стоит повторить"}
                </div>
                <div className="text-xs text-muted sm:text-sm">
                  верно {done.ok} из {totalLetters} букв · ошибок: {done.bad}
                </div>
              </div>
            </div>

            {done.errors.length > 0 && (
              <div className="mt-4 max-h-48 space-y-2 overflow-y-auto pr-1 sm:max-h-56">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  Где были ошибки
                </div>
                {done.errors.slice(0, 8).map((e, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line-soft bg-card-2/70 px-2.5 py-1.5 sm:px-3 sm:py-2"
                  >
                    <span className="font-mono text-[14px] font-semibold tracking-wide sm:text-[15px]">
                      {e.typed.map((c, j) => (
                        <span key={j} className={c.ok ? "text-ink-soft" : "text-bad-deep underline"}>
                          {c.ok ? c.ch : c.ch || "·"}
                        </span>
                      ))}
                    </span>
                    <IconChevronRight className="h-3.5 w-3.5 text-muted" />
                    <span className="font-mono text-[14px] font-bold tracking-wide text-good-deep sm:text-[15px]">
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
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2.5 text-xs font-bold text-ink-soft transition hover:border-ink/30 hover:text-ink sm:gap-2 sm:px-4 sm:text-sm"
              >
                <IconRefresh className="h-4 w-4" /> Заново
              </button>
              <button
                onClick={onNext}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-card transition hover:bg-primary-deep sm:gap-2 sm:px-4 sm:text-sm"
              >
                Следующее <IconNext className="h-4 w-4" />
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
