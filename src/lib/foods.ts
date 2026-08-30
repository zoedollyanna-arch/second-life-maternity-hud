export type StatName =
  | "energy"
  | "hydration"
  | "hunger"
  | "bladder"
  | "mood"
  | "immunity"
  | "sickness"
  | "rest"
  | "vitamins"
  | "comfort"
  | "nutrition"
  | "stress"
  | "baby_wellness"
  | "baby_bond"
  | "baby_movement";

export const FOOD_CATEGORIES = [
  "breakfast",
  "meals",
  "snacks",
  "fruits",
  "drinks",
  "desserts",
  "cravings",
  "pica",
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export interface FoodItem {
  key: string;
  name: string;
  category: FoodCategory;
  cravingTags: string[];
  deltas: Partial<Record<StatName, number>>;
  cravingRelief: number;
  note: string;
}

export const FOOD_ITEMS: FoodItem[] = [
  {
    key: "french_toast",
    name: "French toast",
    category: "breakfast",
    cravingTags: ["french toast", "toast", "sweet", "breakfast"],
    deltas: { hunger: 18, mood: 10, nutrition: 2, energy: 4 },
    cravingRelief: 24,
    note: "A cozy sweet breakfast craving.",
  },
  {
    key: "jam_toast",
    name: "Jam toast",
    category: "breakfast",
    cravingTags: ["jam toast", "toast", "jam", "sweet"],
    deltas: { hunger: 12, mood: 8, nutrition: 1, energy: 3, sickness: -2 },
    cravingRelief: 18,
    note: "A light sweet snack that can help queasiness.",
  },
  {
    key: "ham_sub",
    name: "Ham sub",
    category: "meals",
    cravingTags: ["ham sub", "sub", "sandwich", "salty", "protein"],
    deltas: { hunger: 24, mood: 5, nutrition: 6, hydration: -2, baby_wellness: 1 },
    cravingRelief: 24,
    note: "A filling salty sandwich with a little protein.",
  },
  {
    key: "spaghetti",
    name: "Spaghetti",
    category: "meals",
    cravingTags: ["spaghetti", "pasta", "tomato", "grains"],
    deltas: { hunger: 26, mood: 7, nutrition: 7, energy: 4, baby_wellness: 2 },
    cravingRelief: 26,
    note: "A warm pasta meal that settles hunger well.",
  },
  {
    key: "chicken_bacon_burger",
    name: "Chicken bacon burger",
    category: "meals",
    cravingTags: ["chicken bacon burger", "chicken", "bacon", "burger", "salty", "protein"],
    deltas: { hunger: 30, mood: 9, nutrition: 4, hydration: -3, sickness: 1, baby_wellness: 1 },
    cravingRelief: 30,
    note: "Big comfort food: great for hunger, heavier on the body.",
  },
  {
    key: "lasagna",
    name: "Lasagna",
    category: "meals",
    cravingTags: ["lasagna", "pasta", "cheese", "dairy", "comfort"],
    deltas: { hunger: 32, mood: 8, nutrition: 8, energy: 3, sickness: 1, baby_wellness: 2 },
    cravingRelief: 28,
    note: "A hearty comfort meal with decent nutrition.",
  },
  {
    key: "cheeseburger",
    name: "Cheeseburger",
    category: "meals",
    cravingTags: ["cheeseburger", "burger", "cheese", "salty"],
    deltas: { hunger: 30, mood: 10, nutrition: 3, hydration: -3, sickness: 2 },
    cravingRelief: 30,
    note: "Strong craving relief, but not an everyday nutrition boost.",
  },
  {
    key: "pickle_chips",
    name: "Pickle chips",
    category: "snacks",
    cravingTags: ["pickle chips", "pickle", "pickles", "chips", "salty", "sour", "crunchy"],
    deltas: { hunger: 10, mood: 7, hydration: -4, sickness: -2 },
    cravingRelief: 26,
    note: "Salty, sour and crunchy — the classic pregnancy craving.",
  },
  {
    key: "pizza",
    name: "Pizza",
    category: "cravings",
    cravingTags: ["pizza", "cheese", "salty", "craving"],
    deltas: { hunger: 28, mood: 12, nutrition: 3, hydration: -2, sickness: 2, energy: 3 },
    cravingRelief: 32,
    note: "The late-night craving that always sounds right.",
  },
  {
    key: "pickles",
    name: "Pickles",
    category: "cravings",
    cravingTags: ["pickles", "pickle", "sour", "salty"],
    deltas: { hunger: 8, mood: 8, hydration: -3, sickness: -3 },
    cravingRelief: 28,
    note: "Cold, sour, and oddly perfect.",
  },
  {
    key: "ice_cream",
    name: "Ice cream",
    category: "desserts",
    cravingTags: ["ice cream", "sweet", "cold", "dessert", "craving"],
    deltas: { hunger: 14, mood: 14, nutrition: -1, sickness: 1, comfort: 4 },
    cravingRelief: 30,
    note: "Cold sweetness. Mood magic, a little heavy after.",
  },
  {
    key: "chocolate_bar",
    name: "Chocolate bar",
    category: "desserts",
    cravingTags: ["chocolate bar", "chocolate", "candy", "cocoa", "sweet"],
    deltas: { hunger: 8, mood: 12, energy: 5, nutrition: -1, sickness: 1 },
    cravingRelief: 28,
    note: "Pure comfort — a little mood magic in a wrapper.",
  },
  {
    key: "strawberries",
    name: "Strawberries",
    category: "fruits",
    cravingTags: ["strawberries", "strawberry", "fruit", "sweet"],
    deltas: { hunger: 8, mood: 6, nutrition: 5, hydration: 4, sickness: -2, baby_wellness: 2 },
    cravingRelief: 16,
    note: "Fresh, light, and kind to queasiness.",
  },
  {
    key: "watermelon",
    name: "Watermelon",
    category: "fruits",
    cravingTags: ["watermelon", "fruit", "hydrating"],
    deltas: { hunger: 6, hydration: 12, mood: 4, nutrition: 3, bladder: -6 },
    cravingRelief: 12,
    note: "Mostly water and sweetness. Hydration bump.",
  },
  {
    key: "lemonade",
    name: "Lemonade",
    category: "drinks",
    cravingTags: ["lemonade", "lemon", "sour", "drink"],
    deltas: { hydration: 14, mood: 5, sickness: -4, bladder: -8 },
    cravingRelief: 14,
    note: "Tart and cooling. Can settle a queasy stomach.",
  },
  {
    key: "ginger_ale",
    name: "Ginger ale",
    category: "drinks",
    cravingTags: ["ginger ale", "ginger", "soda", "drink", "nausea"],
    deltas: { hydration: 10, sickness: -8, mood: 3, comfort: 3 },
    cravingRelief: 12,
    note: "A classic nausea helper.",
  },
  {
    key: "ice_chips",
    name: "Ice chips",
    category: "drinks",
    cravingTags: ["ice chips", "ice", "cold", "labor"],
    deltas: { hydration: 8, comfort: 6, sickness: -3, mood: 2 },
    cravingRelief: 10,
    note: "Cool sips. Especially welcome during labor.",
  },
  {
    key: "corn_starch",
    name: "Corn starch",
    category: "pica",
    cravingTags: ["corn starch", "cornstarch", "pica", "chalk"],
    deltas: { hunger: 4, mood: 6, nutrition: -4, sickness: 6, baby_wellness: -2 },
    cravingRelief: 22,
    note: "A pica craving. Relieves the urge, not kind to nutrition.",
  },
  {
    key: "chalk",
    name: "Chalk",
    category: "pica",
    cravingTags: ["chalk", "pica"],
    deltas: { hunger: 2, mood: 4, nutrition: -6, sickness: 8, hydration: -4, baby_wellness: -3 },
    cravingRelief: 20,
    note: "Pica. Mentions it in the journal so the story stays honest.",
  },
];

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  breakfast: "Breakfast",
  meals: "Meals",
  snacks: "Snacks",
  fruits: "Fruits",
  drinks: "Drinks",
  desserts: "Desserts",
  cravings: "Cravings",
  pica: "Corn starch & chalk",
};

export function foodByKey(key: string): FoodItem | undefined {
  return FOOD_ITEMS.find((food) => food.key === key);
}

export function foodForCraving(craving: string): FoodItem {
  const normalized = craving.toLowerCase();
  return (
    FOOD_ITEMS.find((food) => food.cravingTags.some((tag) => normalized.includes(tag))) ??
    FOOD_ITEMS[Math.floor(Math.random() * FOOD_ITEMS.length)]
  );
}

export function foodSummary(food: FoodItem): Record<string, unknown> {
  return {
    key: food.key,
    name: food.name,
    category: food.category,
    cravingRelief: food.cravingRelief,
    note: food.note,
    deltas: food.deltas,
  };
}

export const CRAVING_POOL: Record<1 | 2 | 3, string[]> = {
  1: ["jam_toast", "french_toast", "strawberries", "ginger_ale", "pickle_chips"],
  2: ["pizza", "pickles", "ice_cream", "cheeseburger", "lasagna", "chocolate_bar", "lemonade"],
  3: ["pizza", "ice_cream", "chicken_bacon_burger", "ice_chips", "watermelon", "corn_starch"],
};
