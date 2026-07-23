"use client";

import type { FestivalEvent } from "@/lib/domain/types";
import { useState, type FormEvent } from "react";

type SettingsCommands = {
  updateEvent(patch: Partial<FestivalEvent>): Promise<void>;
  resetDemo(): Promise<void>;
};

export function EventSettings({
  event,
  commands,
  isDemo,
}: {
  event: FestivalEvent;
  commands: SettingsCommands;
  isDemo: boolean;
}) {
  const [form, setForm] = useState({
    name: event.name,
    currency: event.currency,
    walletDefault: event.walletDefault,
    maxPerTeam: event.maxPerTeam,
    coverageTarget: event.coverageTarget,
    locksAt: event.locksAt ? event.locksAt.slice(0, 16) : "",
  });
  const [saved, setSaved] = useState(false);

  async function submit(event_: FormEvent) {
    event_.preventDefault();
    await commands.updateEvent({
      ...form,
      locksAt: form.locksAt ? new Date(form.locksAt).toISOString() : null,
    });
    setSaved(true);
  }

  async function reset() {
    if (!window.confirm("Obnoviť demo dáta? Všetky lokálne zmeny sa stratia.")) return;
    await commands.resetDemo();
  }

  return (
    <section>
      <div className="admin-section-heading">
        <div><h2>Nastavenia</h2><p>Jedna udalosť, jeden spoločný priebeh</p></div>
      </div>
      <form className="admin-form settings-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="span-2">
            Názov
            <input
              className="field-input"
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              value={form.name}
            />
          </label>
          <label>
            Mena
            <input
              className="field-input"
              maxLength={3}
              onChange={(event) => setForm({ ...form, currency: event.target.value })}
              value={form.currency}
            />
          </label>
          <label>
            Kredit pre nového človeka
            <input
              className="field-input"
              min={0}
              onChange={(event) =>
                setForm({ ...form, walletDefault: event.currentTarget.valueAsNumber })
              }
              type="number"
              value={form.walletDefault}
            />
          </label>
          <label>
            Maximum pre tím
            <input
              className="field-input"
              min={0}
              onChange={(event) =>
                setForm({ ...form, maxPerTeam: event.currentTarget.valueAsNumber })
              }
              type="number"
              value={form.maxPerTeam}
            />
          </label>
          <label>
            Cieľ pokrytia (%)
            <input
              className="field-input"
              max={100}
              min={0}
              onChange={(event) =>
                setForm({ ...form, coverageTarget: event.currentTarget.valueAsNumber })
              }
              type="number"
              value={form.coverageTarget}
            />
          </label>
          <label className="span-2">
            Plánovaný koniec
            <input
              className="field-input"
              onChange={(event) => setForm({ ...form, locksAt: event.target.value })}
              type="datetime-local"
              value={form.locksAt}
            />
          </label>
        </div>
        <div className="form-footer">
          {saved ? <span>Nastavenia uložené.</span> : null}
          <button className="admin-primary" type="submit">Uložiť nastavenia</button>
        </div>
      </form>
      {isDemo ? (
        <div className="danger-zone">
          <div><strong>Demo dáta</strong><p>Vrátiť lokálnu ukážku do pôvodného stavu.</p></div>
          <button className="admin-danger" onClick={() => void reset()} type="button">Obnoviť demo</button>
        </div>
      ) : null}
    </section>
  );
}
