import themes1 from "./themes-1.json";
import themes2 from "./themes-2.json";
import themes3 from "./themes-3.json";
import themes4 from "./themes-4.json";
import commonRaw from "./common-words.json";

export interface BaseSentence {
  en: string;
  ru: string;
  rule: string;
  words: Record<string, string[]>;
}

export interface Theme {
  id: string;
  title: string;
  level: number;
  vocab: Record<string, string[]>;
  sentences: BaseSentence[];
}

export type VocabMap = Record<string, string[]>;

export const themes: Theme[] = [...themes1, ...themes2, ...themes3, ...themes4] as unknown as Theme[];

export const commonWords = commonRaw as VocabMap;
