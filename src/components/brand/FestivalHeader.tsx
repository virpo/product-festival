import type { ReactNode } from "react";
import { Stripes } from "./Stripes";

export function FestivalHeader({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <header className="festival-header">
      <div className="festival-header__inner">
        <div className="festival-header__left">{left}</div>
        <span aria-label="Product Festival" className="festival-header__brand">
          <Stripes size="sm" />
        </span>
        <div className="festival-header__right">{right}</div>
      </div>
    </header>
  );
}
