"use client";

import type {
  EventStatus,
  FestivalEvent,
  FestivalSnapshot,
  Person,
} from "@/lib/domain/types";
import type {
  SavePersonInput,
  SaveTeamInput,
} from "@/lib/repository/FestivalRepository";
import { LayoutDashboard, Settings, UsersRound, Workflow } from "lucide-react";
import { useState } from "react";
import { EventOverview } from "./EventOverview";
import { EventSettings } from "./EventSettings";
import { PeopleTable } from "./PeopleTable";
import { TeamsTable } from "./TeamsTable";

export type FestivalContextValueForTests = {
  commands: {
    advanceEvent(status: EventStatus): Promise<void>;
    removePerson(personId: string): Promise<void>;
    removeTeam(teamId: string): Promise<void>;
    resetDemo(): Promise<void>;
    savePerson(input: SavePersonInput): Promise<void>;
    saveTeam(input: SaveTeamInput): Promise<void>;
    updateEvent(patch: Partial<FestivalEvent>): Promise<void>;
  };
};

type AdminCommands = FestivalContextValueForTests["commands"];
type Tab = "overview" | "teams" | "people" | "settings";

const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Prehľad", icon: LayoutDashboard },
  { id: "teams", label: "Tímy", icon: Workflow },
  { id: "people", label: "Ľudia", icon: UsersRound },
  { id: "settings", label: "Nastavenia", icon: Settings },
];

export function AdminDashboard({
  snapshot,
  currentPerson,
  commands,
  isDemo = true,
}: {
  snapshot: FestivalSnapshot;
  currentPerson: Person;
  commands: AdminCommands;
  isDemo?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <main className="admin-page">
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Organizátor</p>
          <h1>{snapshot.event.name}</h1>
        </div>
        <a className="admin-secondary" href="/wall" target="_blank">Verejná stena ↗</a>
      </header>

      <nav aria-label="Administrácia" className="admin-tabs" role="tablist">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            aria-selected={tab === id}
            className={tab === id ? "is-active" : ""}
            key={id}
            onClick={() => setTab(id)}
            role="tab"
            type="button"
          >
            <Icon aria-hidden="true" size={17} /> {label}
          </button>
        ))}
      </nav>

      <div className="admin-panel" role="tabpanel">
        {tab === "overview" ? (
          <EventOverview
            commands={commands}
            event={snapshot.event}
            stats={snapshot.stats}
          />
        ) : null}
        {tab === "teams" ? (
          <TeamsTable commands={commands} snapshot={snapshot} />
        ) : null}
        {tab === "people" ? (
          <PeopleTable
            commands={commands}
            currentPerson={currentPerson}
            snapshot={snapshot}
          />
        ) : null}
        {tab === "settings" ? (
          <EventSettings commands={commands} event={snapshot.event} isDemo={isDemo} />
        ) : null}
      </div>
    </main>
  );
}
