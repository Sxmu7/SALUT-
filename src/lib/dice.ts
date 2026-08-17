import { CategoryId } from "@/types";

/**
 * Jede Würfel-Augenzahl steht für eine Challenge-Kategorie. So bleibt die
 * Auswahl überraschend, statt vorher als Liste durchsuchbar zu sein –
 * "Party-Modus": würfeln statt browsen.
 */
export const DICE_CATEGORY_MAP: CategoryId[] = [
  "klassiker", // 1
  "performance", // 2
  "wissen", // 3
  "mut", // 4
  "team", // 5
  "kreativ", // 6
];

export const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

export function categoryForFace(face: number): CategoryId {
  return DICE_CATEGORY_MAP[(face - 1 + DICE_CATEGORY_MAP.length) % DICE_CATEGORY_MAP.length];
}
