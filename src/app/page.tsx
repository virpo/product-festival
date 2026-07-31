import { FestivalEntry } from "@/components/auth/FestivalEntry";
import { Suspense } from "react";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <FestivalEntry />
    </Suspense>
  );
}
