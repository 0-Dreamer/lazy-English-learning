import { themes, commonWords, type VocabMap } from "@/data";

export type TypeLabel = "Предложение" | "Два предложения" | "Мини-сцена" | "Мини-история" | "История";

export interface ExercisePart {
  en: string;
  ru: string;
  rule: string;
}

export interface Exercise {
  id: string;
  themeId: string;
  themeTitle: string;
  level: number;
  typeLabel: TypeLabel;
  /** Полный английский текст задания */
  en: string;
  /** Полный перевод */
  ru: string;
  /** Правила по каждому предложению */
  parts: ExercisePart[];
  /** Сколько букв нужно набрать */
  letters: number;
  /** Сколько слов в тексте */
  words: number;
  /** Сколько предложений */
  length: number;
}

const WORD_RE = /[0-9A-Za-zÀ-ÿ][0-9A-Za-zÀ-ÿ'’-]*/g;
const LETTER_RE = /[A-Za-zÀ-ÿ]/;

function typeLabel(n: number): TypeLabel {
  if (n === 1) return "Предложение";
  if (n === 2) return "Два предложения";
  if (n === 3) return "Мини-сцена";
  if (n === 4) return "Мини-история";
  return "История";
}

function countLetters(text: string) {
  let n = 0;
  for (const ch of text) if (LETTER_RE.test(ch)) n++;
  return n;
}

export function countWords(text: string) {
  const m = text.match(WORD_RE);
  return m ? m.length : 0;
}

export function tokenize(text: string): string[] {
  const m = text.match(WORD_RE);
  return m ? m : [];
}

/** Слои словаря: общее (низ) → тема → предложения (верх) */
const overlayData = new Map<string, VocabMap>();
const contextualData = new Map<string, Set<string>>();

function buildExercise(themeId: string, indices: number[]): Exercise {
  const theme = themes.find((t) => t.id === themeId)!;
  const picks = indices.map((i) => theme.sentences[i]);
  const en = picks.map((s) => s.en).join(" ");
  const ru = picks.map((s) => s.ru).join(" ");
  const parts: ExercisePart[] = picks.map((s) => ({ en: s.en, ru: s.ru, rule: s.rule }));

  const overlay: VocabMap = {};
  const contextual = new Set<string>();
  for (const [k, v] of Object.entries(theme.vocab)) {
    overlay[k.toLowerCase()] = v;
    contextual.add(k.toLowerCase());
  }
  for (const s of picks) {
    for (const [k, v] of Object.entries(s.words)) {
      overlay[k.toLowerCase()] = v;
      contextual.add(k.toLowerCase());
    }
  }

  const id = `${themeId}-${indices.join("_")}`;
  overlayData.set(id, overlay);
  contextualData.set(id, contextual);

  return {
    id,
    themeId,
    themeTitle: theme.title,
    level: theme.level,
    typeLabel: typeLabel(picks.length),
    en,
    ru,
    parts,
    letters: countLetters(en),
    words: countWords(en),
    length: picks.length,
  };
}

let cache: Exercise[] | null = null;

export function allExercises(): Exercise[] {
  if (cache) return cache;
  const list: Exercise[] = [];
  for (const theme of themes) {
    const n = theme.sentences.length;
    const specs: number[][] = [];
    // одиночные предложения
    for (let i = 0; i < n; i++) specs.push([i]);
    // пары со сдвигом 1..5
    for (let off = 1; off <= 5; off++) for (let i = 0; i + off < n; i++) specs.push([i, i + off]);
    // последовательные окна длины 3..n (мини-сцены и истории)
    for (let len = 3; len <= n; len++)
      for (let i = 0; i + len <= n; i++) specs.push([...Array(len).keys()].map((k) => i + k));
    for (const spec of specs) list.push(buildExercise(theme.id, spec));
  }
  cache = list;
  return list;
}

/** Кандидаты для морфологического угадывания */
export function stemCandidates(w: string): string[] {
  const out: string[] = [];
  const push = (x: string, minLen = 2) => {
    if (x && x.length >= minLen && !out.includes(x)) out.push(x);
  };
  push(w, 1);
  push(w.replace(/['’]/g, ""), 1);
  push(w.normalize("NFD").replace(/[\u0300-\u036f]/g, ""), 1);
  if (w.endsWith("s") && !w.endsWith("ss")) push(w.slice(0, -1));
  if (w.endsWith("es") && !w.endsWith("ses")) push(w.slice(0, -2));
  if (w.endsWith("ed")) {
    push(w.slice(0, -2));
    if (!w.endsWith("eed")) push(w.slice(0, -1));
  }
  if (w.endsWith("ing")) {
    const b = w.slice(0, -3);
    push(b);
    push(b + "e");
    push(b.slice(0, -1));
    if (b.endsWith("c")) push(b.slice(0, -1) + "k");
  }
  if (w.endsWith("ly")) push(w.slice(0, -2));
  if (w.endsWith("er") && w.length > 4) push(w.slice(0, -2));
  if (w.endsWith("est") && w.length > 5) push(w.slice(0, -3));
  return out;
}

export interface WordLookup {
  key: string | null;
  meanings: string[];
  contextual: boolean;
}

export function lookupWord(raw: string, exId: string): WordLookup {
  const w = raw.toLowerCase();
  const overlay = overlayData.get(exId) ?? {};
  const ctx = contextualData.get(exId) ?? new Set<string>();
  for (const cand of stemCandidates(w)) {
    if (overlay[cand]) return { key: cand, meanings: overlay[cand], contextual: ctx.has(cand) };
    if (commonWords[cand]) return { key: cand, meanings: commonWords[cand], contextual: false };
  }
  return { key: null, meanings: [], contextual: false };
}
