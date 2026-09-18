import type { Grammar } from "../core/types.js";

const lexicalTagSet = new Set(["transitive", "intransitive", "reflexive", "irregular"]);
const knownTags = new Set([
  "masculine", "feminine", "singular", "plural",
  "first-person", "second-person", "third-person",
  "present", "imperfect", "future", "past", "perfect",
  "form-of", ...lexicalTagSet,
]);

function oneValue<T extends string>(tags: string[], values: readonly T[]): T | undefined {
  const present = values.filter((value) => tags.includes(value));
  return present.length === 1 ? present[0] : undefined;
}

export function mapItalianTags(tags: string[] = [], rawTags: string[] = []): Grammar {
  const rawPerson = rawTags.flatMap((tag) => {
    const normalized = tag.trim().toLocaleLowerCase("it-IT");
    if (["io"].includes(normalized)) return ["first"] as const;
    if (["tu"].includes(normalized)) return ["second"] as const;
    if (["lui", "lei", "lui/lei", "egli", "ella", "essi/esse", "loro"].includes(normalized)) return ["third"] as const;
    return [] as const;
  });
  const structuredPerson = oneValue(tags, ["first-person", "second-person", "third-person"] as const)?.replace("-person", "") as Grammar["person"] | undefined;
  const rawPersonValue = rawPerson.length === 1 ? rawPerson[0] : undefined;

  return {
    gender: oneValue(tags, ["masculine", "feminine"] as const),
    number: oneValue(tags, ["singular", "plural"] as const),
    person: structuredPerson ?? rawPersonValue,
    tense: oneValue(tags, ["present", "imperfect", "future", "past", "perfect"] as const),
    lexicalTags: tags.filter((tag) => lexicalTagSet.has(tag)),
    unknownTags: tags.filter((tag) => !knownTags.has(tag)),
    rawTags,
  };
}

export function grammarSignature(grammar: Grammar): string {
  return [grammar.gender ?? "", grammar.number ?? "", grammar.person ?? "", grammar.tense ?? "", ...grammar.lexicalTags.slice().sort()].join("|");
}

export function hasExplicitNounGrammar(grammar: Grammar): grammar is Grammar & { gender: "masculine" | "feminine"; number: "singular" | "plural" } {
  return Boolean(grammar.gender && grammar.number);
}

export function hasUsefulVerbClassification(grammar: Grammar): boolean {
  return Boolean(grammar.person || grammar.number || grammar.tense);
}
