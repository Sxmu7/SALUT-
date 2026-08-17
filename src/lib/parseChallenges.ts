import { Challenge, CategoryId, Difficulty } from "@/types";
import { uid } from "@/lib/utils";

const ICONS_BY_CATEGORY: Record<CategoryId, string> = {
  klassiker: "🍻",
  performance: "🎭",
  wissen: "🧠",
  mut: "🔥",
  team: "🤝",
  kreativ: "🎨",
};

const ANIMATIONS: Challenge["animation"][] = [
  "flip",
  "bounce",
  "shake",
  "pulse",
  "slide",
  "glow",
  "pop",
];

function guessDifficulty(points: number): Difficulty {
  if (points >= 80) return "legendary";
  if (points >= 50) return "hard";
  if (points >= 25) return "medium";
  return "easy";
}

/**
 * Parst eine hochgeladene Textdatei (.txt, .csv, .md) in Challenges.
 * Erwartetes, aber flexibles Format pro Zeile:
 *   Titel | Beschreibung | Punkte
 * Fehlende Felder werden sinnvoll ergänzt. Kommentarzeilen (# ...) und
 * Leerzeilen werden ignoriert.
 *
 * Das ist bewusst simpel gehalten – der geplante KI-Modus wird hier später
 * beliebige Dokumente (PDF, Word, Fotos von Zetteln) automatisch in
 * Challenges mit passender Kategorie & Punktzahl umwandeln.
 */
export function parseChallengesFromText(
  text: string,
  categoryId: CategoryId
): Challenge[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  return lines.map((line, i) => {
    const parts = line.split(/\||;|\t/).map((p) => p.trim());
    const title = parts[0] || `Eigene Challenge ${i + 1}`;
    const description = parts[1] || "Von der Crew erstellte Challenge.";
    const parsedPoints = parts[2] ? parseInt(parts[2].replace(/\D/g, ""), 10) : NaN;
    const points = Number.isFinite(parsedPoints) && parsedPoints > 0 ? parsedPoints : 25;

    return {
      id: uid("custom"),
      categoryId,
      title,
      description,
      points,
      difficulty: guessDifficulty(points),
      proofType: "photo",
      icon: ICONS_BY_CATEGORY[categoryId],
      animation: ANIMATIONS[i % ANIMATIONS.length],
      isCustom: true,
      source: "manual",
    } satisfies Challenge;
  });
}
