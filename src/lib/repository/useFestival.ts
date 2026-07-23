"use client";

import { useContext } from "react";
import { FestivalContext } from "./repository-context";

export function useFestival() {
  const value = useContext(FestivalContext);

  if (!value) {
    throw new Error("useFestival must be used inside FestivalProvider.");
  }

  return value;
}
