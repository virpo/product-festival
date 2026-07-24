import type { FestivalSnapshot, Person, Team } from "@/lib/domain/types";
import { AudioLines, MessageSquareText, WalletCards } from "lucide-react";

const roleLabel = {
  participant: "účastník",
  mentor: "mentor",
  organizer: "organizátor",
  observer: "hosť",
} as const;

export function TeamReceipt({
  snapshot,
  team,
  viewer,
}: {
  snapshot: FestivalSnapshot;
  team: Team;
  viewer: Person;
}) {
  const canView =
    viewer.role === "organizer" ||
    snapshot.teamMembers.some(
      (membership) =>
        membership.personId === viewer.id && membership.teamId === team.id,
    );

  if (!canView) {
    return (
      <main className="receipt-message">
        <h1>Toto patrí inému tímu.</h1>
      </main>
    );
  }

  if (snapshot.event.status !== "released") {
    return (
      <main className="receipt-message">
        <p className="eyebrow">{team.name}</p>
        <h1>Výsledky ešte nie sú odomknuté.</h1>
        <p>Organizátori ich po skončení pošlú všetkým naraz.</p>
      </main>
    );
  }

  const signals = snapshot.signals
    .filter((signal) => signal.teamId === team.id)
    .sort((a, b) => b.amount - a.amount);
  const total = signals.reduce((sum, signal) => sum + signal.amount, 0);

  return (
    <main className="team-receipt">
      <header className="receipt-heading">
        <div>
          <p className="eyebrow">Tím {team.number}</p>
          <h1>{team.name}</h1>
          <p>{team.description}</p>
        </div>
        <div className="receipt-total">
          <span>Spolu</span>
          <strong>{snapshot.event.currency}{total}</strong>
          <small>{signals.length} feedbackov</small>
        </div>
      </header>

      <section className="receipt-signals">
        {signals.length === 0 ? (
          <div className="empty-state">Tento tím zatiaľ nedostal feedback.</div>
        ) : (
          signals.map((signal) => {
            const author = snapshot.people.find(
              (person) => person.id === signal.investorId,
            );
            return (
              <article key={signal.id}>
                <div className="receipt-author">
                  <div>
                    <strong>{author?.name ?? "Neznámy človek"}</strong>
                    <span>{author ? roleLabel[author.role] : ""}</span>
                  </div>
                  <b>{snapshot.event.currency}{signal.amount}</b>
                </div>
                {signal.feedbackText ? (
                  <p><MessageSquareText aria-hidden="true" size={17} />{signal.feedbackText}</p>
                ) : null}
                {signal.audioUrl ? (
                  <div className="receipt-audio">
                    <AudioLines aria-hidden="true" size={17} />
                    <audio controls src={signal.audioUrl}><track kind="captions" /></audio>
                  </div>
                ) : null}
                {!signal.feedbackText && !signal.audioUrl ? (
                  <p><WalletCards aria-hidden="true" size={17} />Investícia bez textovej poznámky</p>
                ) : null}
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
