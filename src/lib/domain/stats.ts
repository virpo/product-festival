import type {
  Coverage,
  EventStats,
  FestivalSnapshot,
  PersonRole,
} from "./types";

export function coverageFor(
  personId: string,
  snapshot: FestivalSnapshot,
): Coverage {
  const ownTeamIds = new Set(
    snapshot.teamMembers
      .filter((membership) => membership.personId === personId)
      .map((membership) => membership.teamId),
  );
  const availableTeamIds = new Set(
    snapshot.teams
      .filter((team) => !team.archived && !ownTeamIds.has(team.id))
      .map((team) => team.id),
  );
  const visited = new Set(
    snapshot.visits
      .filter(
        (visit) =>
          visit.personId === personId && availableTeamIds.has(visit.teamId),
      )
      .map((visit) => visit.teamId),
  ).size;
  const available = availableTeamIds.size;
  const target =
    available === 0
      ? 0
      : Math.ceil(available * (snapshot.event.coverageTarget / 100));

  return {
    visited,
    available,
    target,
    qualified: target === 0 || visited >= target,
    percent: available === 0 ? 100 : Math.round((visited / available) * 100),
  };
}

function emptyRoleParticipation(): Record<PersonRole, number> {
  return {
    participant: 0,
    mentor: 0,
    organizer: 0,
    observer: 0,
  };
}

export function deriveEventStats(
  snapshot: FestivalSnapshot,
  now = new Date(),
): EventStats {
  const activeCutoff = now.getTime() - 10 * 60 * 1000;
  const coverages = snapshot.people.map((person) => ({
    person,
    coverage: coverageFor(person.id, snapshot),
  }));
  const roleParticipation = emptyRoleParticipation();

  for (const person of snapshot.people) {
    const hasParticipated =
      snapshot.visits.some((visit) => visit.personId === person.id) ||
      snapshot.signals.some((signal) => signal.investorId === person.id);

    if (hasParticipated) {
      roleParticipation[person.role] += 1;
    }
  }

  const activePeople = snapshot.people.filter((person) => {
    if (!person.lastSeenAt) {
      return false;
    }

    return new Date(person.lastSeenAt).getTime() >= activeCutoff;
  }).length;

  return {
    eventId: snapshot.event.id,
    peopleCount: snapshot.people.length,
    activePeople,
    teamCount: snapshot.teams.filter((team) => !team.archived).length,
    visitCount: snapshot.visits.length,
    signalCount: snapshot.signals.length,
    feedbackCount: snapshot.signals.filter(
      (signal) =>
        signal.feedbackText.trim().length > 0 || Boolean(signal.audioPath),
    ).length,
    recordingCount: snapshot.signals.filter((signal) =>
      Boolean(signal.audioPath),
    ).length,
    totalInvested: snapshot.signals.reduce(
      (total, signal) => total + signal.amount,
      0,
    ),
    coverageQualifiedPeople: coverages.filter(
      ({ coverage }) => coverage.qualified,
    ).length,
    coveragePercent:
      coverages.length === 0
        ? 0
        : Math.round(
            (coverages.filter(({ coverage }) => coverage.qualified).length /
              coverages.length) *
              100,
          ),
    averageCoverage:
      coverages.length === 0
        ? 0
        : Number(
            (
              coverages.reduce(
                (total, { coverage }) => total + coverage.visited,
                0,
              ) / coverages.length
            ).toFixed(1),
          ),
    roleParticipation,
    updatedAt: now.toISOString(),
  };
}
