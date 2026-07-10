import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const candidates = {
  cid: [
    // public mirrors (may fail); override with REF_CID_URL env var
    "https://raw.githubusercontent.com/ewelina-kurek/icd10json/master/ICD10.json",
    "https://raw.githubusercontent.com/joelbirch/icd10/master/icd10.json",
  ],
  tuss: [
    // TUSS public mirrors / examples
    "https://raw.githubusercontent.com/marcelo-rodrigues/tuss-table/master/tuss.json",
  ],
  sigtap: [
    // SIGTAP mirrors / examples
    "https://raw.githubusercontent.com/michaelkorn/sigtap-json/master/sigtap.json",
  ],
};

async function tryFetch(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    if (Array.isArray(json)) return json;
    // some sources wrap data in an object
    if (Array.isArray(json.data)) return json.data;
    return null;
  } catch (e) {
    return null;
  }
}

async function fetchOne(name) {
  const envUrl = process.env[`REF_${name.toUpperCase()}_URL`];
  if (envUrl) {
    console.log(`Tentando ${name} via env ${envUrl}`);
    const j = await tryFetch(envUrl);
    if (j) return j;
    console.warn(`Falha ao obter ${name} de ${envUrl}`);
  }

  for (const u of candidates[name] || []) {
    console.log(`Tentando ${name} via ${u}`);
    const j = await tryFetch(u);
    if (j) return j;
  }
  return null;
}

async function main() {
  for (const name of Object.keys(candidates)) {
    const data = await fetchOne(name);
    const outFile = path.join(dataDir, `${name}.json`);
    if (data) {
      fs.writeFileSync(outFile, JSON.stringify(data, null, 2), "utf8");
      console.log(`Gravado ${outFile} (${data.length} itens)`);
    } else {
      // cria arquivo vazio como fallback
      if (!fs.existsSync(outFile)) fs.writeFileSync(outFile, "[]", "utf8");
      console.warn(`Não foi possível obter ${name}; criado ${outFile} vazio`);
    }
  }
}

main().catch((e) => {
  console.error("Erro no fetch-refs:", e);
  process.exit(1);
});
