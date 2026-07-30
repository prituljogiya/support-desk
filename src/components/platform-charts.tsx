"use client";

import { useMemo, useState } from "react";

export type ChartPoint = { label: string; value: number; color?: string };

const PALETTE = [
  "#0ea5e9",
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#8b5cf6",
  "#14b8a6",
  "#64748b",
];

export function colorAt(i: number) {
  return PALETTE[i % PALETTE.length]!;
}

export function InteractiveDonut({
  title,
  segments,
  onSelect,
}: {
  title: string;
  segments: ChartPoint[];
  onSelect?: (label: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let angle = 0;
  const slices = segments.map((s, i) => {
    const start = angle;
    const sweep = (s.value / total) * 360;
    angle += sweep;
    return {
      ...s,
      color: s.color || colorAt(i),
      start,
      end: angle,
      pct: Math.round((s.value / total) * 100),
    };
  });
  const gradient = slices
    .map((s) => `${s.color} ${s.start}deg ${s.end}deg`)
    .join(", ");
  const active = slices.find((s) => s.label === hover) || null;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {active ? (
          <div className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] text-white">
            {active.label}: {active.value} ({active.pct}%)
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex items-center gap-5">
        <div
          className="relative h-36 w-36 shrink-0 rounded-full transition-transform duration-300 hover:scale-[1.02]"
          style={{
            background: total === 0 ? "#e2e8f0" : `conic-gradient(${gradient})`,
          }}
        >
          <div className="absolute inset-[22px] flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
            <div className="text-2xl font-semibold tracking-tight text-slate-900">
              {active?.value ?? total}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              {active ? active.label : "total"}
            </div>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {slices.map((s) => (
            <li key={s.label}>
              <button
                type="button"
                onMouseEnter={() => setHover(s.label)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(s.label)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                  hover === s.label ? "bg-slate-50" : "hover:bg-slate-50"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="truncate text-slate-600">{s.label}</span>
                <span className="ml-auto font-semibold text-slate-900">
                  {s.value}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function InteractiveBars({
  title,
  data,
  valueLabel,
  onSelect,
}: {
  title: string;
  data: ChartPoint[];
  valueLabel?: string;
  onSelect?: (label: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {valueLabel ? (
          <span className="text-[11px] text-slate-400">{valueLabel}</span>
        ) : null}
      </div>
      <div className="mt-4 flex h-44 items-end gap-2">
        {data.map((d, i) => {
          const h = Math.max(6, (d.value / max) * 100);
          const active = hover === d.label;
          return (
            <button
              key={d.label}
              type="button"
              onMouseEnter={() => setHover(d.label)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(d.label)}
              className="group flex min-w-0 flex-1 flex-col items-center gap-1"
              title={`${d.label}: ${d.value}`}
            >
              <div
                className={`text-[11px] font-semibold transition ${
                  active ? "text-slate-900" : "text-slate-500"
                }`}
              >
                {d.value}
              </div>
              <div className="flex h-32 w-full items-end justify-center">
                <div
                  className="w-full max-w-[40px] rounded-t-lg transition-all duration-300"
                  style={{
                    height: `${h}%`,
                    background: d.color || colorAt(i),
                    opacity: active || !hover ? 1 : 0.35,
                    transform: active ? "scaleX(1.08)" : "scaleX(1)",
                  }}
                />
              </div>
              <div className="w-full truncate text-center text-[10px] text-slate-500">
                {d.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AreaTrend({
  title,
  series,
  color = "#0ea5e9",
  formatValue,
}: {
  title: string;
  series: { label: string; value: number }[];
  color?: string;
  formatValue?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const { path, area, points, max, min } = useMemo(() => {
    const values = series.map((s) => s.value);
    const maxV = Math.max(...values, 1);
    const minV = Math.min(...values, 0);
    const span = Math.max(maxV - minV, 1);
    const w = 100;
    const h = 56;
    const pts = series.map((s, i) => {
      const x = series.length <= 1 ? 0 : (i / (series.length - 1)) * w;
      const y = h - ((s.value - minV) / span) * (h - 4) - 2;
      return { x, y, ...s };
    });
    const line = pts
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");
    const areaPath =
      pts.length === 0
        ? ""
        : `${line} L ${pts[pts.length - 1]!.x.toFixed(2)} ${h} L ${pts[0]!.x.toFixed(2)} ${h} Z`;
    return { path: line, area: areaPath, points: pts, max: maxV, min: minV };
  }, [series]);

  const active = hover != null ? points[hover] : null;
  const latest = series[series.length - 1]?.value ?? 0;
  const prev = series[series.length - 2]?.value ?? latest;
  const delta = latest - prev;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight text-slate-900">
              {formatValue ? formatValue(latest) : latest}
            </span>
            <span
              className={`text-xs font-medium ${
                delta >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {delta >= 0 ? "+" : ""}
              {formatValue ? formatValue(delta) : delta} vs prior day
            </span>
          </div>
        </div>
        {active ? (
          <div className="rounded-lg bg-slate-900 px-2.5 py-1 text-right text-[11px] text-white">
            <div>{active.label}</div>
            <div className="font-semibold">
              {formatValue ? formatValue(active.value) : active.value}
            </div>
          </div>
        ) : null}
      </div>
      <svg
        viewBox="0 0 100 56"
        className="mt-4 h-28 w-full overflow-visible"
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#grad-${color.replace("#", "")})`} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => (
          <circle
            key={p.label}
            cx={p.x}
            cy={p.y}
            r={hover === i ? 2.4 : 1.4}
            fill={color}
            className="cursor-pointer"
            onMouseEnter={() => setHover(i)}
            style={{ transition: "r 120ms" }}
          />
        ))}
        {/* invisible hit targets */}
        {points.map((p, i) => (
          <rect
            key={`hit-${p.label}`}
            x={p.x - 3}
            y={0}
            width={6}
            height={56}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{series[0]?.label}</span>
        <span>
          range {formatValue ? formatValue(min) : min} –{" "}
          {formatValue ? formatValue(max) : max}
        </span>
        <span>{series[series.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function HorizontalRank({
  title,
  rows,
  formatValue,
  onSelect,
}: {
  title: string;
  rows: { id?: string; label: string; value: number; meta?: string }[];
  formatValue?: (n: number) => string;
  onSelect?: (id: string, label: string) => void;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <ul className="mt-3 space-y-2.5">
        {rows.length === 0 ? (
          <li className="text-sm text-slate-400">No data yet</li>
        ) : (
          rows.map((r, i) => (
            <li key={r.id || r.label}>
              <button
                type="button"
                onClick={() => onSelect?.(r.id || r.label, r.label)}
                className="group w-full text-left"
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-slate-700 group-hover:text-sky-700">
                    <span className="mr-2 text-xs text-slate-400">{i + 1}</span>
                    {r.label}
                  </span>
                  <span className="shrink-0 font-semibold text-slate-900">
                    {formatValue ? formatValue(r.value) : r.value}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(r.value / max) * 100}%`,
                      background: colorAt(i),
                    }}
                  />
                </div>
                {r.meta ? (
                  <div className="mt-0.5 text-[10px] text-slate-400">{r.meta}</div>
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  accent = "#0ea5e9",
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </div>
      {hint ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: accent }}
          />
          {hint}
        </div>
      ) : null}
    </Comp>
  );
}

export function HealthGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color =
    clamped >= 80 ? "#10b981" : clamped >= 60 ? "#f59e0b" : "#f43f5e";
  const angle = (clamped / 100) * 180;
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">Platform health</h3>
      <div className="relative mx-auto mt-4 h-24 w-48 overflow-hidden">
        <div
          className="absolute inset-0 rounded-t-full"
          style={{
            background: `conic-gradient(from 180deg, ${color} ${angle}deg, #e2e8f0 ${angle}deg 180deg)`,
            mask: "radial-gradient(farthest-side, transparent 62%, #000 63%)",
            WebkitMask:
              "radial-gradient(farthest-side, transparent 62%, #000 63%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 text-center">
          <div className="text-3xl font-semibold" style={{ color }}>
            {clamped}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            avg score
          </div>
        </div>
      </div>
    </div>
  );
}
