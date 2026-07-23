"use client";

import type { FestivalSnapshot, Team } from "@/lib/domain/types";
import type { SaveTeamInput } from "@/lib/repository/FestivalRepository";
import { ExternalLink, Pencil, Plus, QrCode, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

type TeamCommands = {
  saveTeam(input: SaveTeamInput): Promise<void>;
  removeTeam(teamId: string): Promise<void>;
};

const blank = (nextNumber: number): SaveTeamInput => ({
  name: "",
  number: nextNumber,
  code: "",
  description: "",
  productUrl: null,
  tableLabel: `Stôl ${nextNumber}`,
  color: "#62c5c0",
});

export function TeamsTable({
  snapshot,
  commands,
}: {
  snapshot: FestivalSnapshot;
  commands: TeamCommands;
}) {
  const [form, setForm] = useState<SaveTeamInput | null>(null);
  const [error, setError] = useState("");
  const activeTeams = snapshot.teams.filter((team) => !team.archived);

  function edit(team: Team) {
    setForm({
      id: team.id,
      name: team.name,
      number: team.number,
      code: team.code,
      description: team.description,
      productUrl: team.productUrl,
      tableLabel: team.tableLabel,
      color: team.color,
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setError("");
    try {
      await commands.saveTeam(form);
      setForm(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Tím sa nepodarilo uložiť.");
    }
  }

  async function remove(team: Team) {
    if (!window.confirm(`Odstrániť tím ${team.name}?`)) return;
    await commands.removeTeam(team.id);
  }

  return (
    <section>
      <div className="admin-section-heading">
        <div>
          <h2>Tímy</h2>
          <p>{activeTeams.length} aktívnych tímov</p>
        </div>
        <div>
          <Link className="admin-secondary" href="/admin/qr">
            <QrCode aria-hidden="true" size={17} /> QR kódy
          </Link>
          <button
            className="admin-primary"
            onClick={() =>
              setForm(blank(Math.max(0, ...activeTeams.map((team) => team.number)) + 1))
            }
            type="button"
          >
            <Plus aria-hidden="true" size={17} /> Pridať tím
          </button>
        </div>
      </div>

      {form ? (
        <form className="admin-form" onSubmit={submit}>
          <div className="admin-form-title">
            <h3>{form.id ? "Upraviť tím" : "Nový tím"}</h3>
            <button aria-label="Zavrieť formulár tímu" onClick={() => setForm(null)} type="button">
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          <div className="form-grid">
            <label>
              Názov
              <input
                className="field-input"
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                value={form.name}
              />
            </label>
            <label>
              Číslo
              <input
                className="field-input"
                min={1}
                onChange={(event) =>
                  setForm({ ...form, number: event.currentTarget.valueAsNumber })
                }
                required
                type="number"
                value={form.number}
              />
            </label>
            <label>
              Krátky kód
              <input
                className="field-input code-input"
                onChange={(event) =>
                  setForm({ ...form, code: event.target.value.toUpperCase() })
                }
                placeholder="Vytvorí sa automaticky"
                value={form.code}
              />
            </label>
            <label>
              Označenie stola
              <input
                className="field-input"
                onChange={(event) =>
                  setForm({ ...form, tableLabel: event.target.value })
                }
                value={form.tableLabel}
              />
            </label>
            <label className="span-2">
              Jedna veta
              <input
                className="field-input"
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="Čo si človek pri stole vyskúša"
                value={form.description}
              />
            </label>
            <label className="span-2">
              Produkt URL
              <input
                className="field-input"
                onChange={(event) =>
                  setForm({ ...form, productUrl: event.target.value || null })
                }
                placeholder="https://"
                type="url"
                value={form.productUrl ?? ""}
              />
            </label>
            <label>
              Farba
              <input
                className="color-input"
                onChange={(event) => setForm({ ...form, color: event.target.value })}
                type="color"
                value={form.color}
              />
            </label>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="admin-primary" type="submit">Uložiť tím</button>
        </form>
      ) : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Tím</th>
              <th>Kód</th>
              <th>Produkt</th>
              <th>Členovia</th>
              <th><span className="sr-only">Akcie</span></th>
            </tr>
          </thead>
          <tbody>
            {activeTeams.map((team) => {
              const memberIds = snapshot.teamMembers
                .filter((item) => item.teamId === team.id)
                .map((item) => item.personId);
              const members = snapshot.people.filter((person) =>
                memberIds.includes(person.id),
              );
              return (
                <tr key={team.id}>
                  <td><span className="team-dot" style={{ background: team.color }} />{team.number}</td>
                  <td><strong>{team.name}</strong><small>{team.tableLabel}</small></td>
                  <td><code>{team.code}</code></td>
                  <td>
                    {team.productUrl ? (
                      <a href={team.productUrl} rel="noreferrer" target="_blank">
                        Otvoriť <ExternalLink aria-hidden="true" size={13} />
                      </a>
                    ) : <span className="table-muted">—</span>}
                  </td>
                  <td>{members.map((person) => person.name).join(", ") || "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button aria-label={`Upraviť ${team.name}`} onClick={() => edit(team)} type="button">
                        <Pencil aria-hidden="true" size={15} />
                      </button>
                      <button aria-label={`Odstrániť ${team.name}`} onClick={() => void remove(team)} type="button">
                        <Trash2 aria-hidden="true" size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
