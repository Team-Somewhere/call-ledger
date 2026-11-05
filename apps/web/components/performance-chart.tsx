import React from "react";
import { cn } from "../lib/utils";

export interface PerformanceChartProps {
  data?: number[];
  labels?: string[];
  height?: number;
  className?: string;
  strokeColor?: string;
  fillColor?: string;
}

export function PerformanceChart({
  data = [100, 104, 102, 110, 108, 118, 124, 121, 132, 144, 140, 158, 165],
  labels = [
    "20 Jul",
    "21 Jul",
    "22 Jul",
    "23 Jul",
    "24 Jul",
    "25 Jul",
    "26 Jul",
  ],
  height = 200,
  className,
  strokeColor = "#171717",
  fillColor = "#FFE5BF",
}: PerformanceChartProps) {
  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;

  const width = 600;
  const paddingX = 20;
  const paddingY = 25;

  const points = data.map((val, idx) => {
    const x = paddingX + (idx / (data.length - 1)) * (width - paddingX * 2);
    const y =
      height - paddingY - ((val - minVal) / range) * (height - paddingY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(" L ")}`;
  const areaD = `M ${paddingX},${height - paddingY} L ${points.join(" L ")} L ${width - paddingX},${height - paddingY} Z`;

  return (
    <div className={cn("w-full flex flex-col", className)}>
      <div
        className="relative w-full overflow-hidden"
        style={{ height: `${height}px` }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient
              id="chartGradientMinimal"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={fillColor} stopOpacity="0.4" />
              <stop offset="100%" stopColor={fillColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Dotted horizontal grid lines */}
          <line
            x1={paddingX}
            y1={paddingY}
            x2={width - paddingX}
            y2={paddingY}
            stroke="#E8DFD1"
            strokeDasharray="2 3"
            strokeWidth="1"
          />
          <line
            x1={paddingX}
            y1={height / 2}
            x2={width - paddingX}
            y2={height / 2}
            stroke="#E8DFD1"
            strokeDasharray="2 3"
            strokeWidth="1"
          />
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="#E8DFD1"
            strokeWidth="1"
          />

          {/* Area fill */}
          <path d={areaD} fill="url(#chartGradientMinimal)" />

          {/* Main line */}
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.75"
            strokeLinecap="square"
            strokeLinejoin="round"
          />

          {/* End Vertex Point with ring */}
          {points.length > 0 && (
            <>
              <circle
                cx={points[points.length - 1]?.split(",")[0]}
                cy={points[points.length - 1]?.split(",")[1]}
                r="4"
                fill="#FFFAF3"
                stroke={strokeColor}
                strokeWidth="1.5"
              />
              <circle
                cx={points[points.length - 1]?.split(",")[0]}
                cy={points[points.length - 1]?.split(",")[1]}
                r="1.5"
                fill={strokeColor}
              />
            </>
          )}
        </svg>
      </div>

      {/* Axis labels */}
      <div className="flex justify-between px-2 pt-2 text-[10px] text-[#78716C] font-mono">
        {labels.map((lbl, i) => (
          <span key={i}>{lbl}</span>
        ))}
      </div>
    </div>
  );
}
