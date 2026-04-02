import { useMemo } from "react";

interface MiniSparklineProps {
  /** 7 data points representing a trend */
  data?: number[];
  width?: number;
  height?: number;
  color?: string;
}

/** Generates fake but deterministic trend data from a seed value */
function generateTrend(seed: number): number[] {
  const base = seed || 50;
  const points: number[] = [];
  let val = base * 0.7;
  for (let i = 0; i < 7; i++) {
    // Deterministic pseudo-random using sine
    val += (Math.sin(seed * (i + 1) * 0.7) * base * 0.15) + (base * 0.04);
    points.push(Math.max(0, val));
  }
  return points;
}

export function MiniSparkline({ data, width = 64, height = 20, color = "hsl(var(--primary))" }: MiniSparklineProps) {
  const points = data && data.length >= 2 ? data : generateTrend(42);

  const path = useMemo(() => {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const stepX = width / (points.length - 1);
    const pad = 2;
    const h = height - pad * 2;

    return points
      .map((v, i) => {
        const x = i * stepX;
        const y = pad + h - ((v - min) / range) * h;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [points, width, height]);

  // gradient fill path
  const fillPath = useMemo(() => {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const stepX = width / (points.length - 1);
    const pad = 2;
    const h = height - pad * 2;

    const linePoints = points.map((v, i) => {
      const x = i * stepX;
      const y = pad + h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return `M0,${height} L${linePoints.join(" L")} L${width},${height} Z`;
  }, [points, width, height]);

  const id = useMemo(() => `spark-${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
