import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import QRCode from "qrcode";
import { Wifi } from "lucide-react";
import { CaricamentoPubblico, LinkGrande } from "@/components/pubblico";
import { testoQrWifi } from "@/lib/mappa";
import { festaInEvidenza, mappa, wifi } from "@/lib/sito-pubblico";

export const metadata: Metadata = { title: "Wi-Fi · Colleiano" };

// Wi-Fi della festa (SPEC 7.1): dove si trova, nome della rete, password e un QR per collegarsi.
export default function WifiPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-6 pb-14">
      <h1 className="text-4xl font-bold">Wi-Fi</h1>
      <Suspense fallback={<CaricamentoPubblico />}>
        <Contenuto />
      </Suspense>
    </div>
  );
}

async function Contenuto() {
  await connection();
  const festa = await festaInEvidenza();
  const [rete, dati] = festa ? await Promise.all([wifi(festa.id), mappa(festa.id)]) : [null, null];
  if (!rete) return <p className="text-lg">Le informazioni sul Wi-Fi arrivano con la prossima festa.</p>;

  // Il QR si disegna sul server: al telefono arriva solo l'immagine.
  const qr = await QRCode.toString(testoQrWifi(rete), {
    type: "svg",
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#1B3022", light: "#FFFFFF" },
  });
  const punto = dati?.punti.find((p) => p.id === rete.puntoId);

  return (
    <>
      <div className="flex flex-col gap-5 rounded-lg bg-white p-5 shadow-sm ring-1 ring-colleiano-forest/10">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold tracking-widest text-colleiano-rust uppercase">Nome della rete</p>
          <p className="flex items-center gap-3 text-3xl font-bold break-all text-colleiano-forest">
            <Wifi className="size-8 shrink-0" aria-hidden />
            {rete.nomeRete}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold tracking-widest text-colleiano-rust uppercase">Password</p>
          {rete.password ? (
            <p className="font-mono text-3xl font-bold break-all select-all">{rete.password}</p>
          ) : (
            <p className="text-xl">Nessuna: la rete è aperta.</p>
          )}
        </div>
      </div>

      {punto ? (
        <>
          <p className="text-lg">
            Il Wi-Fi c&apos;è in un solo posto: <strong>{punto.nome}</strong>. Lontano da lì il telefono non prende: apri il sito qui, poi
            funziona ovunque.
          </p>
          <LinkGrande href={`/mappa?punto=${punto.id}`}>Dove si trova sulla mappa</LinkGrande>
        </>
      ) : (
        <p className="text-lg">Lontano dal Wi-Fi il telefono non prende: apri il sito quando sei collegato, poi funziona ovunque.</p>
      )}

      <section aria-labelledby="titolo-qr" className="flex flex-col items-center gap-3 rounded-lg bg-white p-5 shadow-sm ring-1 ring-colleiano-forest/10">
        <h2 id="titolo-qr" className="self-start text-2xl font-bold">
          Collega chi è con te
        </h2>
        <p className="self-start text-lg">Fai inquadrare questo QR con la fotocamera: si collega senza scrivere nulla.</p>
        <div
          role="img"
          aria-label={`QR per collegarsi alla rete ${rete.nomeRete}`}
          className="w-full max-w-72 [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qr }}
        />
      </section>
    </>
  );
}
