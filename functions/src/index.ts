import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";

// Le callable arrivano da M1 in poi. Gli schemi Zod si importano da ../../lib/schemas
// e vengono inclusi nel bundle da esbuild.
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });
initializeApp();
