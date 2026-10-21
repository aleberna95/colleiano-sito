import { StatoVuoto, TitoloPagina } from "@/components/comuni";

// Spese e rimborsi arrivano con la milestone M4.
export default function SpesePage() {
  return (
    <>
      <TitoloPagina titolo="Spese" />
      <StatoVuoto titolo="In arrivo">Qui si segneranno le spese e chi deve ricevere i soldi.</StatoVuoto>
    </>
  );
}
