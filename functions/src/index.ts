// Gli schemi Zod si importano da ../../lib/schemas e vengono inclusi nel bundle da esbuild.
import "./setup";

export { creaFesta } from "./feste";
export {
  aggiornaRuoli,
  creaPersona,
  disattivaPersona,
  impostaSuperadmin,
  nuovaPasswordTemporanea,
} from "./persone";
export { storicoTask } from "./tasks";
