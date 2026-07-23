// Two test characters sharing the same 5-trait engine and the same 4 pilot
// mechanics, but wired up differently enough that the system's variety
// actually shows: different intensity tolerance, different boredom speed,
// different preferred implements, different chapter arc. Not a palette
// swap — see feedback memory on manual/bespoke design.
export type IntensityTolerance = "low" | "high";
export type BoredomRate = "fast" | "slow";

export type CharacterDefinition = {
  id: string;
  name: string;
  tagline: string;
  bio: string;
  preferredNote: string;
  dislikedNote: string;
  preferredImplementIds: string[];
  // Signature color for menu/dashboard cards — distinct from HEAT_STAGES
  // colors (which are shared, state-driven, and only apply in-game).
  accentColor: string;
  // "low" = overwhelms easily, needs a gentle ramp (Рин); "high" = needs
  // real intensity to register Pleasure at all, gentle-only reads as boring
  // to her specifically (Ада).
  intensityTolerance: IntensityTolerance;
  boredomRate: BoredomRate;
  gameIds: string[];
};

export const CHARACTERS: CharacterDefinition[] = [
  {
    id: "rin",
    name: "Рин",
    tagline: "Новенькая, любопытная",
    bio:
      "Это её первый настоящий опыт — она выбрала именно вас, понаблюдав издалека несколько недель, прежде чем решиться написать первой. Она ещё не до конца понимает, чего хочет сама, и учится доверять этому желанию по ходу дела.",
    preferredNote: "Ей важнее постепенность, чем сила — раскрывается медленно, но искренне.",
    dislikedNote: "Не любит, когда сразу переходят к жёсткому — ей нужно разогреться постепенно.",
    preferredImplementIds: ["hand"],
    accentColor: "#f9a8d4",
    intensityTolerance: "low",
    boredomRate: "fast",
    gameIds: ["pilot-a", "pilot-c", "pilot-e", "pilot-f"],
  },
  {
    id: "ada",
    name: "Ада",
    tagline: "С опытом, себе на уме",
    bio:
      "У неё уже были партнёры до вас — и она об этом не молчит. Каждая встреча немного похожа на экзамен: докажите, что вы не такой, как остальные, а не просто повторяете чужой сценарий.",
    preferredNote: "Ей нужна настоящая интенсивность, чтобы это вообще было интересно.",
    dislikedNote: "Скучает от слишком осторожной, робкой игры — вялость её не заводит, а раздражает.",
    preferredImplementIds: ["paddle", "flogger"],
    accentColor: "#7c3aed",
    intensityTolerance: "high",
    boredomRate: "slow",
    gameIds: ["pilot-b", "pilot-d"],
  },
];

export function getCharacter(characterId: string): CharacterDefinition | undefined {
  return CHARACTERS.find((c) => c.id === characterId);
}

export function getCharacterForGame(gameId: string): CharacterDefinition | undefined {
  return CHARACTERS.find((c) => c.gameIds.includes(gameId));
}
