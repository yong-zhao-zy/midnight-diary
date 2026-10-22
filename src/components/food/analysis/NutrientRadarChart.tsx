"use client";

import { NUTRIENT_LABELS, type NutrientKey } from "@/config/dri-config";
import type { NutrientAssessment } from "@/lib/nutrition-analysis";

interface Props {
  assessments: NutrientAssessment[];
  /** 本雷达展示的营养素（按分组传入） */
  keys: NutrientKey[];
  /** 线条/填充色 */
  color?: string;
  /** 大图（左栏宏量） / 小图（右栏微量） */
  size?: "lg" | "sm";
}

interface AxisItem {
  name: string;
  rate: number;
  rating: string;
}

const RATE_COLORS: Record<string, string> = {
  sufficient: "#6EE7B7",
  borderline: "#FBBF24",
  deficient: "#FB7185",
  excessive: "#FB7185",
};

/** 绘图上限：达成率超过 120% 按顶格画，标签里仍显示真实数值 */
const MAXV = 120;

/** 极坐标 → 直角坐标（0 号轴朝正上方，顺时针分布） */
function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function polygonPoints(cx: number, cy: number, r: number, n: number): string {
  return Array.from({ length: n }, (_, i) => polar(cx, cy, r, (360 / n) * i).map((v) => v.toFixed(1)).join(",")).join(" ");
}

/**
 * 达成率雷达（纯 SVG 实现，不依赖 recharts）。
 * - 白色虚线多边形 = 100% 达成基准
 * - 每条轴旁两行标签：营养素名 + 按评级着色的达成率
 */
export function NutrientRadarChart({ assessments, keys, color = "#E0B84A", size = "lg" }: Props) {
  const byKey = new Map(assessments.map((a) => [a.key, a]));
  // 无数据的项不进雷达（避免假 0%）
  const data: AxisItem[] = keys
    .filter((k) => byKey.get(k)?.has_data)
    .map((k) => {
      const a = byKey.get(k)!;
      return {
        name: NUTRIENT_LABELS[k],
        rate: Math.round(a.achievement_rate),
        rating: a.rating,
      };
    });

  if (data.length < 3) {
    return (
      <p className="text-[11px] text-muted/40 text-center py-8">
        本组营养素暂无可评数据（食物库未记录相应成分）
      </p>
    );
  }

  const n = data.length;
  const lg = size === "lg";

  // 视口与几何参数（左右两栏同宽 170，字体按 CSS px 直出，不会被缩放变小）
  const W = 170;
  const H = lg ? 164 : 122;
  const cx = W / 2;
  const cy = lg ? 84 : 63;
  const R = lg ? 50 : 36;
  const labelOff = lg ? 11 : 9;
  const nameFont = lg ? 9.5 : 8;
  const rateFont = lg ? 8.5 : 7.5;
  const strokeW = lg ? 1.6 : 1.3;

  const shapePoints = data
    .map((d, i) => {
      const r = (Math.min(d.rate, MAXV) / MAXV) * R;
      return polar(cx, cy, r, (360 / n) * i).map((v) => v.toFixed(1)).join(",");
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="营养素达成率雷达图">
      {/* 网格：3 层多边形环 + 轴辐线 */}
      {[1 / 3, 2 / 3, 1].map((f) => (
        <polygon
          key={f}
          points={polygonPoints(cx, cy, R * f, n)}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}
      {data.map((_, i) => {
        const [x2, y2] = polar(cx, cy, R, (360 / n) * i);
        return <line key={i} x1={cx} y1={cy} x2={x2.toFixed(1)} y2={y2.toFixed(1)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />;
      })}

      {/* 100% 达成基准（白色虚线） */}
      <polygon
        points={polygonPoints(cx, cy, (100 / MAXV) * R, n)}
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1}
        strokeDasharray="4 3"
      />

      {/* 实际达成图形 */}
      <polygon points={shapePoints} fill={`${color}26`} stroke={color} strokeWidth={strokeW} strokeLinejoin="round" />

      {/* 轴旁标签：名称 + 按评级着色的达成率 */}
      {data.map((d, i) => {
        const ang = (360 / n) * i;
        const [x, y] = polar(cx, cy, R + labelOff, ang);
        const cos = Math.cos(((ang - 90) * Math.PI) / 180);
        const sin = Math.sin(((ang - 90) * Math.PI) / 180);
        const anchor = cos > 0.35 ? "start" : cos < -0.35 ? "end" : "middle";
        // 顶/底两根轴的标签往外挪，避免压到图形
        const dy = sin < -0.5 ? -3 : sin > 0.5 ? 7 : 3.5;
        const rateColor = RATE_COLORS[d.rating] ?? "rgba(255,255,255,0.45)";
        return (
          <text key={d.name} x={x.toFixed(1)} y={(y + dy).toFixed(1)} textAnchor={anchor} fill="rgba(255,255,255,0.62)">
            <tspan x={x.toFixed(1)} fontSize={nameFont}>
              {d.name}
            </tspan>
            <tspan x={x.toFixed(1)} dy={nameFont + 1.5} fontSize={rateFont} fill={rateColor}>
              {d.rate}%
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}
