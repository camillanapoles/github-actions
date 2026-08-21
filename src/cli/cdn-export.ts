import { getKernel } from "@/domain/kernel";
import { publishObjects, publicDir } from "@/domain/public-cdn";

const k = getKernel();
const out = publishObjects(k.ls("/"), k.listRules());
console.log("[cdn-public]", publicDir(), "n=", out.length);
for (const e of out.slice(0, 12)) console.log(" ", e.path, "→", e.immutable);
