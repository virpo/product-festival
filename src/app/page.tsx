import { AppShell } from "@/components/brand/AppShell";

export default function Home() {
  return (
    <AppShell mode="demo">
      <main className="starter">
        <p className="eyebrow">Festival sa pripravuje</p>
        <h1>Produkty do rúk. Feedback naspäť.</h1>
        <p className="lede">
          Naskenuj tím, vyskúšaj produkt a nechaj mu užitočný signál.
        </p>
      </main>
    </AppShell>
  );
}
