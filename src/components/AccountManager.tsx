import { useState } from "react";
import { type ZoneId } from "@shared/zones";
import ZoneChipGrid from "./ZoneChipGrid";
import type { AccountColumn } from "@shared/types";
import { api } from "../api";
import Sheet from "./Sheet";

type Props = {
  open: boolean;
  onClose: () => void;
  columns: AccountColumn[];
  onChanged: () => void;
};

export default function AccountManager({ open, onClose, columns, onChanged }: Props) {
  const [handle, setHandle] = useState("");
  const [zones, setZones] = useState<ZoneId[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const toggleZone = (id: ZoneId) =>
    setZones((prev) => (prev.includes(id) ? prev.filter((z) => z !== id) : [...prev, id]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = handle.replace(/^@/, "").trim();
    if (!clean) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await api.addAccount(clean, zones);
      setOk(`Added ${res.account.name} (@${res.account.handle})`);
      setHandle("");
      setZones([]);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const drop = async (h: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.removeAccount(h);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Monitored accounts" open={open} onClose={onClose} variant="modal">
      <form className="sheet__group" onSubmit={submit}>
        <div className="sheet__legend">Add an X account</div>
        <div className="addrow">
          <input
            className="search__input"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@handle"
            aria-label="X handle to add"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button type="submit" className="iconbtn" disabled={busy}>
            {busy ? "…" : "Add"}
          </button>
        </div>
        <div className="sheet__legend" style={{ marginTop: "var(--s4)" }}>
          Assign to zones (optional — blank means global)
        </div>
        <p className="note" style={{ border: 0, padding: "0 0 var(--s3)", margin: 0 }}>
          Passage tabs also surface related tags (e.g. Red Sea shows Mideast accounts). Global desks
          appear everywhere; their posts enter a zone only when the headline text matches that zone.
        </p>
        <ZoneChipGrid mode="multi" selected={zones} onToggle={toggleZone} showAccentDot={false} />
        {error && <div className="error-text">{error}</div>}
        {ok && <div className="ok-text">{ok}</div>}
        <p className="note" style={{ border: 0, paddingLeft: 0 }}>
          The handle is fetched before it is saved, so a typo or a protected account is rejected
          rather than becoming a dead column.
        </p>
      </form>

      <div className="sheet__group">
        <div className="sheet__legend">On the deck ({columns.length})</div>
        {columns.map((c) => (
          <div className="acctrow" key={c.handle}>
            <span className="acctrow__accent" style={{ background: c.accent }} />
            <div className="acctrow__who">
              <span className="acctrow__name">
                {c.name}
                {c.state && <span className="tag tag--grey">{c.state}</span>}
                {c.analysis && <span className="tag tag--blue">analysis</span>}
              </span>
              <span className="acctrow__handle mono">
                @{c.handle} · {c.cadence}/day
                {c.error ? " · error" : ""}
              </span>
            </div>
            <button
              type="button"
              className="iconbtn"
              onClick={() => drop(c.handle)}
              aria-label={`Remove @${c.handle}`}
              disabled={busy}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
