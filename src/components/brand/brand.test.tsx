import { render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("renders the Product Festival identity and demo marker", () => {
    render(
      <AppShell mode="demo">
        <p>Content</p>
      </AppShell>,
    );

    expect(screen.getByText("Product Festival")).toBeInTheDocument();
    expect(screen.getByText("Demo dáta")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("accepts a route-specific header", () => {
    render(
      <AppShell header={<div>Vlastná hlavička</div>}>
        <p>Content</p>
      </AppShell>,
    );

    expect(screen.getByText("Vlastná hlavička")).toBeInTheDocument();
    expect(screen.queryByText("Product Festival")).not.toBeInTheDocument();
  });
});
