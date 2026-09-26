import { getStore } from "@netlify/blobs";

// ============================================================
//  SENHA DO ORGANIZADOR — troque o texto entre aspas.
// ============================================================
const SENHA = "buxas2026";

// ============================================================
//  PONTUAÇÃO DE PARTIDA DO CAMPEONATO
//  Totais logo após o GP da Espanha 2026. As rodadas finalizadas
//  no site somam em cima destes números.
// ============================================================
const BASE = { "Marcus": 606, "Peter Flag": 597, "Fel": 584, "Renan": 578, "Eric": 577 };

const JOGADORES = ["Marcus", "Fel", "Eric", "Peter Flag", "Renan"];
const CONFIG = "__config";
const VALOR_TOP5 = [25, 18, 15, 12, 10];

// Apelidos e primeiros nomes → sobrenome de referência
const ALIAS = {
  kimi: "antonelli", max: "verstappen", russel: "russell", hulk: "hulkenberg",
  bortoletto: "bortoleto", hadjan: "hadjar", checo: "perez",
  lewis: "hamilton", lando: "norris", charles: "leclerc", oscar: "piastri",
  george: "russell", nico: "hulkenberg", franco: "colapinto", gabriel: "bortoleto",
  ollie: "bearman", oliver: "bearman", liam: "lawson", arvid: "lindblad",
  pierre: "gasly", isack: "hadjar", carlos: "sainz", alex: "albon",
  fernando: "alonso", lance: "stroll", esteban: "ocon", valtteri: "bottas", sergio: "perez"
};

const norm = (n) => {
  let s = (n || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const partes = s.split(/\s+/).filter(Boolean);
  if (!partes.length) return "";
  s = partes[partes.length - 1];
  return ALIAS[s] || s;
};

const slug = (s) =>
  (s || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "") || "sem-gp";

const json = (dados, status = 200) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });

const decodificar = (codigo) => {
  try {
    const o = JSON.parse(Buffer.from(codigo.replace(/^BUXAS1:/, ""), "base64").toString("utf8"));
    return Array.isArray(o.p) && o.p.length === 10 ? o.p : null;
  } catch {
    return null;
  }
};

// ---------- as regras do bolão, em um lugar só ----------
function pontuar(palpites, oficial) {
  const o = oficial.map(norm);
  const top5 = new Set(o.slice(0, 5));
  const zona = new Set(o.slice(5));
  const res = {};

  for (const [nome, lista] of Object.entries(palpites)) {
    const p = lista.map(norm);
    const linhas = [];
    let pontosTop5 = 0, exato = 0;

    for (let i = 0; i < 5; i++) {
      let pts = 0, motivo;
      if (p[i] === o[i]) { pts = VALOR_TOP5[i]; motivo = "exato"; }
      else if (top5.has(p[i])) { pts = 5; motivo = "top 5, fora do lugar (chegou P" + (o.indexOf(p[i]) + 1) + ")"; }
      else if (o.includes(p[i])) { motivo = "fora do top 5 (chegou P" + (o.indexOf(p[i]) + 1) + ")"; }
      else { motivo = "fora do top 10"; }
      pontosTop5 += pts;
      linhas.push({ pos: i + 1, piloto: lista[i], motivo, pts });
    }
    for (let i = 5; i < 10; i++) {
      let pts = 0, motivo;
      if (p[i] === o[i]) { pts = 5; motivo = "exato"; }
      else if (o.includes(p[i])) { motivo = "chegou P" + (o.indexOf(p[i]) + 1); }
      else { motivo = "fora do top 10"; }
      exato += pts;
      linhas.push({ pos: i + 1, piloto: lista[i], motivo, pts });
    }
    const hits = p.slice(5).filter((x) => zona.has(x));
    res[nome] = { top5: pontosTop5, exato, hits: hits.length, nomesHits: hits, linhas };
  }

  const maxHits = Math.max(0, ...Object.values(res).map((r) => r.hits));
  for (const r of Object.values(res)) {
    r.bonus = r.hits === maxHits && maxHits > 0 ? 10 : (r.hits === maxHits ? 10 : 0);
    r.rodada = r.top5 + r.exato + r.bonus;
  }
  return res;
}

function ranking(config, excluirUltima = false) {
  const totais = { ...BASE };
  const ordem = config.ordem || Object.keys(config.historico || {});
  const usar = excluirUltima ? ordem.slice(0, -1) : ordem;
  for (const s of usar) {
    const r = (config.historico || {})[s];
    if (!r) continue;
    for (const [nome, pts] of Object.entries(r.pontos || {})) totais[nome] = (totais[nome] || 0) + pts;
  }
  return Object.entries(totais).sort((a, b) => b[1] - a[1]).map(([jogador, total]) => ({ jogador, total }));
}

function historicoOrdenado(config) {
  const ordem = config.ordem || Object.keys(config.historico || {});
  return ordem.map((s) => (config.historico || {})[s]).filter(Boolean);
}

export default async (req) => {
  const store = getStore("bolao");
  const config = (await store.get(CONFIG, { type: "json" })) || { rodada: "", historico: {} };
  config.historico = config.historico || {};

  if (req.method === "POST") {
    let corpo;
    try { corpo = await req.json(); } catch { return json({ erro: "corpo inválido" }, 400); }

    // ---------- organizador: nova rodada ----------
    if (corpo.acao === "nova-rodada") {
      if (corpo.senha !== SENHA) return json({ erro: "senha incorreta" }, 403);
      const nome = (corpo.rodada || "").trim();
      if (!nome) return json({ erro: "dê um nome à rodada" }, 400);
      config.rodada = nome;
      config.prazo = corpo.prazo && !isNaN(Date.parse(corpo.prazo)) ? new Date(corpo.prazo).toISOString() : null;
      await store.setJSON(CONFIG, config);
      return json({ ok: true, rodada: nome, prazo: config.prazo });
    }

    // ---------- organizador: zerar palpites da rodada ----------
    if (corpo.acao === "zerar") {
      if (corpo.senha !== SENHA) return json({ erro: "senha incorreta" }, 403);
      if (!config.rodada) return json({ erro: "nenhuma rodada aberta" }, 400);
      await store.delete(slug(config.rodada));
      delete config.historico[slug(config.rodada)];
      config.ordem = (config.ordem || []).filter((s) => s !== slug(config.rodada));
      await store.setJSON(CONFIG, config);
      return json({ ok: true, rodada: config.rodada });
    }

    // ---------- apuração: prévia ou finalização ----------
    if (corpo.acao === "calcular" || corpo.acao === "finalizar") {
      if (corpo.acao === "finalizar" && corpo.senha !== SENHA) return json({ erro: "senha incorreta" }, 403);
      if (!config.rodada) return json({ erro: "nenhuma rodada aberta" }, 400);
      const oficial = Array.isArray(corpo.resultado) ? corpo.resultado.map((x) => (x || "").trim()) : [];
      if (oficial.length !== 10 || oficial.some((x) => !x)) return json({ erro: "informe os 10 pilotos do resultado" }, 400);
      if (new Set(oficial.map(norm)).size !== 10) return json({ erro: "há piloto repetido no resultado" }, 400);

      const chave = slug(config.rodada);
      const atual = (await store.get(chave, { type: "json" })) || { nome: config.rodada, palpites: {} };
      const faltando = JOGADORES.filter((n) => !atual.palpites[n]);
      if (faltando.length) return json({ erro: "ainda faltam palpites de: " + faltando.join(", ") }, 400);

      const palpites = {};
      for (const n of JOGADORES) {
        const p = decodificar(atual.palpites[n].codigo);
        if (!p) return json({ erro: "palpite corrompido de " + n }, 400);
        palpites[n] = p;
      }
      const apuracao = pontuar(palpites, oficial);

      if (corpo.acao === "finalizar") {
        atual.resultado = oficial;
        atual.apuracao = apuracao;
        atual.finalizada = true;
        await store.setJSON(chave, atual);
        config.historico[chave] = {
          nome: config.rodada,
          pontos: Object.fromEntries(Object.entries(apuracao).map(([n, r]) => [n, r.rodada]))
        };
        config.ordem = (config.ordem || []).filter((s) => s !== chave).concat([chave]);
        await store.setJSON(CONFIG, config);
      }
      return json({ ok: true, rodada: config.rodada, resultado: oficial, apuracao,
                    finalizada: corpo.acao === "finalizar", ranking: ranking(config),
                    rankingAnterior: ranking(config, true), historico: historicoOrdenado(config) });
    }

    // ---------- envio de palpite ----------
    if (!config.rodada) return json({ erro: "o organizador ainda não abriu a rodada" }, 400);
    if (config.prazo && Date.now() > Date.parse(config.prazo)) return json({ erro: "o prazo desta rodada já encerrou" }, 400);
    const { jogador, codigo } = corpo;
    if (!JOGADORES.includes(jogador)) return json({ erro: "jogador desconhecido" }, 400);
    if (typeof codigo !== "string" || !codigo.startsWith("BUXAS1:") || codigo.length > 4000)
      return json({ erro: "código inválido" }, 400);
    if (!decodificar(codigo)) return json({ erro: "código inválido" }, 400);

    const chave = slug(config.rodada);
    const atual = (await store.get(chave, { type: "json" })) || { nome: config.rodada, palpites: {} };
    if (atual.finalizada) return json({ erro: "esta rodada já foi finalizada" }, 400);
    atual.palpites[jogador] = { codigo, hora: new Date().toISOString() };
    await store.setJSON(chave, atual);
    return json({ ok: true, entregues: Object.keys(atual.palpites).length });
  }

  // ---------- leitura ----------
  const base = { rodada: config.rodada, prazo: config.prazo || null, base: BASE,
                 ranking: ranking(config), rankingAnterior: ranking(config, true),
                 historico: historicoOrdenado(config) };
  if (!config.rodada) {
    return json({ ...base, entregues: [], faltando: JOGADORES, aberto: false, palpites: null, finalizada: false });
  }
  const atual = (await store.get(slug(config.rodada), { type: "json" })) || { nome: config.rodada, palpites: {} };
  const entregues = Object.keys(atual.palpites);
  const faltando = JOGADORES.filter((n) => !atual.palpites[n]);
  const aberto = faltando.length === 0;

  return json({
    ...base,
    entregues: entregues.map((n) => ({ jogador: n, hora: atual.palpites[n].hora })),
    faltando,
    aberto,
    palpites: aberto ? Object.fromEntries(entregues.map((n) => [n, atual.palpites[n].codigo])) : null,
    finalizada: !!atual.finalizada,
    resultado: atual.resultado || null,
    apuracao: atual.apuracao || null
  });
};
