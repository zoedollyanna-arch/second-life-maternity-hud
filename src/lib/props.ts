import { foodByKey, type StatName } from "./foods";

/** Exact root-prim inventory names; also used by the universal LSL prop. */
export const CARE_PROPS = [
  {
    key: "chocolate_fruit_toast",
    name: "Chocolate & Fruit Toast",
    object: "nestoria_chocolate_fruit_toast",
    food: "chocolate_fruit_toast",
    animation: "eat",
    seconds: 25,
  },
  {
    key: "smoothie",
    name: "Fruit Smoothie",
    object: "nestoria_smoothie",
    food: "smoothie",
    animation: "drink",
    seconds: 20,
  },
  {
    key: "chocolate_bar",
    name: "Chocolate Bar",
    object: "nestoria_chocolate_bar",
    food: "chocolate_bar",
    animation: "eat",
    seconds: 25,
  },
  {
    key: "salmon_bagel",
    name: "Salmon Bagel",
    object: "nestoria_salmon_bagel",
    food: "salmon_bagel",
    animation: "eat",
    seconds: 35,
  },
  {
    key: "water",
    name: "Water with Lemon",
    object: "nestoria_water",
    food: null,
    animation: "drink",
    seconds: 20,
  },
  {
    key: "prenatals",
    name: "Prenatal Vitamins",
    object: "nestoria_prenatals",
    food: null,
    animation: "vitamins",
    seconds: 12,
  },
] as const;

export type CareProp = (typeof CARE_PROPS)[number];
export function careProp(key: unknown): CareProp | undefined {
  return CARE_PROPS.find((item) => item.key === key);
}

export function propDeltas(prop: CareProp): Partial<Record<StatName, number>> {
  if (prop.food) return foodByKey(prop.food)!.deltas;
  if (prop.key === "water") return { hydration: 25, bladder: -10, baby_wellness: 2 };
  return { vitamins: 40, immunity: 10, nutrition: 8, baby_wellness: 4 };
}
