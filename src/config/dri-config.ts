/**
 * DRI（膳食营养素参考摄入量）配置
 * 数据来源：中国营养学会《中国居民膳食营养素参考摄入量》
 * 用于根据用户性别/年龄/体重计算个性化营养目标，判断摄入合理性
 */

export type Gender = "male" | "female";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export type AgeGroup =
  | "child_1_3"
  | "child_4_6"
  | "child_7_10"
  | "teen_11_13"
  | "teen_14_17"
  | "adult_18_49"
  | "adult_50_64"
  | "senior_65_plus";

/** 宏量营养素 5 种 + 微量营养素 15 种 = 20 项 */
export const NUTRIENT_KEYS = [
  // 宏量
  "energy_kcal", "protein_g", "fat_g", "carb_g", "fiber_g",
  // 矿物质
  "sodium_mg", "potassium_mg", "calcium_mg", "magnesium_mg",
  "iron_mg", "zinc_mg", "selenium_ug",
  // 维生素
  "vit_a_ugre", "vit_b1_mg", "vit_b2_mg", "vit_b6_mg",
  "vit_b12_ug", "vit_c_mg", "vit_d_ug", "vit_e_mg",
] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

export const NUTRIENT_LABELS: Record<NutrientKey, string> = {
  energy_kcal: "热量",
  protein_g: "蛋白质",
  fat_g: "脂肪",
  carb_g: "碳水",
  fiber_g: "膳食纤维",
  sodium_mg: "钠",
  potassium_mg: "钾",
  calcium_mg: "钙",
  magnesium_mg: "镁",
  iron_mg: "铁",
  zinc_mg: "锌",
  selenium_ug: "硒",
  vit_a_ugre: "维A",
  vit_b1_mg: "维B1",
  vit_b2_mg: "维B2",
  vit_b6_mg: "维B6",
  vit_b12_ug: "维B12",
  vit_c_mg: "维C",
  vit_d_ug: "维D",
  vit_e_mg: "维E",
};

/** 宏量营养素 key（概览页主显示） */
export const MACRO_NUTRIENTS: NutrientKey[] = [
  "energy_kcal", "protein_g", "fat_g", "carb_g", "fiber_g",
];

/** 微量营养素 key（分析报告展开） */
export const MICRO_NUTRIENTS: NutrientKey[] = NUTRIENT_KEYS.filter(
  (k) => !MACRO_NUTRIENTS.includes(k)
);

/** 单位后缀（用于显示） */
export const NUTRIENT_UNITS: Record<NutrientKey, string> = {
  energy_kcal: "kcal",
  protein_g: "g",
  fat_g: "g",
  carb_g: "g",
  fiber_g: "g",
  sodium_mg: "mg",
  potassium_mg: "mg",
  calcium_mg: "mg",
  magnesium_mg: "mg",
  iron_mg: "mg",
  zinc_mg: "mg",
  selenium_ug: "μg",
  vit_a_ugre: "μg",
  vit_b1_mg: "mg",
  vit_b2_mg: "mg",
  vit_b6_mg: "mg",
  vit_b12_ug: "μg",
  vit_c_mg: "mg",
  vit_d_ug: "μg",
  vit_e_mg: "mg",
};

export interface DRIEntry {
  energy_kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  fiber_g: number;
  sodium_mg: number;
  potassium_mg: number;
  calcium_mg: number;
  magnesium_mg: number;
  iron_mg: number;
  zinc_mg: number;
  selenium_ug: number;
  vit_a_ugre: number;
  vit_b1_mg: number;
  vit_b2_mg: number;
  vit_b6_mg: number;
  vit_b12_ug: number;
  vit_c_mg: number;
  vit_d_ug: number;
  vit_e_mg: number;
}

/** 活动水平系数（TDEE = BMR × coefficient） */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "久坐不动",
  light: "轻度活动",
  moderate: "中度活动",
  active: "重度活动",
  very_active: "极重度活动",
};

export interface HealthProfile {
  height_cm?: number;
  birth_date?: string;
  gender?: Gender;
  activity_level?: ActivityLevel;
  calorie_goal?: number;
  target_weight_kg?: number;
}

export const DEFAULT_HEALTH_PROFILE: HealthProfile = {
  height_cm: undefined,
  birth_date: undefined,
  gender: undefined,
  activity_level: "moderate",
  calorie_goal: undefined,
  target_weight_kg: undefined,
};

/**
 * DRI 查找表：按 gender × age_group
 * 数值来源：中国营养学会 DRI（RNI 或 AI）
 */
export const DRI_TABLE: Record<Gender, Record<AgeGroup, DRIEntry>> = {
  male: {
    child_1_3: {
      energy_kcal: 1050, protein_g: 25, fat_g: 35, carb_g: 150, fiber_g: 10,
      sodium_mg: 700, potassium_mg: 900, calcium_mg: 600, magnesium_mg: 100,
      iron_mg: 9, zinc_mg: 4, selenium_ug: 20, vit_a_ugre: 310, vit_b1_mg: 0.6,
      vit_b2_mg: 0.6, vit_b6_mg: 0.6, vit_b12_ug: 0.9, vit_c_mg: 40,
      vit_d_ug: 10, vit_e_mg: 6,
    },
    child_4_6: {
      energy_kcal: 1400, protein_g: 30, fat_g: 45, carb_g: 200, fiber_g: 12,
      sodium_mg: 900, potassium_mg: 1200, calcium_mg: 800, magnesium_mg: 150,
      iron_mg: 10, zinc_mg: 5.5, selenium_ug: 25, vit_a_ugre: 360, vit_b1_mg: 0.8,
      vit_b2_mg: 0.7, vit_b6_mg: 0.7, vit_b12_ug: 1.2, vit_c_mg: 45,
      vit_d_ug: 10, vit_e_mg: 7,
    },
    child_7_10: {
      energy_kcal: 1800, protein_g: 40, fat_g: 55, carb_g: 260, fiber_g: 16,
      sodium_mg: 1200, potassium_mg: 1500, calcium_mg: 1000, magnesium_mg: 220,
      iron_mg: 13, zinc_mg: 7, selenium_ug: 35, vit_a_ugre: 480, vit_b1_mg: 1,
      vit_b2_mg: 1, vit_b6_mg: 1, vit_b12_ug: 1.6, vit_c_mg: 55,
      vit_d_ug: 10, vit_e_mg: 9,
    },
    teen_11_13: {
      energy_kcal: 2200, protein_g: 55, fat_g: 65, carb_g: 320, fiber_g: 20,
      sodium_mg: 1500, potassium_mg: 1900, calcium_mg: 1200, magnesium_mg: 300,
      iron_mg: 15, zinc_mg: 10, selenium_ug: 45, vit_a_ugre: 580, vit_b1_mg: 1.3,
      vit_b2_mg: 1.3, vit_b6_mg: 1.1, vit_b12_ug: 2.1, vit_c_mg: 80,
      vit_d_ug: 10, vit_e_mg: 13,
    },
    teen_14_17: {
      energy_kcal: 2600, protein_g: 65, fat_g: 75, carb_g: 380, fiber_g: 22,
      sodium_mg: 1800, potassium_mg: 2200, calcium_mg: 1000, magnesium_mg: 330,
      iron_mg: 16, zinc_mg: 11.5, selenium_ug: 50, vit_a_ugre: 670, vit_b1_mg: 1.5,
      vit_b2_mg: 1.5, vit_b6_mg: 1.3, vit_b12_ug: 2.4, vit_c_mg: 90,
      vit_d_ug: 10, vit_e_mg: 14,
    },
    adult_18_49: {
      energy_kcal: 2250, protein_g: 65, fat_g: 70, carb_g: 300, fiber_g: 25,
      sodium_mg: 1500, potassium_mg: 2000, calcium_mg: 800, magnesium_mg: 330,
      iron_mg: 12, zinc_mg: 12.5, selenium_ug: 60, vit_a_ugre: 800, vit_b1_mg: 1.4,
      vit_b2_mg: 1.4, vit_b6_mg: 1.4, vit_b12_ug: 2.4, vit_c_mg: 100,
      vit_d_ug: 10, vit_e_mg: 14,
    },
    adult_50_64: {
      energy_kcal: 2100, protein_g: 65, fat_g: 65, carb_g: 280, fiber_g: 25,
      sodium_mg: 1400, potassium_mg: 2000, calcium_mg: 1000, magnesium_mg: 330,
      iron_mg: 12, zinc_mg: 12.5, selenium_ug: 60, vit_a_ugre: 800, vit_b1_mg: 1.4,
      vit_b2_mg: 1.4, vit_b6_mg: 1.4, vit_b12_ug: 2.4, vit_c_mg: 100,
      vit_d_ug: 10, vit_e_mg: 14,
    },
    senior_65_plus: {
      energy_kcal: 2000, protein_g: 65, fat_g: 60, carb_g: 260, fiber_g: 25,
      sodium_mg: 1400, potassium_mg: 2000, calcium_mg: 1000, magnesium_mg: 320,
      iron_mg: 12, zinc_mg: 12.5, selenium_ug: 60, vit_a_ugre: 800, vit_b1_mg: 1.4,
      vit_b2_mg: 1.4, vit_b6_mg: 1.6, vit_b12_ug: 2.4, vit_c_mg: 100,
      vit_d_ug: 15, vit_e_mg: 14,
    },
  },
  female: {
    child_1_3: {
      energy_kcal: 1000, protein_g: 25, fat_g: 35, carb_g: 150, fiber_g: 10,
      sodium_mg: 700, potassium_mg: 900, calcium_mg: 600, magnesium_mg: 100,
      iron_mg: 9, zinc_mg: 4, selenium_ug: 20, vit_a_ugre: 310, vit_b1_mg: 0.6,
      vit_b2_mg: 0.6, vit_b6_mg: 0.6, vit_b12_ug: 0.9, vit_c_mg: 40,
      vit_d_ug: 10, vit_e_mg: 6,
    },
    child_4_6: {
      energy_kcal: 1300, protein_g: 30, fat_g: 45, carb_g: 190, fiber_g: 12,
      sodium_mg: 900, potassium_mg: 1200, calcium_mg: 800, magnesium_mg: 150,
      iron_mg: 10, zinc_mg: 5.5, selenium_ug: 25, vit_a_ugre: 360, vit_b1_mg: 0.8,
      vit_b2_mg: 0.7, vit_b6_mg: 0.7, vit_b12_ug: 1.2, vit_c_mg: 45,
      vit_d_ug: 10, vit_e_mg: 7,
    },
    child_7_10: {
      energy_kcal: 1600, protein_g: 40, fat_g: 50, carb_g: 240, fiber_g: 16,
      sodium_mg: 1200, potassium_mg: 1500, calcium_mg: 1000, magnesium_mg: 220,
      iron_mg: 13, zinc_mg: 7, selenium_ug: 35, vit_a_ugre: 450, vit_b1_mg: 1,
      vit_b2_mg: 1, vit_b6_mg: 1, vit_b12_ug: 1.6, vit_c_mg: 55,
      vit_d_ug: 10, vit_e_mg: 9,
    },
    teen_11_13: {
      energy_kcal: 2000, protein_g: 50, fat_g: 60, carb_g: 300, fiber_g: 20,
      sodium_mg: 1500, potassium_mg: 1900, calcium_mg: 1200, magnesium_mg: 300,
      iron_mg: 18, zinc_mg: 8.5, selenium_ug: 45, vit_a_ugre: 530, vit_b1_mg: 1.3,
      vit_b2_mg: 1.3, vit_b6_mg: 1.1, vit_b12_ug: 2.1, vit_c_mg: 80,
      vit_d_ug: 10, vit_e_mg: 13,
    },
    teen_14_17: {
      energy_kcal: 2200, protein_g: 55, fat_g: 65, carb_g: 330, fiber_g: 22,
      sodium_mg: 1800, potassium_mg: 2200, calcium_mg: 1000, magnesium_mg: 330,
      iron_mg: 18, zinc_mg: 8.5, selenium_ug: 50, vit_a_ugre: 630, vit_b1_mg: 1.5,
      vit_b2_mg: 1.5, vit_b6_mg: 1.3, vit_b12_ug: 2.4, vit_c_mg: 90,
      vit_d_ug: 10, vit_e_mg: 14,
    },
    adult_18_49: {
      energy_kcal: 1800, protein_g: 55, fat_g: 60, carb_g: 270, fiber_g: 25,
      sodium_mg: 1500, potassium_mg: 2000, calcium_mg: 800, magnesium_mg: 330,
      iron_mg: 20, zinc_mg: 7.5, selenium_ug: 60, vit_a_ugre: 700, vit_b1_mg: 1.2,
      vit_b2_mg: 1.2, vit_b6_mg: 1.4, vit_b12_ug: 2.4, vit_c_mg: 100,
      vit_d_ug: 10, vit_e_mg: 14,
    },
    adult_50_64: {
      energy_kcal: 1700, protein_g: 55, fat_g: 55, carb_g: 250, fiber_g: 25,
      sodium_mg: 1400, potassium_mg: 2000, calcium_mg: 1000, magnesium_mg: 330,
      iron_mg: 12, zinc_mg: 7.5, selenium_ug: 60, vit_a_ugre: 700, vit_b1_mg: 1.2,
      vit_b2_mg: 1.2, vit_b6_mg: 1.4, vit_b12_ug: 2.4, vit_c_mg: 100,
      vit_d_ug: 10, vit_e_mg: 14,
    },
    senior_65_plus: {
      energy_kcal: 1600, protein_g: 55, fat_g: 50, carb_g: 230, fiber_g: 25,
      sodium_mg: 1400, potassium_mg: 2000, calcium_mg: 1000, magnesium_mg: 320,
      iron_mg: 12, zinc_mg: 7.5, selenium_ug: 60, vit_a_ugre: 700, vit_b1_mg: 1.2,
      vit_b2_mg: 1.2, vit_b6_mg: 1.6, vit_b12_ug: 2.4, vit_c_mg: 100,
      vit_d_ug: 15, vit_e_mg: 14,
    },
  },
};

/** 根据出生日期计算年龄 */
export function calcAge(birthDate: string): number {
  const [y, m, d] = birthDate.split("-").map(Number);
  const birth = new Date(y, m - 1, d);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/** 根据年龄推断年龄段 */
export function resolveAgeGroup(age: number): AgeGroup {
  if (age <= 3) return "child_1_3";
  if (age <= 6) return "child_4_6";
  if (age <= 10) return "child_7_10";
  if (age <= 13) return "teen_11_13";
  if (age <= 17) return "teen_14_17";
  if (age <= 49) return "adult_18_49";
  if (age <= 64) return "adult_50_64";
  return "senior_65_plus";
}

/**
 * Mifflin-St Jeor 公式计算 BMR（基础代谢率）
 * 男性: BMR = 10×体重(kg) + 6.25×身高(cm) - 5×年龄 + 5
 * 女性: BMR = 10×体重(kg) + 6.25×身高(cm) - 5×年龄 - 161
 */
export function calcBMR(
  gender: Gender,
  weightKg: number,
  heightCm: number,
  ageYears: number
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(gender === "male" ? base + 5 : base - 161);
}

/** TDEE = BMR × activity_factor */
export function calcTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_FACTORS[activityLevel]);
}

/**
 * 获取用户个性化的 DRI
 * 先从 DRI_TABLE 取基准值，再根据实际体重按比例修正蛋白质和能量
 */
export function getPersonalizedDRI(
  profile: HealthProfile,
  weightKg: number
): DRIEntry | null {
  if (!profile.birth_date || !profile.gender) return null;

  const age = calcAge(profile.birth_date);
  const ageGroup = resolveAgeGroup(age);
  const base = DRI_TABLE[profile.gender][ageGroup];
  if (!base) return null;

  // 按实际体重修正蛋白质（0.84g/kg 男性，0.80g/kg 女性）
  const proteinPerKg = profile.gender === "male" ? 0.84 : 0.8;
  const adjustedProtein = Math.max(base.protein_g, Math.round(weightKg * proteinPerKg));

  // 如果有身高，用 BMR/TDEE 修正能量
  let adjustedEnergy = base.energy_kcal;
  if (profile.height_cm) {
    const bmr = calcBMR(profile.gender, weightKg, profile.height_cm, age);
    const activity = profile.activity_level ?? "moderate";
    const tdee = calcTDEE(bmr, activity);
    adjustedEnergy = tdee;
  }

  return {
    ...base,
    energy_kcal: profile.calorie_goal ?? adjustedEnergy,
    protein_g: adjustedProtein,
  };
}
