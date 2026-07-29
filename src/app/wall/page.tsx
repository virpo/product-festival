"use client";

import { PublicWall } from "@/components/wall/PublicWall";
import { InitialLoadState } from "@/components/connection/InitialLoadState";
import { useFestival } from "@/lib/repository/useFestival";

export default function WallPage() {
  const { commands, error, snapshot } = useFestival();

  if (!snapshot) {
    return (
      <InitialLoadState
        error={error}
        label="Pripájam živé dáta…"
        onRetry={commands.refresh}
        variant="wall"
      />
    );
  }

  return <PublicWall event={snapshot.event} stats={snapshot.stats} />;
}
