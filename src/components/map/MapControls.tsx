/**
 * The map's layer controls, on desktop.
 *
 * Replaces four permanently-open chip rows plus an always-expanded pact selector,
 * which between them covered about two thirds of the map viewport and had no
 * collapse at all. Three rules now hold:
 *
 *  - The whole stack folds to a single bar in one click, and remembers that.
 *  - One group is expanded at a time, so a new overlay costs a chip inside an
 *    existing group rather than another permanent row.
 *  - Nothing in here is prose. The pact-class explanations that used to sit under
 *    every section header are in the pact-class sheet instead.
 */
import AllianceSelector from "../AllianceSelector";
import {
  BASEMAPS,
  LAYER_GROUPS,
  activeOverlayCount,
  type Basemap,
  type LayerGroupId,
  type LayerState,
  type OverlayDef,
  type OverlayKey,
} from "./layers";
import type { MapCtlState } from "../../prefs";

type Common = {
  layers: LayerState;
  basemap: Basemap;
  alliancePicks: string[];
  onToggle: (key: OverlayKey) => void;
  onBasemap: (next: Basemap) => void;
  onAlliancePicks: (next: string[]) => void;
  onPactInfo: () => void;
  onClearAll: () => void;
  onRestoreDefaults: () => void;
  /** Country outlines have arrived. Until they do a pick cannot paint anything. */
  shapesReady: boolean;
};

function LayerResetActions({
  onClearAll,
  onRestoreDefaults,
  className = "mapctl__actions",
}: {
  onClearAll: () => void;
  onRestoreDefaults: () => void;
  className?: string;
}) {
  return (
    <div className={className} role="group" aria-label="Layer presets">
      <button type="button" className="mapctl__action" onClick={onClearAll} title="Turn off every overlay and clear pact picks">
        Clear all
      </button>
      <button
        type="button"
        className="mapctl__action mapctl__action--accent"
        onClick={onRestoreDefaults}
        title="Conflict-focused defaults: Ukraine-style stack, NATO + EU pacts, dark basemap"
      >
        Restore defaults
      </button>
    </div>
  );
}

function OverlayChip({
  overlay,
  on,
  onToggle,
}: {
  overlay: OverlayDef;
  on: boolean;
  onToggle: (key: OverlayKey) => void;
}) {
  return (
    <button
      type="button"
      className="chip"
      aria-pressed={on}
      onClick={() => onToggle(overlay.id)}
      title={overlay.hint}
    >
      <span className="chip__dot" style={{ background: overlay.color }} />
      {overlay.label}
    </button>
  );
}

function BasemapChips({ basemap, onBasemap }: { basemap: Basemap; onBasemap: (next: Basemap) => void }) {
  return (
    <>
      {BASEMAPS.map((b) => (
        <button
          key={b.id}
          type="button"
          className="chip"
          aria-pressed={basemap === b.id}
          onClick={() => onBasemap(b.id)}
        >
          {b.label}
        </button>
      ))}
    </>
  );
}

function GroupBody({ group, ...rest }: Common & { group: LayerGroupId }) {
  const { layers, basemap, alliancePicks, onToggle, onBasemap, onAlliancePicks, onPactInfo, shapesReady } = rest;
  const def = LAYER_GROUPS.find((g) => g.id === group);
  if (!def) return null;

  if (group === "basemap") {
    return (
      <div className="mapctl__grid">
        <BasemapChips basemap={basemap} onBasemap={onBasemap} />
      </div>
    );
  }

  if (group === "pacts") {
    return (
      <>
        <div className="mapctl__note">
          <span>
            {alliancePicks.length > 0 && !shapesReady
              ? "Fetching country outlines — the fills land as soon as they arrive."
              : "Picking a grouping paints it. Clearing every pick clears the layer."}
          </span>
          <button type="button" className="mapctl__info" onClick={onPactInfo}>
            What the classes mean
          </button>
        </div>
        <AllianceSelector picks={alliancePicks} onPicks={onAlliancePicks} showBlurbs={false} />
      </>
    );
  }

  return (
    <div className="mapctl__grid">
      {def.overlays.map((o) => (
        <OverlayChip key={o.id} overlay={o} on={layers[o.id]} onToggle={onToggle} />
      ))}
    </div>
  );
}

/** Live count per group, so a folded group still reports whether anything is on. */
function groupCount(group: LayerGroupId, layers: LayerState, pactCount: number): number {
  if (group === "pacts") return pactCount;
  if (group === "basemap") return 0;
  const def = LAYER_GROUPS.find((g) => g.id === group);
  return def ? def.overlays.filter((o) => layers[o.id]).length : 0;
}

export default function MapControls({ ctl, onCtl, ...rest }: Common & {
  ctl: MapCtlState;
  onCtl: (next: MapCtlState) => void;
}) {
  const { layers, alliancePicks } = rest;
  const total = activeOverlayCount(layers, alliancePicks.length);

  // Re-clicking the open group folds the body: the panel can be open as a tab
  // strip with nothing expanded, which is the useful middle state.
  const pickGroup = (id: LayerGroupId) => onCtl({ open: true, group: ctl.group === id ? null : id });

  return (
    <div className={`mapctl ${ctl.open ? "is-open" : "is-folded"}`}>
      <div className="mapctl__bar">
        <button
          type="button"
          className="mapctl__fold"
          aria-expanded={ctl.open}
          aria-controls="mapctl-body"
          title={ctl.open ? "Fold the layer panel away from the map" : "Unfold the layer panel"}
          onClick={() => onCtl({ ...ctl, open: !ctl.open })}
        >
          <span aria-hidden="true">{ctl.open ? "▾" : "▸"}</span>
          Layers
          <span className="mapctl__count mono">{total}</span>
        </button>

        {ctl.open && (
          <div className="mapctl__tabs" role="group" aria-label="Layer groups">
            {LAYER_GROUPS.map((g) => {
              const count = groupCount(g.id, layers, alliancePicks.length);
              return (
                <button
                  key={g.id}
                  type="button"
                  className="mapctl__tab"
                  aria-pressed={ctl.group === g.id}
                  onClick={() => pickGroup(g.id)}
                  title={g.hint}
                >
                  {g.label}
                  {count > 0 && <span className="mapctl__count mono">{count}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {ctl.open && (
        <LayerResetActions onClearAll={rest.onClearAll} onRestoreDefaults={rest.onRestoreDefaults} />
      )}

      {ctl.open && ctl.group && (
        <div className="mapctl__body" id="mapctl-body" data-group={ctl.group}>
          <GroupBody group={ctl.group} {...rest} />
        </div>
      )}
    </div>
  );
}

/**
 * The same controls for the phone sheet, where there is room to scroll and the
 * pact-class explanations can stay inline.
 */
export function MapSheetControls(props: Common) {
  return (
    <>
      <LayerResetActions
        className="sheet__actions mapctl__actions"
        onClearAll={props.onClearAll}
        onRestoreDefaults={props.onRestoreDefaults}
      />
      {LAYER_GROUPS.map((g) => (
        <div className="sheet__group" key={g.id}>
          <div className="sheet__legend">{g.label}</div>
          {g.id === "pacts" ? (
            <AllianceSelector picks={props.alliancePicks} onPicks={props.onAlliancePicks} />
          ) : g.id === "basemap" ? (
            <div className="sheet__grid">
              <BasemapChips basemap={props.basemap} onBasemap={props.onBasemap} />
            </div>
          ) : (
            <div className="sheet__grid">
              {g.overlays.map((o) => (
                <OverlayChip key={o.id} overlay={o} on={props.layers[o.id]} onToggle={props.onToggle} />
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
