import type {
  EventStats,
  EventStatus,
  FestivalEvent,
  FestivalSnapshot,
  Person,
  PersonRole,
  Signal,
  SignalInput,
  Team,
  TeamMember,
  Visit,
} from "@/lib/domain/types";
import {
  ACCESS_CODE_MAX_LENGTH,
  normalizeAccessCode,
} from "@/lib/domain/access-code";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type {
  FestivalRepository,
  ClaimPersonOptions,
  RepositoryConnectionStatus,
  SavePersonInput,
  SaveTeamInput,
} from "./FestivalRepository";
import { AccessCodeInUseError } from "./FestivalRepository";

export { AccessCodeInUseError } from "./FestivalRepository";

type RepositoryOptions = {
  eventSlug: string;
};

type Row = Record<string, unknown>;

export const AUDIO_URL_TTL_SECONDS = 6 * 60 * 60;
// Re-sign a little before expiry so a cached link cannot go stale mid-playback.
const SIGNED_URL_REFRESH_MARGIN_MS = 5 * 60 * 1_000;

// The reliability RPCs signal every rejected invariant as a bare PL/pgSQL
// identifier. Without this map the organizer sees `membership_locked_after_signal`
// mid-event and cannot tell what to do about it.
const RPC_ERROR_MESSAGES: Record<string, string> = {
  anonymous_auth_required: "Najprv sa prihlás a skús to znova.",
  claim_access_code_first: "Najprv zadaj svoj prístupový kód.",
  cannot_visit_own_team: "Vlastný tím sa nedá navštíviť.",
  current_organizer_cannot_be_removed:
    "Seba ako práve prihláseného organizátora nemôžeš odstrániť.",
  current_organizer_role_required:
    "Sebe ako práve prihlásenému organizátorovi nemôžeš zmeniť rolu.",
  event_name_required: "Názov eventu nemôže byť prázdny.",
  event_not_found: "Event sa nenašiel.",
  invalid_access_code: "Prístupový kód musí mať 1 až 24 znakov.",
  invalid_currency: "Mena môže mať najviac 3 znaky.",
  invalid_event_settings: "Nastavenia eventu sú mimo povoleného rozsahu.",
  invalid_wallet_budget: "Rozpočet nemôže byť negatívny.",
  last_organizer_cannot_be_removed:
    "Posledného organizátora nemôžeš odstrániť.",
  last_organizer_role_required:
    "Poslednému organizátorovi nemôžeš zmeniť rolu.",
  membership_locked_after_signal:
    "Tím sa už nedá zmeniť — tento človek už poslal feedback.",
  organizer_access_required: "Túto akciu môže vykonať iba organizátor.",
  person_name_required: "Meno nemôže byť prázdne.",
  person_not_found: "Človek sa nenašiel.",
  person_with_feedback_cannot_be_removed:
    "Človeka, ktorý už poslal feedback, nemôžeš odstrániť.",
  team_not_available: "Tím nie je dostupný.",
  unknown_access_code: "Tento prístupový kód neexistuje.",
  visits_closed: "Návštevy sa dajú zapisovať iba počas otvoreného eventu.",
  wallet_below_committed_signals:
    "Rozpočet nemôže byť nižší než už rozdelené kredity.",
};

function describeError(message: string): string | null {
  for (const [identifier, translation] of Object.entries(RPC_ERROR_MESSAGES)) {
    if (message.includes(identifier)) {
      return translation;
    }
  }
  // A duplicate access code trips a unique constraint rather than a raised
  // exception, so it arrives as raw Postgres text.
  if (
    message.includes("access_codes_event_normalized_code_key") ||
    message.includes("access_codes_event_id_code_key") ||
    (message.includes("duplicate key") && message.includes("access_codes"))
  ) {
    return "Tento prístupový kód už používa iný človek.";
  }
  return null;
}

function fail(error: { message: string } | null, fallback: string) {
  if (error) {
    throw new Error(describeError(error.message) ?? (error.message || fallback));
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : Number(value) || 0;
}

function mapEvent(value: unknown): FestivalEvent {
  const row = value as Row;
  return {
    id: stringValue(row.id),
    name: stringValue(row.name),
    slug: stringValue(row.slug),
    status: stringValue(row.status) as EventStatus,
    currency: stringValue(row.currency),
    walletDefault: numberValue(row.wallet_default),
    maxPerTeam: numberValue(row.max_per_team),
    coverageTarget: numberValue(row.coverage_target),
    opensAt: nullableString(row.opens_at),
    locksAt: nullableString(row.locks_at),
    resultsReleasedAt: nullableString(row.results_released_at),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  };
}

function mapTeam(value: unknown): Team {
  const row = value as Row;
  return {
    id: stringValue(row.id),
    eventId: stringValue(row.event_id),
    number: numberValue(row.number),
    name: stringValue(row.name),
    slug: stringValue(row.slug),
    code: stringValue(row.code),
    description: stringValue(row.description),
    productUrl: nullableString(row.product_url),
    tableLabel: stringValue(row.table_label),
    color: stringValue(row.color),
    archived: Boolean(row.archived),
    createdAt: stringValue(row.created_at),
  };
}

function mapPerson(value: unknown, accessCode = ""): Person {
  const row = value as Row;
  return {
    id: stringValue(row.id),
    eventId: stringValue(row.event_id),
    name: stringValue(row.name),
    role: stringValue(row.role) as PersonRole,
    walletBudget: numberValue(row.wallet_budget),
    accessCode: accessCode || stringValue(row.access_code),
    authUserId: nullableString(row.auth_user_id),
    lastSeenAt: nullableString(row.last_seen_at),
    createdAt: stringValue(row.created_at),
  };
}

function mapMember(value: unknown): TeamMember {
  const row = value as Row;
  return {
    id: stringValue(row.id),
    eventId: stringValue(row.event_id),
    teamId: stringValue(row.team_id),
    personId: stringValue(row.person_id),
  };
}

function mapVisit(value: unknown): Visit {
  const row = value as Row;
  return {
    id: stringValue(row.id),
    eventId: stringValue(row.event_id),
    personId: stringValue(row.person_id),
    teamId: stringValue(row.team_id),
    firstVisitedAt: stringValue(row.first_visited_at),
    lastVisitedAt: stringValue(row.last_visited_at),
  };
}

function mapSignal(value: unknown): Signal {
  const row = value as Row;
  return {
    id: stringValue(row.id),
    eventId: stringValue(row.event_id),
    investorId: stringValue(row.investor_id),
    teamId: stringValue(row.team_id),
    amount: numberValue(row.amount),
    feedbackText: stringValue(row.feedback_text),
    audioPath: nullableString(row.audio_path),
    audioUrl: null,
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  };
}

function mapStats(value: unknown): EventStats | null {
  if (!value) return null;
  const row = value as Row;
  const roles = (row.role_participation ?? {}) as Row;
  return {
    eventId: stringValue(row.event_id),
    peopleCount: numberValue(row.people_count),
    activePeople: numberValue(row.active_people),
    teamCount: numberValue(row.team_count),
    visitCount: numberValue(row.visit_count),
    signalCount: numberValue(row.signal_count),
    feedbackCount: numberValue(row.feedback_count),
    recordingCount: numberValue(row.recording_count),
    totalInvested: numberValue(row.total_invested),
    budgetTotal: numberValue(row.budget_total),
    budgetDistributed: numberValue(row.budget_distributed),
    budgetRemaining: numberValue(row.budget_remaining),
    budgetDistributedPercent: numberValue(
      row.budget_distributed_percent,
    ),
    coverageQualifiedPeople: numberValue(row.coverage_qualified_people),
    coveragePercent: numberValue(row.coverage_percent),
    averageCoverage: numberValue(row.average_coverage),
    roleParticipation: {
      participant: numberValue(roles.participant),
      mentor: numberValue(roles.mentor),
      organizer: numberValue(roles.organizer),
      observer: numberValue(roles.observer),
    },
    updatedAt: stringValue(row.updated_at),
  };
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateCode(value: string): string {
  const base = slugify(value).replace(/-/g, "").slice(0, 7).toUpperCase();
  const suffix = crypto.getRandomValues(new Uint16Array(1))[0] % 90 + 10;
  return `${base || "ENTRY"}${suffix}`;
}

export class SupabaseFestivalRepository implements FestivalRepository {
  readonly mode = "supabase" as const;

  constructor(
    private readonly client: SupabaseClient,
    private readonly options: RepositoryOptions,
  ) {}

  private async getEvent(): Promise<FestivalEvent> {
    const { data, error } = await this.client
      .from("events")
      .select("*")
      .eq("slug", this.options.eventSlug)
      .single();
    fail(error, "Festival sa nenašiel.");
    return mapEvent(data);
  }

  // Signed links last six hours, so re-signing every recording on every snapshot
  // is pure waste: an organizer device refreshes on invalidations and on the
  // safety poll, and the cost grows with every recording in the event.
  private readonly signedAudioUrls = new Map<
    string,
    { url: string; expiresAt: number }
  >();

  private async withSignedAudio(signals: Signal[]): Promise<Signal[]> {
    const now = Date.now();

    return Promise.all(
      signals.map(async (signal) => {
        if (!signal.audioPath) return signal;

        const cached = this.signedAudioUrls.get(signal.audioPath);
        if (cached && cached.expiresAt > now) {
          return { ...signal, audioUrl: cached.url };
        }

        const { data, error } = await this.client.storage
          .from("festival-feedback")
          .createSignedUrl(signal.audioPath, AUDIO_URL_TTL_SECONDS);
        if (error) {
          return { ...signal, audioUrl: null };
        }

        this.signedAudioUrls.set(signal.audioPath, {
          url: data.signedUrl,
          expiresAt:
            now + AUDIO_URL_TTL_SECONDS * 1_000 - SIGNED_URL_REFRESH_MARGIN_MS,
        });
        return { ...signal, audioUrl: data.signedUrl };
      }),
    );
  }

  async getSnapshot(): Promise<FestivalSnapshot> {
    const event = await this.getEvent();
    const [
      teamsResponse,
      statsResponse,
      sessionResponse,
    ] = await Promise.all([
      this.client.from("teams").select("*").eq("event_id", event.id).order("number"),
      this.client.from("event_stats").select("*").eq("event_id", event.id).maybeSingle(),
      this.client.auth.getSession(),
    ]);
    fail(teamsResponse.error, "Tímy sa nepodarilo načítať.");
    fail(statsResponse.error, "Štatistiky sa nepodarilo načítať.");

    if (!sessionResponse.data.session) {
      return {
        event,
        teams: (teamsResponse.data ?? []).map(mapTeam),
        people: [],
        teamMembers: [],
        visits: [],
        signals: [],
        stats: mapStats(statsResponse.data),
      };
    }

    const [
      peopleResponse,
      codesResponse,
      membersResponse,
      visitsResponse,
      signalsResponse,
    ] = await Promise.all([
      this.client.from("people").select("*").eq("event_id", event.id),
      this.client.from("access_codes").select("person_id, code").eq("event_id", event.id),
      this.client.from("team_members").select("*").eq("event_id", event.id),
      this.client.from("visits").select("*").eq("event_id", event.id),
      this.client.from("signals").select("*").eq("event_id", event.id),
    ]);
    fail(peopleResponse.error, "Ľudia sa nepodarilo načítať.");
    fail(codesResponse.error, "Prístupové kódy sa nepodarilo načítať.");
    fail(membersResponse.error, "Tímy sa nepodarilo načítať.");
    fail(visitsResponse.error, "Návštevy sa nepodarilo načítať.");
    fail(signalsResponse.error, "Feedback sa nepodarilo načítať.");
    const codes = new Map(
      (codesResponse.data ?? []).map((value) => {
        const row = value as Row;
        return [stringValue(row.person_id), stringValue(row.code)];
      }),
    );
    const signals = await this.withSignedAudio(
      (signalsResponse.data ?? []).map(mapSignal),
    );

    return {
      event,
      teams: (teamsResponse.data ?? []).map(mapTeam),
      people: (peopleResponse.data ?? []).map((value) => {
        const row = value as Row;
        return mapPerson(value, codes.get(stringValue(row.id)) ?? "");
      }),
      teamMembers: (membersResponse.data ?? []).map(mapMember),
      visits: (visitsResponse.data ?? []).map(mapVisit),
      signals,
      stats: mapStats(statsResponse.data),
    };
  }

  async getCurrentPerson(): Promise<Person | null> {
    const { data: userData } = await this.client.auth.getUser();
    if (!userData.user) return null;
    const { data, error } = await this.client
      .from("people")
      .select("*")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();
    fail(error, "Prihlásenie sa nepodarilo načítať.");
    return data ? mapPerson(data) : null;
  }

  subscribe(
    listener: () => void,
    connectionListener?: (status: RepositoryConnectionStatus) => void,
  ): () => void {
    const channel: RealtimeChannel = this.client
      .channel(`festival-${this.options.eventSlug}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
          filter: `slug=eq.${this.options.eventSlug}`,
        },
        listener,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_stats" },
        listener,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        listener,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "people" },
        listener,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_members" },
        listener,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          connectionListener?.("connected");
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          connectionListener?.("disconnected");
        }
      });

    return () => {
      void channel.unsubscribe();
    };
  }

  async claimPerson(
    accessCode: string,
    options: ClaimPersonOptions = {},
  ): Promise<Person> {
    const session = await this.client.auth.getSession();
    if (!session.data.session) {
      const { error } = await this.client.auth.signInAnonymously();
      fail(error, "Anonymné prihlásenie zlyhalo.");
    }
    const { data, error } = await this.client.rpc("claim_person", {
      allow_takeover: options.takeover ?? false,
      claim_code: accessCode.trim().toUpperCase(),
      claim_event_slug: this.options.eventSlug,
    });
    if (error?.message.includes("access_code_in_use")) {
      throw new AccessCodeInUseError();
    }
    fail(error, "Neznámy prístupový kód.");
    const row = Array.isArray(data) ? data[0] : data;
    return mapPerson(row, accessCode.trim().toUpperCase());
  }

  async signOut(): Promise<void> {
    try {
      const event = await this.getEvent();
      await this.client.rpc("release_current_person", {
        target_event_id: event.id,
      });
    } finally {
      await this.client.auth.signOut();
    }
  }

  async touchPresence(personId: string): Promise<void> {
    void personId;
    const event = await this.getEvent();
    const { error } = await this.client.rpc("touch_presence", {
      target_event_id: event.id,
    });
    fail(error, "Prítomnosť sa nepodarilo uložiť.");
  }

  async markVisit(teamId: string): Promise<void> {
    const event = await this.getEvent();
    const { error } = await this.client.rpc("record_visit", {
      target_event_id: event.id,
      target_team_id: teamId,
    });
    fail(error, "Návštevu sa nepodarilo uložiť.");
  }

  // `true` when the stored signal already references this path, `false` when it
  // provably does not, and `null` when the lookup itself failed and the outcome
  // stays unknown.
  private async audioPathCommitted(
    eventId: string,
    investorId: string,
    teamId: string,
    audioPath: string,
  ): Promise<boolean | null> {
    const { data, error } = await this.client
      .from("signals")
      .select("audio_path")
      .eq("event_id", eventId)
      .eq("investor_id", investorId)
      .eq("team_id", teamId)
      .maybeSingle();
    if (error) {
      return null;
    }
    return stringValue(data?.audio_path) === audioPath;
  }

  async upsertSignal(input: SignalInput, audio?: Blob | null): Promise<Signal> {
    const event = await this.getEvent();
    const { data: existingData } = await this.client
      .from("signals")
      .select("*")
      .eq("event_id", event.id)
      .eq("investor_id", input.investorId)
      .eq("team_id", input.teamId)
      .maybeSingle();
    const existing = existingData ? mapSignal(existingData) : null;
    let audioPath =
      input.audioPath === "pending-recording" ? null : input.audioPath;

    if (audio) {
      const extension = audio.type.includes("mp4")
        ? "m4a"
        : audio.type.includes("ogg")
          ? "ogg"
          : "webm";
      audioPath = `${event.id}/${input.investorId}/${input.teamId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await this.client.storage
        .from("festival-feedback")
        .upload(audioPath, audio, { contentType: audio.type, upsert: false });
      fail(error, "Nahrávku sa nepodarilo uložiť.");
    }

    const { data, error } = await this.client.rpc("save_signal", {
      signal_event_id: event.id,
      signal_team_id: input.teamId,
      signal_amount: input.amount,
      signal_feedback_text: input.feedbackText,
      signal_audio_path: audioPath,
    });
    if (error) {
      if (audioPath && audio) {
        // The error may be a lost response for a transaction the database
        // already committed. Removing the object then leaves a committed signal
        // pointing at a deleted recording and the feedback is gone for good, so
        // delete only once we positively know the database did not adopt it.
        // An orphaned object is recoverable; a missing referenced one is not.
        const committed = await this.audioPathCommitted(
          event.id,
          input.investorId,
          input.teamId,
          audioPath,
        );
        if (committed === false) {
          await this.client.storage
            .from("festival-feedback")
            .remove([audioPath]);
        }
      }
      fail(error, "Feedback sa nepodarilo uložiť.");
    }

    if (existing?.audioPath && existing.audioPath !== audioPath) {
      await this.client.storage
        .from("festival-feedback")
        .remove([existing.audioPath]);
    }
    const signal = mapSignal(data);
    return (await this.withSignedAudio([signal]))[0];
  }

  async removeSignal(investorId: string, teamId: string): Promise<void> {
    const event = await this.getEvent();
    const { data: existingData } = await this.client
      .from("signals")
      .select("audio_path")
      .eq("event_id", event.id)
      .eq("investor_id", investorId)
      .eq("team_id", teamId)
      .maybeSingle();
    const { error } = await this.client.rpc("remove_signal", {
      signal_event_id: event.id,
      signal_team_id: teamId,
    });
    fail(error, "Investíciu sa nepodarilo odstrániť.");
    const path = existingData
      ? nullableString((existingData as Row).audio_path)
      : null;
    if (path) {
      await this.client.storage.from("festival-feedback").remove([path]);
    }
  }

  async saveTeam(input: SaveTeamInput): Promise<Team> {
    const event = await this.getEvent();
    const payload = {
      event_id: event.id,
      name: input.name.trim(),
      number: input.number,
      code: (input.code || generateCode(input.name)).trim().toUpperCase(),
      slug: slugify(input.name),
      description: input.description.trim(),
      product_url: input.productUrl || null,
      table_label: input.tableLabel.trim(),
      color: input.color,
    };
    const query = input.id
      ? this.client.from("teams").update(payload).eq("id", input.id)
      : this.client.from("teams").insert(payload);
    const { data, error } = await query.select("*").single();
    fail(error, "Tím sa nepodarilo uložiť.");
    return mapTeam(data);
  }

  async removeTeam(teamId: string): Promise<void> {
    const { error } = await this.client.rpc("remove_team", {
      target_team_id: teamId,
    });
    fail(error, "Tím sa nepodarilo odstrániť.");
  }

  async savePerson(input: SavePersonInput): Promise<Person> {
    const event = await this.getEvent();
    const code = normalizeAccessCode(
      input.accessCode || generateCode(input.name),
    );

    if (code.length > ACCESS_CODE_MAX_LENGTH) {
      throw new Error(
        `Prístupový kód môže mať najviac ${ACCESS_CODE_MAX_LENGTH} znakov.`,
      );
    }

    const { data, error } = await this.client.rpc("save_person", {
      target_access_code: code,
      target_event_id: event.id,
      target_name: input.name.trim(),
      target_person_id: input.id ?? null,
      target_role: input.role,
      target_team_id: input.teamId ?? null,
      target_wallet_budget: input.walletBudget,
    });
    fail(error, "Človeka sa nepodarilo uložiť.");
    return mapPerson(data, code);
  }

  async removePerson(personId: string): Promise<void> {
    const { error } = await this.client.rpc("remove_person", {
      target_person_id: personId,
    });
    fail(error, "Človeka sa nepodarilo odstrániť.");
  }

  async updateEvent(patch: Partial<FestivalEvent>): Promise<FestivalEvent> {
    const event = await this.getEvent();
    const { data, error } = await this.client.rpc("update_event_settings", {
      target_coverage_target:
        patch.coverageTarget ?? event.coverageTarget,
      target_currency: patch.currency ?? event.currency,
      target_event_id: event.id,
      target_locks_at:
        patch.locksAt === undefined ? event.locksAt : patch.locksAt,
      target_max_per_team: patch.maxPerTeam ?? event.maxPerTeam,
      target_name: patch.name ?? event.name,
      target_wallet_default: patch.walletDefault ?? event.walletDefault,
    });
    fail(error, "Nastavenia sa nepodarilo uložiť.");
    return mapEvent(data);
  }

  async advanceEvent(status: EventStatus): Promise<FestivalEvent> {
    const event = await this.getEvent();
    const { data, error } = await this.client.rpc("advance_event", {
      target_event_id: event.id,
      target_status: status,
    });
    fail(error, "Stav festivalu sa nepodarilo zmeniť.");
    return mapEvent(data);
  }

  async resetDemo(): Promise<void> {
    throw new Error("Produkčné dáta sa nedajú obnoviť týmto tlačidlom.");
  }
}
