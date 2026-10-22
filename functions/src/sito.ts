import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { datiPubbliciFesta } from "../../lib/schemas";
import { db } from "./util";

/**
 * Copia in sitoFeste/{festaId} solo i dati pubblici della festa (SPEC 7.3):
 * il sito legge quella copia e il documento della festa resta privato.
 */
export const sitoFesta = onDocumentWritten("feste/{festaId}", async (event) => {
  const ref = db().doc(`sitoFeste/${event.params.festaId}`);
  const dopo = event.data?.after.data();
  if (!dopo) {
    await ref.delete();
    return;
  }
  // Si riscrive sempre: così basta toccare una festa per creare la copia che manca.
  await ref.set(datiPubbliciFesta(dopo as Parameters<typeof datiPubbliciFesta>[0]));
});
