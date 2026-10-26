export type Metric = "sales" | "traffic" | "contracts" | "revenue" | "trading";
export type Measure = Record<Metric, number>;

export const months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
export const brands = [
  { id: "ch", name: "Тенет", color: "#196c68" },
  { id: "tp", name: "Тенет Плюс", color: "#3c8b81" },
  { id: "jt", name: "Джетур", color: "#597d91" },
  { id: "hp", name: "Хавейл Про", color: "#a26738" },
  { id: "se", name: "Соуист", color: "#8a748f" },
  { id: "om", name: "Омода", color: "#677e4b" },
  { id: "jk", name: "Джейку", color: "#a74f42" },
  { id: "hc", name: "Хавейл Сити", color: "#436b91" },
  { id: "asp", name: "АСП · пробег", color: "#8d8d36" },
] as const;
export const newCarBrands = brands.filter(brand => brand.id !== "asp");
export const metricInfo: Record<Metric, { label: string; unit: string }> = {
  sales: { label: "Продажи", unit: "авто" },
  traffic: { label: "Трафик", unit: "визитов" },
  contracts: { label: "Договоры", unit: "договоров" },
  revenue: { label: "Выручка", unit: "руб." },
  trading: { label: "Трейд-ин", unit: "авто" },
};

export const dealerGroups = [
  { id: "ours", name: "Дебрянск Авто", color: "#173f3a", values: [180,163,269,290,299,269,297,289,254] },
  { id: "bryanskzapchast", name: "Брянскзапчасть", color: "#bf8851", values: [32,44,66,74,104,98,87,100,92] },
  { id: "avtomir", name: "Автомир", color: "#64859a", values: [102,92,168,158,156,157,155,139,174] },
  { id: "premier", name: "Премьер Авто", color: "#957d9d", values: [7,7,7,13,22,24,13,47,49] },
  { id: "bn-motors", name: "БН-Моторс", color: "#9a7860", values: [60,77,109,139,122,142,141,112,146] },
  { id: "avtomarket", name: "Автомаркет", color: "#82946f", values: [50,33,54,74,77,60,68,62,53] },
];
export const marketTotals = [431,416,673,748,780,750,761,749,768];

export const marketBrands = [
  { id: "tenet", name: "Тенет", color: "#196c68" },
  { id: "tenet-plus", name: "Тенет Плюс", color: "#3c8b81" },
  { id: "haval-city", name: "Хавейл Сити", color: "#436b91" },
  { id: "haval-pro", name: "Хавейл Про", color: "#a26738" },
  { id: "omoda", name: "Омода", color: "#677e4b" },
  { id: "jaecoo", name: "Джейку", color: "#a74f42" },
  { id: "jetour", name: "Джетур", color: "#597d91" },
  { id: "changan", name: "Чанган", color: "#82946f" },
  { id: "geely", name: "Джили", color: "#64859a" },
  { id: "belgee", name: "Белджи", color: "#957d9d" },
  { id: "volga", name: "Волга", color: "#bf8851" },
  { id: "lada", name: "Лада", color: "#9a7860" },
  { id: "gac", name: "GAC", color: "#8c6f9a" },
  { id: "voyah", name: "VOYAH", color: "#a95e55" },
  { id: "evolute", name: "Evolute", color: "#6d8975" },
  { id: "moskvich", name: "Москвич", color: "#a37b59" },
  { id: "solaris", name: "Solaris", color: "#647995" },
  { id: "kgm", name: "KGM", color: "#887e66" },
] as const;

export type MarketBrandId = typeof marketBrands[number]["id"];
export const dealerBrandSales: { groupId: string; brandId: MarketBrandId; values: number[] }[] = [
  { groupId: "ours", brandId: "omoda", values: [7,12,8,12,9,13,9,9,11] },
  { groupId: "ours", brandId: "jaecoo", values: [6,11,33,33,36,23,26,26,26] },
  { groupId: "ours", brandId: "jetour", values: [13,9,17,19,25,23,36,37,26] },
  { groupId: "ours", brandId: "haval-pro", values: [18,17,31,38,22,24,16,14,9] },
  { groupId: "ours", brandId: "haval-city", values: [78,66,105,120,124,102,117,97,96] },
  { groupId: "ours", brandId: "tenet-plus", values: [0,0,0,0,0,0,0,0,5] },
  { groupId: "ours", brandId: "tenet", values: [58,48,75,68,83,84,93,106,81] },
  { groupId: "bryanskzapchast", brandId: "tenet", values: [30,39,49,57,77,74,59,80,68] },
  { groupId: "bryanskzapchast", brandId: "changan", values: [2,5,17,17,27,24,28,20,24] },
  { groupId: "avtomir", brandId: "geely", values: [27,31,38,38,39,38,41,41,40] },
  { groupId: "avtomir", brandId: "changan", values: [4,2,17,10,18,18,17,17,14] },
  { groupId: "avtomir", brandId: "belgee", values: [15,19,33,30,28,34,30,28,32] },
  { groupId: "avtomir", brandId: "volga", values: [0,0,0,0,0,0,0,0,7] },
  { groupId: "avtomir", brandId: "lada", values: [56,40,80,80,71,67,67,53,81] },
  { groupId: "premier", brandId: "gac", values: [3,1,2,7,5,3,3,9,4] },
  { groupId: "premier", brandId: "voyah", values: [0,0,0,0,0,0,0,0,2] },
  { groupId: "premier", brandId: "evolute", values: [0,0,0,0,0,0,0,15,25] },
  { groupId: "premier", brandId: "moskvich", values: [0,0,0,0,13,9,4,20,15] },
  { groupId: "premier", brandId: "solaris", values: [4,6,5,6,4,12,6,3,3] },
  { groupId: "bn-motors", brandId: "lada", values: [20,24,38,50,42,45,49,40,54] },
  { groupId: "bn-motors", brandId: "kgm", values: [1,7,9,7,11,10,10,5,11] },
  { groupId: "bn-motors", brandId: "lada", values: [39,46,62,82,69,87,82,67,81] },
  { groupId: "avtomarket", brandId: "lada", values: [50,33,54,74,77,60,68,62,53] },
];
