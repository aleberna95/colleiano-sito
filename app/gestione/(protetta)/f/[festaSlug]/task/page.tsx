import { StatoVuoto, TitoloPagina } from "@/components/comuni";

// I task arrivano con la milestone M3.
export default function TaskPage() {
  return (
    <>
      <TitoloPagina titolo="Task" />
      <StatoVuoto titolo="In arrivo">Qui si organizzerà chi fa cosa.</StatoVuoto>
    </>
  );
}
