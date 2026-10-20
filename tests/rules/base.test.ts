import { afterAll, beforeAll, describe, it } from "vitest";
import { assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { creaAmbiente } from "./setup";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await creaAmbiente();
});

afterAll(async () => {
  await env.cleanup();
});

describe("regole di base", () => {
  it("chi non ha fatto l'accesso non legge nulla", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "feste/festa-1")));
    await assertFails(getDoc(doc(db, "users/u1")));
  });

  it("chi non ha fatto l'accesso non scrive nulla", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "feste/festa-1"), { nome: "x" }));
  });
});
