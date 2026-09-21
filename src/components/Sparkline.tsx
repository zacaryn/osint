type Props = {
  values: number[];
  /** Drawn as a dashed horizontal rule so the trend reads against its own baseline. */
  baseline?: number;
  color: string;
  width?: number;
  height?: number;
  label?: string;
};

/**
 * Square, unsmoothed sparkline. The y-axis always starts at zero so a shallow
 * wobble cannot be mistaken for a collapse.
 */
export default function Sparkline({ values, baseline, color, width = 150, height = 26, label }: Props) {
  if (values.length < 2) return null;

  const top = Math.max(...values, baseline ?? 0) || 1;
  const step = width / (values.length - 1);
  const y = (v: number) => height - (Math.max(v, 0) / top) * (height - 2) - 1;
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  return (
    <svg
      className="spark"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label ?? `${values.length} day trend`}
      preserveAspectRatio="none"
    >
      {baseline != null && baseline > 0 && (
        <line
          x1="0"
          x2={width}
          y1={y(baseline)}
          y2={y(baseline)}
          stroke="var(--line-strong)"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      )}
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
