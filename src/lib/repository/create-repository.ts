import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { DemoFestivalRepository } from "./demo-repository";
import type { FestivalRepository, StorageLike } from "./FestivalRepository";
import { SupabaseFestivalRepository } from "./supabase-repository";

export function createFestivalRepository(storage: StorageLike): FestivalRepository {
  const hasSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (!hasSupabase) {
    return new DemoFestivalRepository(storage);
  }

  return new SupabaseFestivalRepository(getSupabaseBrowserClient(), {
    eventSlug: process.env.NEXT_PUBLIC_EVENT_SLUG || "ai-build-week",
  });
}
