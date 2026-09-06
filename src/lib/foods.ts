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

  // -------------------------------------------------------------------------
  // Breakfast
  // -------------------------------------------------------------------------
  {
    key: "eggs",
    name: "Scrambled eggs",
    category: "breakfast",
    cravingTags: ["eggs", "scrambled eggs", "protein", "breakfast", "savoury"],
    deltas: { hunger: 18, nutrition: 8, mood: 4, baby_wellness: 2 },
    cravingRelief: 18,
    note: "Warm protein. Kind to a queasy morning if the smell behaves.",
  },
  {
    key: "pancakes",
    name: "Pancakes",
    category: "breakfast",
    cravingTags: ["pancakes", "pancake", "sweet", "breakfast", "syrup"],
    deltas: { hunger: 22, mood: 12, nutrition: 2, energy: 5, sickness: 1 },
    cravingRelief: 26,
    note: "A stack, with too much syrup. Worth it.",
  },
  {
    key: "waffles",
    name: "Waffles",
    category: "breakfast",
    cravingTags: ["waffles", "waffle", "sweet", "breakfast"],
    deltas: { hunger: 20, mood: 11, nutrition: 2, energy: 5, sickness: 1 },
    cravingRelief: 24,
    note: "Crisp edges, soft middle, syrup in every square.",
  },
  {
    key: "cereal",
    name: "Cereal",
    category: "breakfast",
    cravingTags: ["cereal", "breakfast", "milk", "quick"],
    deltas: { hunger: 12, nutrition: 4, mood: 4, hydration: 3 },
    cravingRelief: 14,
    note: "Fast, cold, and eaten standing up at midnight.",
  },
  {
    key: "oatmeal",
    name: "Oatmeal",
    category: "breakfast",
    cravingTags: ["oatmeal", "porridge", "oats", "breakfast", "warm"],
    deltas: { hunger: 20, nutrition: 10, sickness: -4, energy: 4, baby_wellness: 2 },
    cravingRelief: 14,
    note: "Slow, warm and settling. One of the best things for nausea.",
  },
  {
    key: "toast",
    name: "Buttered toast",
    category: "breakfast",
    cravingTags: ["toast", "bread", "butter", "plain", "breakfast"],
    deltas: { hunger: 10, sickness: -6, mood: 3, nutrition: 1 },
    cravingRelief: 12,
    note: "Plain and dry-ish. The classic thing that stays down.",
  },

  // -------------------------------------------------------------------------
  // Meals
  // -------------------------------------------------------------------------
  {
    key: "chicken_dinner",
    name: "Roast chicken",
    category: "meals",
    cravingTags: ["chicken", "roast", "protein", "dinner", "savoury"],
    deltas: { hunger: 28, nutrition: 12, mood: 6, baby_wellness: 3 },
    cravingRelief: 22,
    note: "Proper food. Protein and iron, and it fills her up.",
  },
  {
    key: "steak",
    name: "Steak",
    category: "meals",
    cravingTags: ["steak", "beef", "red meat", "iron", "protein"],
    deltas: { hunger: 32, nutrition: 12, mood: 8, immunity: 4, baby_wellness: 3 },
    cravingRelief: 26,
    note: "Iron-rich and satisfying — the craving a lot of people get.",
  },
  {
    key: "fish",
    name: "Baked fish",
    category: "meals",
    cravingTags: ["fish", "salmon", "protein", "omega", "dinner"],
    deltas: { hunger: 24, nutrition: 14, mood: 4, baby_wellness: 5 },
    cravingRelief: 16,
    note: "The best thing on this list for the baby, if she can face it.",
  },
  {
    key: "rice_bowl",
    name: "Rice bowl",
    category: "meals",
    cravingTags: ["rice", "bowl", "plain", "grains", "dinner"],
    deltas: { hunger: 24, nutrition: 6, sickness: -4, energy: 5 },
    cravingRelief: 18,
    note: "Plain, warm and forgiving on a bad stomach day.",
  },
  {
    key: "soup",
    name: "Chicken soup",
    category: "meals",
    cravingTags: ["soup", "broth", "chicken soup", "warm", "sick"],
    deltas: { hunger: 16, hydration: 12, sickness: -8, comfort: 8, nutrition: 6 },
    cravingRelief: 14,
    note: "Hydrating, gentle and the closest thing to being looked after.",
  },
  {
    key: "salad",
    name: "Garden salad",
    category: "meals",
    cravingTags: ["salad", "greens", "vegetables", "fresh", "light"],
    deltas: { hunger: 12, nutrition: 14, hydration: 6, baby_wellness: 4, sickness: -2 },
    cravingRelief: 8,
    note: "Light and green. Excellent nutrition, less excellent at 2am.",
  },

  // -------------------------------------------------------------------------
  // Snacks
  // -------------------------------------------------------------------------
  {
    key: "chips",
    name: "Crisps",
    category: "snacks",
    cravingTags: ["chips", "crisps", "salty", "crunchy", "snack"],
    deltas: { hunger: 10, mood: 8, hydration: -5, nutrition: -2, sickness: 1 },
    cravingRelief: 24,
    note: "Salt and crunch. Thirsty work afterwards.",
  },
  {
    key: "crackers",
    name: "Crackers",
    category: "snacks",
    cravingTags: ["crackers", "cracker", "plain", "dry", "snack", "nausea"],
    deltas: { hunger: 8, sickness: -8, mood: 2 },
    cravingRelief: 10,
    note: "Dry, plain and the thing to keep by the bed.",
  },
  {
    key: "cookies",
    name: "Cookies",
    category: "snacks",
    cravingTags: ["cookies", "cookie", "biscuits", "sweet", "snack"],
    deltas: { hunger: 12, mood: 11, nutrition: -1, energy: 5, sickness: 1 },
    cravingRelief: 24,
    note: "Two, then a third, then the packet is gone.",
  },
  {
    key: "popcorn",
    name: "Popcorn",
    category: "snacks",
    cravingTags: ["popcorn", "salty", "crunchy", "snack", "film"],
    deltas: { hunger: 9, mood: 7, hydration: -3, nutrition: 1 },
    cravingRelief: 18,
    note: "Light, salty and endless.",
  },
  {
    key: "pretzels",
    name: "Pretzels",
    category: "snacks",
    cravingTags: ["pretzels", "pretzel", "salty", "crunchy", "snack"],
    deltas: { hunger: 10, mood: 6, hydration: -4, sickness: -3 },
    cravingRelief: 18,
    note: "Salty and dry — surprisingly good against nausea.",
  },
  {
    key: "granola_bar",
    name: "Granola bar",
    category: "snacks",
    cravingTags: ["granola bar", "granola", "cereal bar", "snack", "quick"],
    deltas: { hunger: 12, nutrition: 6, energy: 8, mood: 3 },
    cravingRelief: 12,
    note: "The one that lives in her bag for emergencies.",
  },
  {
    key: "fruit_snacks",
    name: "Fruit snacks",
    category: "snacks",
    cravingTags: ["fruit snacks", "gummies", "sweets", "chewy", "sweet"],
    deltas: { hunger: 6, mood: 9, nutrition: -1, energy: 6 },
    cravingRelief: 20,
    note: "Chewy, bright and entirely unserious.",
  },

  // -------------------------------------------------------------------------
  // Fruits
  // -------------------------------------------------------------------------
  {
    key: "grapes",
    name: "Grapes",
    category: "fruits",
    cravingTags: ["grapes", "grape", "fruit", "cold", "sweet"],
    deltas: { hunger: 7, hydration: 8, nutrition: 5, mood: 5, sickness: -2 },
    cravingRelief: 14,
    note: "Cold from the fridge, eaten a whole bunch at a time.",
  },
  {
    key: "apple",
    name: "Apple",
    category: "fruits",
    cravingTags: ["apple", "fruit", "crunchy", "fresh"],
    deltas: { hunger: 9, hydration: 6, nutrition: 7, sickness: -3, baby_wellness: 2 },
    cravingRelief: 12,
    note: "Crisp and clean-tasting. Good for a sour mouth.",
  },
  {
    key: "banana",
    name: "Banana",
    category: "fruits",
    cravingTags: ["banana", "fruit", "potassium", "cramp"],
    deltas: { hunger: 12, nutrition: 9, energy: 7, sickness: -4, comfort: 3 },
    cravingRelief: 12,
    note: "Soft, easy, and the answer to night-time leg cramps.",
  },
  {
    key: "orange",
    name: "Orange",
    category: "fruits",
    cravingTags: ["orange", "citrus", "fruit", "sour", "vitamin c"],
    deltas: { hunger: 7, hydration: 10, nutrition: 7, immunity: 6, sickness: -4 },
    cravingRelief: 16,
    note: "Sharp and juicy. Cuts straight through queasiness.",
  },
  {
    key: "pineapple",
    name: "Pineapple",
    category: "fruits",
    cravingTags: ["pineapple", "fruit", "tropical", "sour", "sweet"],
    deltas: { hunger: 8, hydration: 10, nutrition: 6, mood: 7, sickness: -2 },
    cravingRelief: 18,
    note: "Sweet and sharp at once. A very pregnant craving.",
  },
  {
    key: "mango",
    name: "Mango",
    category: "fruits",
    cravingTags: ["mango", "fruit", "tropical", "sweet"],
    deltas: { hunger: 10, hydration: 8, nutrition: 7, mood: 8 },
    cravingRelief: 18,
    note: "Sticky, golden and worth the mess.",
  },
  {
    key: "peach",
    name: "Peach",
    category: "fruits",
    cravingTags: ["peach", "peaches", "fruit", "sweet", "soft"],
    deltas: { hunger: 8, hydration: 9, nutrition: 6, mood: 6, sickness: -2 },
    cravingRelief: 16,
    note: "Ripe enough to need a napkin.",
  },

  // -------------------------------------------------------------------------
  // Drinks
  // -------------------------------------------------------------------------
  {
    key: "juice",
    name: "Orange juice",
    category: "drinks",
    cravingTags: ["juice", "orange juice", "citrus", "drink", "sweet"],
    deltas: { hydration: 16, nutrition: 4, energy: 6, immunity: 4, mood: 5 },
    cravingRelief: 14,
    note: "Cold and sharp. A quick lift when everything feels heavy.",
  },
  {
    key: "milk",
    name: "Milk",
    category: "drinks",
    cravingTags: ["milk", "dairy", "calcium", "drink", "cold"],
    deltas: { hydration: 14, nutrition: 9, hunger: 6, baby_wellness: 4, comfort: 4 },
    cravingRelief: 12,
    note: "Calcium for two. Also settles heartburn, for a while.",
  },
  {
    key: "smoothie",
    name: "Fruit smoothie",
    category: "drinks",
    cravingTags: ["smoothie", "shake", "fruit", "drink", "cold", "blended"],
    deltas: { hydration: 16, nutrition: 11, hunger: 12, mood: 8, baby_wellness: 3 },
    cravingRelief: 20,
    note: "Cold, thick and easy when chewing feels like too much.",
  },
  {
    key: "tea",
    name: "Herbal tea",
    category: "drinks",
    cravingTags: ["tea", "herbal", "warm", "drink", "calm", "ginger", "mint"],
    deltas: { hydration: 12, comfort: 8, stress: -8, sickness: -5 },
    cravingRelief: 10,
    note: "Warm hands, warm middle. Ginger or mint helps the stomach.",
  },
  {
    key: "protein_shake",
    name: "Protein shake",
    category: "drinks",
    cravingTags: ["protein shake", "shake", "protein", "drink"],
    deltas: { hydration: 10, nutrition: 12, hunger: 14, energy: 8, baby_wellness: 3 },
    cravingRelief: 10,
    note: "Not exciting. Very useful on a day nothing else appeals.",
  },
  {
    key: "coconut_water",
    name: "Coconut water",
    category: "drinks",
    cravingTags: ["coconut water", "coconut", "drink", "hydrating", "electrolytes"],
    deltas: { hydration: 20, nutrition: 4, energy: 5, comfort: 3, sickness: -3 },
    cravingRelief: 12,
    note: "The best hydration on the list, and gentle with it.",
  },

  // -------------------------------------------------------------------------
  // Desserts
  // -------------------------------------------------------------------------
  {
    key: "cake",
    name: "Cake",
    category: "desserts",
    cravingTags: ["cake", "sponge", "sweet", "dessert", "birthday"],
    deltas: { hunger: 16, mood: 13, nutrition: -2, energy: 6, sickness: 2 },
    cravingRelief: 28,
    note: "A slice. Then a smaller slice, which is really a second slice.",
  },
  {
    key: "cupcake",
    name: "Cupcake",
    category: "desserts",
    cravingTags: ["cupcake", "cupcakes", "frosting", "sweet", "dessert"],
    deltas: { hunger: 10, mood: 11, nutrition: -1, energy: 5, sickness: 1 },
    cravingRelief: 24,
    note: "Mostly frosting, and she is not apologising for it.",
  },
  {
    key: "donut",
    name: "Donut",
    category: "desserts",
    cravingTags: ["donut", "doughnut", "sweet", "fried", "dessert"],
    deltas: { hunger: 14, mood: 12, nutrition: -3, energy: 7, sickness: 3 },
    cravingRelief: 28,
    note: "Warm, sweet, and heavier afterwards than it seemed.",
  },
  {
    key: "brownie",
    name: "Brownie",
    category: "desserts",
    cravingTags: ["brownie", "brownies", "chocolate", "sweet", "dessert"],
    deltas: { hunger: 14, mood: 13, nutrition: -2, energy: 6, sickness: 2 },
    cravingRelief: 28,
    note: "Dense, fudgy chocolate. Reliably fixes a mood.",
  },
  {
    key: "cheesecake",
    name: "Cheesecake",
    category: "desserts",
    cravingTags: ["cheesecake", "cheese cake", "dairy", "sweet", "dessert"],
    deltas: { hunger: 18, mood: 13, nutrition: 1, comfort: 5, sickness: 3 },
    cravingRelief: 30,
    note: "Rich enough that one slice is genuinely a meal.",
  },
  {
    key: "pudding",
    name: "Pudding",
    category: "desserts",
    cravingTags: ["pudding", "custard", "soft", "sweet", "dessert"],
    deltas: { hunger: 10, mood: 9, comfort: 6, sickness: -2, nutrition: 1 },
    cravingRelief: 20,
    note: "Cold, soft and easy. Good on a sore-throat sort of day.",
  },

  // -------------------------------------------------------------------------
  // Cravings — the ones the board calls out by name
  // -------------------------------------------------------------------------
  {
    key: "pasta_craving",
    name: "Buttery pasta",
    category: "cravings",
    cravingTags: ["pasta", "noodles", "butter", "carbs", "craving"],
    deltas: { hunger: 26, mood: 11, nutrition: 4, energy: 6, sickness: 1 },
    cravingRelief: 28,
    note: "Plain, buttery, enormous. Exactly the right amount of beige.",
  },
  {
    key: "strawberries_cream",
    name: "Strawberries & cream",
    category: "cravings",
    cravingTags: ["strawberries and cream", "strawberry", "cream", "sweet", "craving"],
    deltas: { hunger: 12, mood: 12, nutrition: 4, hydration: 5, baby_wellness: 2 },
    cravingRelief: 26,
    note: "Cold cream, sweet fruit. A craving with excellent taste.",
  },
  {
    key: "spicy_food",
    name: "Something spicy",
    category: "cravings",
    cravingTags: ["spicy", "hot sauce", "chilli", "curry", "craving"],
    deltas: { hunger: 22, mood: 12, sickness: 6, comfort: -4, hydration: -4 },
    cravingRelief: 30,
    note: "Wonderful going down. The heartburn later has opinions.",
  },
  {
    key: "olives",
    name: "Olives",
    category: "cravings",
    cravingTags: ["olives", "olive", "salty", "briny", "craving"],
    deltas: { hunger: 8, mood: 8, hydration: -4, nutrition: 3, sickness: -2 },
    cravingRelief: 24,
    note: "Straight from the jar, brine and all. Nobody knows why.",
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

/**
 * Resolve a craving phrase to the food it names.
 *
 * Match on the *most specific* tag, not on catalogue order. Tags overlap by
 * design — "pickle" belongs to both pickle chips and pickles, "toast" to three
 * different breakfasts, "orange" to the fruit and the juice — so taking the
 * first array hit meant a craving for pickles quietly resolved to pickle chips
 * and paid out its stats instead. An exact name match always wins; otherwise
 * the longest matching tag does.
 */
export function foodForCraving(craving: string): FoodItem {
  const normalized = craving.toLowerCase().trim();

  const exact = FOOD_ITEMS.find(
    (food) => food.name.toLowerCase() === normalized || food.key === normalized,
  );
  if (exact) return exact;

  let best: FoodItem | undefined;
  let bestTagLength = 0;
  for (const food of FOOD_ITEMS) {
    for (const tag of food.cravingTags) {
      if (tag.length > bestTagLength && normalized.includes(tag)) {
        best = food;
        bestTagLength = tag.length;
      }
    }
  }
  return best ?? FOOD_ITEMS[Math.floor(Math.random() * FOOD_ITEMS.length)];
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

/**
 * What she is likely to crave, by trimester.
 *
 * First trimester leans plain, cold and sour — the things that stay down.
 * Second is the classic "everything sounds good" window. Third goes heavy,
 * icy and salty, and is where pica shows up. Each pool is wide enough that
 * the same craving does not come back every time.
 */
export const CRAVING_POOL: Record<1 | 2 | 3, string[]> = {
  1: [
    "jam_toast",
    "french_toast",
    "toast",
    "crackers",
    "oatmeal",
    "strawberries",
    "orange",
    "apple",
    "grapes",
    "watermelon",
    "ginger_ale",
    "lemonade",
    "tea",
    "pickle_chips",
    "pickles",
    "pretzels",
    "cereal",
    "banana",
  ],
  2: [
    "pizza",
    "pickles",
    "ice_cream",
    "cheeseburger",
    "lasagna",
    "chocolate_bar",
    "lemonade",
    "pasta_craving",
    "strawberries_cream",
    "spicy_food",
    "olives",
    "pancakes",
    "waffles",
    "donut",
    "brownie",
    "cheesecake",
    "cupcake",
    "steak",
    "mango",
    "pineapple",
    "smoothie",
    "milk",
    "cookies",
    "chips",
  ],
  3: [
    "pizza",
    "ice_cream",
    "chicken_bacon_burger",
    "ice_chips",
    "watermelon",
    "corn_starch",
    "chalk",
    "cake",
    "cheesecake",
    "pudding",
    "spicy_food",
    "olives",
    "pasta_craving",
    "soup",
    "steak",
    "coconut_water",
    "juice",
    "peach",
    "popcorn",
    "fruit_snacks",
    "milk",
  ],
};
