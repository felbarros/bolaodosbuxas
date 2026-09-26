import { getStore } from "@netlify/blobs";

// ============================================================
//  SENHA DO ORGANIZADOR
//  Troque o texto entre aspas por uma senha sua. Só quem souber
//  consegue abrir uma rodada nova ou zerar a atual.
// ============================================================
const SENHA = "buxas2026";

const JOGADORES = ["Marcus", "Fel", "Eric", "Peter Flag", "Renan"];
const CONFIG = "__config";

const slug = (s) =>
  (s || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "") || "sem-gp";

const json = (dados, status = 200) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });

export default async (req) => {
  const store = getStore("bolao");
  const config = (await store.get(CONFIG, { type: "json" })) || { rodada: "" };

  if (req.method === "POST") {
    let corpo;
    try {
      corpo = await req.json();
    } catch {
      return json({ erro: "corpo inválido" }, 400);
    }

    // ---------- ações do organizador ----------
    if (corpo.acao === "nova-rodada") {
      if (corpo.senha !== SENHA) return json({ erro: "senha incorreta" }, 403);
      const nome = (corpo.rodada || "").trim();
      if (!nome) return json({ erro: "dê um nome à rodada" }, 400);
      config.rodada = nome;
      await store.setJSON(CONFIG, config);
      // Os palpites de rodadas anteriores continuam guardados sob o nome delas.
      return json({ ok: true, rodada: nome });
    }

    if (corpo.acao === "zerar") {
      if (corpo.senha !== SENHA) return json({ erro: "senha incorreta" }, 403);
      if (!config.rodada) return json({ erro: "nenhuma rodada aberta" }, 400);
      await store.delete(slug(config.rodada));
      return json({ ok: true, rodada: config.rodada });
    }

    // ---------- envio de palpite ----------
    if (!config.rodada) return json({ erro: "o organizador ainda não abriu a rodada" }, 400);

    const { jogador, codigo } = corpo;
    if (!JOGADORES.includes(jogador)) return json({ erro: "jogador desconhecido" }, 400);
    if (typeof codigo !== "string" || !codigo.startsWith("BUXAS1:") || codigo.length > 4000)
      return json({ erro: "código inválido" }, 400);

    const chave = slug(config.rodada);
    const atual = (await store.get(chave, { type: "json" })) || { nome: config.rodada, palpites: {} };
    atual.palpites[jogador] = { codigo, hora: new Date().toISOString() };
    await store.setJSON(chave, atual);

    return json({ ok: true, entregues: Object.keys(atual.palpites).length });
  }

  // ---------- leitura da situação ----------
  if (!config.rodada) {
    return json({ rodada: "", entregues: [], faltando: JOGADORES, aberto: false, palpites: null });
  }

  const atual = (await store.get(slug(config.rodada), { type: "json" })) || { nome: config.rodada, palpites: {} };
  const entregues = Object.keys(atual.palpites);
  const faltando = JOGADORES.filter((n) => !atual.palpites[n]);
  const aberto = faltando.length === 0;

  // O lacre é aplicado aqui, no servidor: enquanto faltar alguém,
  // os códigos não saem desta função.
  return json({
    rodada: config.rodada,
    entregues: entregues.map((n) => ({ jogador: n, hora: atual.palpites[n].hora })),
    faltando,
    aberto,
    palpites: aberto
      ? Object.fromEntries(entregues.map((n) => [n, atual.palpites[n].codigo]))
      : null
  });
};
