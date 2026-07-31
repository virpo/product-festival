"use client";

import type { FestivalEvent, Team } from "@/lib/domain/types";
import { Download, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Stripes } from "@/components/brand/Stripes";

function qrUrl(origin: string, code: string) {
  return `${origin.replace(/\/$/, "")}/t/${encodeURIComponent(code)}`;
}

export function QrSheet({
  event,
  teams,
  origin,
}: {
  event: FestivalEvent;
  teams: Team[];
  origin: string;
}) {
  function download(team: Team) {
    const svg = document.querySelector<SVGElement>(`#qr-${team.id} svg`);
    if (!svg) return;
    const serialized = new XMLSerializer().serializeToString(svg);
    const image = new Image();
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 1200;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 150, 150, 900, 900);
      const link = document.createElement("a");
      link.download = `${team.number}-${team.slug}-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  }

  return (
    <main className="qr-sheet-page">
      <header className="qr-sheet-header">
        <div>
          <p className="eyebrow">QR kódy</p>
          <h1>{event.name}</h1>
          <p>Jeden papier na každý tím. Vytlač na A4 alebo stiahni samostatne.</p>
        </div>
        <button className="admin-primary" onClick={() => window.print()} type="button">
          <Printer aria-hidden="true" size={18} /> Vytlačiť všetky
        </button>
      </header>

      <section className="qr-grid">
        {teams.map((team) => {
          const url = qrUrl(origin, team.code);
          return (
            <article className="team-qr-card" data-testid="team-qr" id={`qr-${team.id}`} key={team.id}>
              <div className="qr-card-brand"><Stripes size="sm" /><span>Product Festival</span></div>
              <div className="qr-team-number">Tím {team.number}</div>
              <h2>{team.name}</h2>
              <p>{team.description}</p>
              <div className="qr-code-wrap">
                <QRCodeSVG
                  bgColor="#ffffff"
                  fgColor="#0b0b0d"
                  includeMargin
                  level="M"
                  size={330}
                  value={url}
                />
              </div>
              <strong>Naskenuj. Vyskúšaj. Daj spätnú väzbu.</strong>
              <code>{team.code}</code>
              <small>{url}</small>
              <button className="qr-download" onClick={() => download(team)} type="button">
                <Download aria-hidden="true" size={16} /> PNG
              </button>
            </article>
          );
        })}
      </section>
    </main>
  );
}
