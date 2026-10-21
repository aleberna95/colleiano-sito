import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { vocePerTask } from "../../lib/schemas";
import { storico } from "./util";

/** Storico dei task: una voce per ogni modifica (SPEC 3, 6.3). */
export const storicoTask = onDocumentWritten("feste/{festaId}/tasks/{taskId}", async (event) => {
  const prima = event.data?.before.data();
  const dopo = event.data?.after.data();
  if (!dopo) return;
  const voce = vocePerTask(prima, dopo);
  if (!voce) return;
  await storico(event.params.festaId, {
    entita: "task",
    entitaId: event.params.taskId,
    attoreUid: String(dopo.updatedBy ?? dopo.createdBy ?? "sistema"),
    ...voce,
  });
});
