import { getStore } from "@netlify/blobs";

const JOGADORES = ["Marcus", "Fel", "Eric", "Peter Flag", "Renan"];

const slug = (s) =>
  (s || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "") || "sem-gp";

const json = (dados, status = 200) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });

export default async (req) => {
  const store = getStore("bolao");
  const url = new URL(req.url);

  // ---------- gravar um palpite ----------
  if (req.method === "POST") {
    let corpo;
    try {
      corpo = await req.json();
    } catch {
      return json({ erro: "corpo inválido" }, 400);
    }

    const { jogador, gp, codigo } = corpo || {};

    if (!JOGADORES.includes(jogador)) return json({ erro: "jogador desconhecido" }, 400);
    if (typeof codigo !== "string" || !codigo.startsWith("BUXAS1:") || codigo.length > 4000)
      return json({ erro: "código inválido" }, 400);
    if (!gp || typeof gp !== "string") return json({ erro: "GP não informado" }, 400);

    const chave = slug(gp);
    const atual = (await store.get(chave, { type: "json" })) || { nome: gp.trim(), palpites: {} };
    atual.nome = gp.trim();
    atual.palpites[jogador] = { codigo, hora: new Date().toISOString() };
    await store.setJSON(chave, atual);

    return json({ ok: true, entregues: Object.keys(atual.palpites).length });
  }

  // ---------- ler a situação ----------
  const chave = slug(url.searchParams.get("gp"));
  const atual = (await store.get(chave, { type: "json" })) || { nome: "", palpites: {} };

  const entregues = Object.keys(atual.palpites);
  const faltando = JOGADORES.filter((n) => !atual.palpites[n]);
  const aberto = faltando.length === 0;

  // O LACRE É APLICADO AQUI, NO SERVIDOR.
  // Enquanto faltar alguém, os códigos não saem daqui — nem para quem
  // abrir o painel, nem para quem inspecionar a rede do navegador.
  return json({
    gp: atual.nome,
    entregues: entregues.map((n) => ({ jogador: n, hora: atual.palpites[n].hora })),
    faltando,
    aberto,
    palpites: aberto
      ? Object.fromEntries(entregues.map((n) => [n, atual.palpites[n].codigo]))
      : null
  });
};
