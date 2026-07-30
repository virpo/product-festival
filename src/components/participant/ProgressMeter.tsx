import type { Coverage } from "@/lib/domain/types";

export function ProgressMeter({
  compact = false,
  coverage,
}: {
  compact?: boolean;
  coverage: Coverage;
}) {
  return (
    <div className="progress-meter">
      <div className="progress-label">
        <span>Vyskúšané tímy</span>
        <strong>
          {coverage.visited}/{coverage.available}
        </strong>
      </div>
      <div
        aria-label={`${coverage.percent}% tímov vyskúšaných`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={coverage.percent}
        className="progress-track"
        role="progressbar"
      >
        <span style={{ width: `${coverage.percent}%` }} />
      </div>
      {!compact ? (
        <p>
          Skús aspoň {coverage.target}. Čím viac produktov chytíš do ruky, tým
          lepší bude tvoj signál.
        </p>
      ) : null}
    </div>
  );
}
