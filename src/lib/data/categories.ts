import { Category } from "@/types";

export const CATEGORIES: Category[] = [
  {
    id: "klassiker",
    name: "Klassiker",
    icon: "🍻",
    gradient: "linear-gradient(135deg,#FF9F0A,#FF375F)",
    description: "Bewährte Trinkspiel-Kost",
  },
  {
    id: "performance",
    name: "Performance",
    icon: "🎭",
    gradient: "linear-gradient(135deg,#BF5AF2,#FF375F)",
    description: "Auftritt, Tanz & Show",
  },
  {
    id: "wissen",
    name: "Wissen",
    icon: "🧠",
    gradient: "linear-gradient(135deg,#64D2FF,#0A84FF)",
    description: "Quiz & Köpfchen",
  },
  {
    id: "mut",
    name: "Mut",
    icon: "🔥",
    gradient: "linear-gradient(135deg,#FF453A,#FF9F0A)",
    description: "Nur für Mutige",
  },
  {
    id: "team",
    name: "Team",
    icon: "🤝",
    gradient: "linear-gradient(135deg,#30D158,#64D2FF)",
    description: "Gemeinsam zum Sieg",
  },
  {
    id: "kreativ",
    name: "Kreativ",
    icon: "🎨",
    gradient: "linear-gradient(135deg,#FFD60A,#FF9F0A)",
    description: "Kunst & Kreativität",
  },
];

export function getCategory(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}
