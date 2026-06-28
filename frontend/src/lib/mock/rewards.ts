export interface Reward {
  id: string;
  title: string;
  titleDe: string;
  description: string;
  descriptionDe: string;
  cost: number;
  icon: string;
  category: "nature" | "culture" | "mobility" | "civic";
}

export const REWARDS: Reward[] = [
  {
    id: "seed-packet",
    title: "Wildflower Seed Packet",
    titleDe: "Wildblumen-Saatgut",
    description: "A mix of native wildflower seeds for your balcony or garden.",
    descriptionDe: "Heimische Wildblumensamen für Balkon oder Garten.",
    cost: 50,
    icon: "Flower2",
    category: "nature",
  },
  {
    id: "museum-entry",
    title: "ZKM Museum Entry",
    titleDe: "ZKM Museumseintritt",
    description: "Free entry to ZKM | Center for Art and Media Karlsruhe.",
    descriptionDe: "Freier Eintritt ins ZKM Karlsruhe.",
    cost: 40,
    icon: "Landmark",
    category: "culture",
  },
  {
    id: "kvv-day",
    title: "KVV Day Ticket",
    titleDe: "KVV Tageskarte",
    description: "One day of free public transport in the KVV network.",
    descriptionDe: "Ein Tag kostenloser ÖPNV im KVV-Netz.",
    cost: 60,
    icon: "Train",
    category: "mobility",
  },
];
