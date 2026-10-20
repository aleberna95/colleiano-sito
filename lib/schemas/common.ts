import { z } from "zod";

// Timestamp di Firestore: client e Admin SDK hanno classi diverse, basta che abbia toDate().
export type TimestampLike = { toDate(): Date; toMillis(): number };
export const timestampSchema = z.custom<TimestampLike>(
  (v) =>
    typeof v === "object" &&
    v !== null &&
    typeof (v as TimestampLike).toDate === "function",
  { message: "Data non valida" },
);

export const uidSchema = z.string().min(1);

/** Importo in centesimi interi (SPEC 5). */
export const centsSchema = z.number().int().nonnegative();

/** Campi presenti su ogni documento. */
export const auditSchema = z.object({
  createdAt: timestampSchema,
  createdBy: uidSchema,
  updatedAt: timestampSchema,
  updatedBy: uidSchema,
});
