import { readFileSync, writeFileSync } from "fs";

const priv = readFileSync("private.pem", "utf8").replace(/\n/g, "\\n");
const pub = readFileSync("public.pem", "utf8").replace(/\n/g, "\\n");

writeFileSync(".env.keys", `PRIVATE_KEY="${priv}"\nPUBLIC_KEY="${pub}"\n`);
console.log("Done! Check .env.keys file");