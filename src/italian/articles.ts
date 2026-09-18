import type { ArticleDisplay } from "../core/types.js";

export interface ArticleResult {
  articles: ArticleDisplay[];
  withheldReason?: string;
}

function hasUnsupportedSurface(surface: string): boolean {
  return !surface || /[\s/\n]/u.test(surface) || !/^[\p{L}'-]+$/u.test(surface);
}

function initialClass(surface: string): "vowel" | "special" | "ordinary" {
  const value = surface.toLocaleLowerCase("it-IT");
  if (/^[aeiouàèéìòóù]/u.test(value)) return "vowel";
  if (/^(s[^aeiouàèéìòóù]|z|ps|gn|x|y)/u.test(value)) return "special";
  return "ordinary";
}

export function generateItalianArticles(surface: string, gender?: "masculine" | "feminine", number?: "singular" | "plural"): ArticleResult {
  if (!gender || !number) return { articles: [], withheldReason: "missing-or-ambiguous-gender-number" };
  if (hasUnsupportedSurface(surface)) return { articles: [], withheldReason: "unsupported-or-composite-surface" };

  const category = initialClass(surface);
  const make = (kind: ArticleDisplay["kind"], article: string): ArticleDisplay => ({
    kind,
    article,
    displayForm: article.endsWith("'") ? `${article}${surface}` : `${article} ${surface}`,
    gender,
    number,
    sourceType: "lexema-deterministic",
    rule: "it-articles/v1",
  });

  if (gender === "feminine" && number === "singular") {
    const vowel = category === "vowel";
    return { articles: [make("definite", vowel ? "l'" : "la"), make("indefinite", vowel ? "un'" : "una"), make("partitive", vowel ? "dell'" : "della")] };
  }
  if (gender === "feminine") return { articles: [make("definite", "le"), make("partitive", "delle")] };
  if (number === "singular") {
    const special = category === "special";
    const vowel = category === "vowel";
    return { articles: [make("definite", vowel ? "l'" : special ? "lo" : "il"), make("indefinite", special ? "uno" : "un"), make("partitive", vowel ? "dell'" : special ? "dello" : "del")] };
  }
  const special = category !== "ordinary";
  return { articles: [make("definite", special ? "gli" : "i"), make("partitive", special ? "degli" : "dei")] };
}
