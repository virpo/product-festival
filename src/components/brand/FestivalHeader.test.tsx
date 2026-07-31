import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FestivalHeader } from "./FestivalHeader";

describe("FestivalHeader", () => {
  it("keeps useful content around one centered stripe mark", () => {
    render(
      <FestivalHeader
        left={<span>Prehľad</span>}
        right={<span>85🥞</span>}
      />,
    );

    expect(screen.getByText("Prehľad")).toBeInTheDocument();
    expect(screen.getByText("85🥞")).toBeInTheDocument();
    expect(screen.getByLabelText("Product Festival")).toBeInTheDocument();
  });
});
