const MAX_RELEVANT_CHARACTERS = 30_000;

const EVIDENCE_TERMS = [
  "agreement",
  "appointment",
  "asset",
  "beneficiary",
  "business",
  "control",
  "distribution",
  "estate",
  "funding",
  "governing",
  "inheritance",
  "interest",
  "ownership",
  "partnership",
  "power",
  "shareholder",
  "succession",
  "tax",
  "transfer",
  "trust",
  "withdrawal",
];

const QUESTION_STOP_WORDS = new Set([
  "about",
  "could",
  "determine",
  "does",
  "from",
  "have",
  "materially",
  "planning",
  "question",
  "should",
  "that",
  "their",
  "there",
  "these",
  "this",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
  "your",
]);

export function selectStageRelevantEvidence(text: string, planningQuestion: string) {
  const questionTerms = planningQuestion
    .toLowerCase()
    .match(/[a-z][a-z-]{3,}/g)
    ?.filter((term) => !QUESTION_STOP_WORDS.has(term)) ?? [];
  const terms = [...new Set([...EVIDENCE_TERMS, ...questionTerms])];
  const lines = text
    .replace(/\u0000/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const relevant = lines
    .filter((line) => {
      const normalized = line.toLowerCase();
      const instructionLike =
        /(ignore (all|any|the|previous|prior)|system prompt|application workflow|developer message|tool behavior|generate (a|the) final)/.test(
          normalized,
        );
      return !instructionLike && terms.some((term) => normalized.includes(term));
    })
    .join("\n")
    .slice(0, MAX_RELEVANT_CHARACTERS)
    .trim();
  return relevant.length >= 40 ? relevant : null;
}
