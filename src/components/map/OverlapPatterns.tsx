/**
 * The SVG paint servers that country-fill layers reference. Shared by the
 * alliance and sanctions layers — the tile is built from a `PatternSpec`, and
 * neither layer knows what the other's hues mean.
 *
 * Leaflet writes `pathOptions.fillColor` straight into the SVG `fill` attribute,
 * so a polygon can take `url(#alpat-nato-eu)` and get a crosshatch. The patterns
 * live in a hidden inline SVG rather than inside Leaflet's own overlay element
 * because that element is created lazily and replaced on renderer changes, while
 * a same-document `url(#id)` reference resolves regardless of where the paint
 * server sits.
 *
 * `patternUnits="userSpaceOnUse"` is load-bearing: the default scales the tile to
 * each shape's bounding box, which would give Luxembourg the same number of hatch
 * lines as Russia.
 */
import { hatchPath, hatchStroke, tileSize, tintOf, type PatternSpec } from "./overlap-paint";

function Hatch({ spec, tile }: { spec: PatternSpec; tile: number }) {
  return (
    <>
      {spec.hues.map((hue, i) => (
        <path
          key={hue + i}
          d={hatchPath(i, tile)}
          stroke={hatchStroke(hue, spec.density)}
          strokeWidth={1.6 * Math.max(spec.density, 0.55)}
          fill="none"
        />
      ))}
    </>
  );
}

function Dots({ spec }: { spec: PatternSpec }) {
  return (
    <>
      {spec.hues.map((hue, i) => {
        const at = 1.8 + i * 2.4;
        return <circle key={hue + i} cx={at} cy={at} r={1} fill={hatchStroke(hue, spec.density)} />;
      })}
    </>
  );
}

export default function OverlapPatterns({ specs }: { specs: PatternSpec[] }) {
  return (
    <svg className="alpat" aria-hidden="true" focusable="false">
      <defs>
        {specs.map((spec) => {
          const tile = tileSize(spec);
          return (
            <pattern key={spec.id} id={spec.id} width={tile} height={tile} patternUnits="userSpaceOnUse">
              <rect width={tile} height={tile} fill={tintOf(spec)} />
              {spec.dotted ? <Dots spec={spec} /> : <Hatch spec={spec} tile={tile} />}
            </pattern>
          );
        })}
      </defs>
    </svg>
  );
}
