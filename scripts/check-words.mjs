import { readFileSync, existsSync } from "node:fs";

const dir = "src/data";
const files = ["themes-1.json", "themes-2.json", "themes-3.json", "themes-4.json"];
const themes = files.map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8"))).flat();
let common = {};
if (existsSync(`${dir}/common-words.json`)) {
  common = JSON.parse(readFileSync(`${dir}/common-words.json`, "utf8"));
}

const known = new Set(Object.keys(common).map((k) => k.toLowerCase()));

// та же логика угадывания основы, что и в src/lib/exercises.ts
function candidates(w) {
  const out = [];
  const push = (x, min = 2) => {
    if (x && x.length >= min && !out.includes(x)) out.push(x);
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

const missing = new Map();
for (const t of themes) {
  const localKnown = new Set([...Object.keys(t.vocab || {}), ...t.sentences.flatMap((s) => Object.keys(s.words || {}))].map((k) => k.toLowerCase()));
  for (const s of t.sentences) {
    const tokens = s.en.match(/[0-9A-Za-zÀ-ÿ][0-9A-Za-zÀ-ÿ'’-]*/g) || [];
    for (const tok of tokens) {
      const w = tok.toLowerCase();
      if (/^\d+$/.test(w)) continue;
      if (localKnown.has(w)) continue;
      const found = candidates(w).some((c) => known.has(c));
      if (!found) missing.set(w, (missing.get(w) || 0) + 1);
    }
  }
}
const list = [...missing.entries()].sort((a, b) => b[1] - a[1]);
console.log(`Total unresolved words: ${list.length}`);
console.log(list.map(([w]) => w).join("\n"));
