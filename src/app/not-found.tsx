import { AppShell } from "@/components/brand/AppShell";
import Link from "next/link";

export default function NotFound() {
  return (
    <AppShell>
      <main className="route-message">
        <p className="eyebrow">404</p>
        <h1>Tu nič nie je.</h1>
        <Link className="primary-button" href="/">Späť na festival</Link>
      </main>
    </AppShell>
  );
}
