"use client";

import { PublicWall } from "@/components/wall/PublicWall";
import { useFestival } from "@/lib/repository/useFestival";

export default function WallPage() {
  const { loading, snapshot } = useFestival();

  if (loading || !snapshot) {
    return <main className="wall-loading"><span /><p>Pripájam živé dáta…</p></main>;
  }

  return <PublicWall event={snapshot.event} stats={snapshot.stats} />;
}
