"use client";

import {
  ACCESS_CODE_MAX_LENGTH,
  normalizeAccessCode,
} from "@/lib/domain/access-code";
import { formatCredits } from "@/lib/domain/credits";
import type { FestivalSnapshot, Person, PersonRole } from "@/lib/domain/types";
import type { SavePersonInput } from "@/lib/repository/FestivalRepository";
import { KeyRound, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";

type PeopleCommands = {
  savePerson(input: SavePersonInput): Promise<void>;
  removePerson(personId: string): Promise<void>;
};

const roles: { value: PersonRole; label: string }[] = [
  { value: "participant", label: "Účastník" },
  { value: "mentor", label: "Mentor" },
  { value: "organizer", label: "Organizátor" },
  { value: "observer", label: "Hosť" },
];

export function PeopleTable({
  snapshot,
  currentPerson,
  commands,
}: {
  snapshot: FestivalSnapshot;
  currentPerson: Person;
  commands: PeopleCommands;
}) {
  const [form, setForm] = useState<SavePersonInput | null>(null);
  const [error, setError] = useState("");

  function teamFor(personId: string) {
    return (
      snapshot.teamMembers.find((item) => item.personId === personId)?.teamId ??
      null
    );
  }

  function edit(person: Person) {
    setForm({
      id: person.id,
      name: person.name,
      role: person.role,
      walletBudget: person.walletBudget,
      accessCode: person.accessCode,
      teamId: teamFor(person.id),
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setError("");
    try {
      await commands.savePerson(form);
      setForm(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Človeka sa nepodarilo uložiť.",
      );
    }
  }

  async function remove(person: Person) {
    if (!window.confirm(`Odstrániť ${person.name}?`)) return;
    setError("");
    try {
      await commands.removePerson(person.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Človeka sa nepodarilo odstrániť.",
      );
    }
  }

  return (
    <section>
      <div className="admin-section-heading">
        <div>
          <h2>Ľudia</h2>
          <p>{snapshot.people.length} prístupových kódov</p>
        </div>
        <button
          className="admin-primary"
          onClick={() =>
            setForm({
              name: "",
              role: "participant",
              walletBudget: snapshot.event.walletDefault,
              accessCode: "",
              teamId: null,
            })
          }
          type="button"
        >
          <Plus aria-hidden="true" size={17} /> Pridať človeka
        </button>
      </div>

      {form ? (
        <form className="admin-form" onSubmit={submit}>
          <div className="admin-form-title">
            <h3>{form.id ? "Upraviť človeka" : "Nový človek"}</h3>
            <button aria-label="Zavrieť formulár človeka" onClick={() => setForm(null)} type="button">
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          <div className="form-grid">
            <label>
              Meno
              <input
                aria-label="Meno"
                className="field-input"
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                value={form.name}
              />
            </label>
            <label>
              Rola
              <select
                aria-label="Rola"
                className="field-select"
                disabled={form.id === currentPerson.id}
                onChange={(event) =>
                  setForm({ ...form, role: event.target.value as PersonRole })
                }
                value={form.role}
              >
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </label>
            <label>
              Kredit
              <input
                aria-label="Kredit"
                className="field-input"
                min={0}
                onChange={(event) =>
                  setForm({ ...form, walletBudget: event.currentTarget.valueAsNumber })
                }
                required
                type="number"
                value={form.walletBudget}
              />
            </label>
            <label>
              Prístupový kód
              <input
                className="field-input code-input"
                maxLength={ACCESS_CODE_MAX_LENGTH}
                onChange={(event) =>
                  setForm({
                    ...form,
                    accessCode: normalizeAccessCode(event.target.value),
                  })
                }
                placeholder="Vytvorí sa automaticky"
                value={form.accessCode ?? ""}
              />
            </label>
            <label className="span-2">
              Tím
              <select
                className="field-select"
                onChange={(event) =>
                  setForm({ ...form, teamId: event.target.value || null })
                }
                value={form.teamId ?? ""}
              >
                <option value="">Bez tímu</option>
                {snapshot.teams
                  .filter((team) => !team.archived)
                  .map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
              </select>
            </label>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="admin-primary" type="submit">Uložiť človeka</button>
        </form>
      ) : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Meno</th>
              <th>Rola</th>
              <th>Tím</th>
              <th>Kredit</th>
              <th>Prístup</th>
              <th><span className="sr-only">Akcie</span></th>
            </tr>
          </thead>
          <tbody>
            {snapshot.people.map((person) => {
              const team = snapshot.teams.find((item) => item.id === teamFor(person.id));
              return (
                <tr key={person.id}>
                  <td><strong>{person.name}</strong></td>
                  <td>{roles.find((role) => role.value === person.role)?.label}</td>
                  <td>{team?.name ?? <span className="table-muted">—</span>}</td>
                  <td>
                    {formatCredits(
                      person.walletBudget,
                      snapshot.event.currency,
                    )}
                  </td>
                  <td><code><KeyRound aria-hidden="true" size={12} />{person.accessCode}</code></td>
                  <td>
                    <div className="row-actions">
                      <button aria-label={`Upraviť ${person.name}`} onClick={() => edit(person)} type="button">
                        <Pencil aria-hidden="true" size={15} />
                      </button>
                      {person.id !== currentPerson.id ? (
                        <button aria-label={`Odstrániť ${person.name}`} onClick={() => void remove(person)} type="button">
                          <Trash2 aria-hidden="true" size={15} />
                        </button>
                      ) : null}
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
