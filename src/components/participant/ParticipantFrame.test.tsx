import { createDemoSnapshot } from "@/lib/repository/demo-data";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ParticipantFrame } from "./ParticipantFrame";

describe("ParticipantFrame", () => {
  const snapshot = createDemoSnapshot(new Date("2026-07-24T10:00:00Z"));
  const participant = snapshot.people.find(
    (person) => person.id === "person-peter",
  )!;
  const mentor = snapshot.people.find((person) => person.role === "mentor")!;

  it("shows the current identity and remaining pancakes", () => {
    render(
      <ParticipantFrame person={participant} snapshot={snapshot}>
        <p>Obsah</p>
      </ParticipantFrame>,
    );

    expect(screen.getByText("Peter · účastník")).toBeInTheDocument();
    expect(screen.getByText("85🥞")).toBeInTheDocument();
    expect(screen.getByText("Obsah")).toBeInTheDocument();
  });

  it("uses the same frame for mentors", () => {
    render(
      <ParticipantFrame person={mentor} snapshot={snapshot}>
        <p>Mentorský obsah</p>
      </ParticipantFrame>,
    );

    expect(screen.getByText("Marek · mentor")).toBeInTheDocument();
  });

  it("renders a useful back destination on task screens", () => {
    render(
      <ParticipantFrame
        back={{ href: "/", label: "Prehľad" }}
        person={participant}
        snapshot={snapshot}
      >
        <p>Skener</p>
      </ParticipantFrame>,
    );

    expect(screen.getByRole("link", { name: "Späť na Prehľad" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
