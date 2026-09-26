import { getStore } from "@netlify/blobs";

// ============================================================
//  SENHA DO ORGANIZADOR — troque o texto entre aspas.
// ============================================================
const SENHA = "buxas2026";

// ============================================================
//  PONTUAÇÃO DE PARTIDA DO CAMPEONATO
//  Todos começam do zero, exceto Peter Flag, que entrou no GP do
//  Canadá com 147 pontos de base.
// ============================================================
const BASE = { "Marcus": 0, "Eric": 0, "Fel": 0, "Renan": 0, "Peter Flag": 147 };

// ============================================================
//  RODADAS APURADAS ANTES DO SITE EXISTIR (em ordem)
//  Jogador ausente de uma rodada = não participou (mostra "—").
//  As rodadas finalizadas no site entram depois destas.
// ============================================================
const ANTERIORES = [
  { nome: "GP da Austrália",   pontos: { "Marcus": 50, "Eric": 40, "Fel": 35, "Renan": 68 } },
  { nome: "GP da China",       pontos: { "Marcus": 25, "Eric": 47, "Fel": 27, "Renan": 40 } },
  { nome: "GP do Japão",       pontos: { "Marcus": 30, "Eric": 45, "Fel": 35, "Renan": 60 } },
  { nome: "GP de Miami",       pontos: { "Marcus": 53, "Eric": 30, "Fel": 50, "Renan": 30 } },
  { nome: "GP do Canadá",      pontos: { "Marcus": 25, "Eric": 40, "Fel": 30, "Renan": 20, "Peter Flag": 40 } },
  { nome: "GP de Mônaco",      pontos: { "Marcus": 40, "Eric": 30, "Fel": 52, "Renan": 30, "Peter Flag": 30 } },
  { nome: "GP de Barcelona",   pontos: { "Marcus": 55, "Eric": 40, "Fel": 43, "Renan": 20, "Peter Flag": 55 } },
  { nome: "GP da Áustria",     pontos: { "Marcus": 65, "Eric": 55, "Fel": 50, "Renan": 30, "Peter Flag": 35 } },
  { nome: "GP da Inglaterra",  pontos: { "Marcus": 35, "Eric": 25, "Fel": 48, "Renan": 30, "Peter Flag": 25 } },
  { nome: "GP da Bélgica",     pontos: { "Marcus": 50, "Eric": 62, "Fel": 47, "Renan": 50, "Peter Flag": 72 } },
  { nome: "GP da Hungria",     pontos: { "Marcus": 55, "Eric": 45, "Fel": 35, "Renan": 70, "Peter Flag": 40 } },
  { nome: "GP da Holanda",     pontos: { "Marcus": 68, "Eric": 63, "Fel": 52, "Renan": 50, "Peter Flag": 45 } },
  { nome: "GP da Itália",      pontos: { "Marcus": 10, "Eric": 15, "Fel": 20, "Renan": 30, "Peter Flag": 25 } },
  { nome: "GP de Madrid",      pontos: { "Marcus": 45, "Eric": 40, "Fel": 60, "Renan": 50, "Peter Flag": 83 } }
];

// ============================================================
//  CALENDÁRIO — corridas que ainda vão acontecer
//  A rodada abre sozinha até ABRIR_DIAS_ANTES dias antes da
//  largada, assim que a anterior estiver finalizada. O prazo de
//  envio é a hora da largada (em UTC; o site converte).
//  Se uma corrida for remarcada, é só corrigir a linha dela.
// ============================================================
const ABRIR_DIAS_ANTES = 10;
const CALENDARIO = [
  { nome: "GP da Malásia",          largada: "2026-10-04T07:00:00Z" },  // Sepang, 15h local
  { nome: "GP de Singapura",        largada: "2026-10-11T12:00:00Z" },  // 20h local
  { nome: "GP dos Estados Unidos",  largada: "2026-10-25T20:00:00Z" },  // Austin, 15h local
  { nome: "GP do México",           largada: "2026-11-01T20:00:00Z" },  // 14h local
  { nome: "GP de São Paulo",        largada: "2026-11-08T17:00:00Z" },  // 14h Brasília
  { nome: "GP de Las Vegas",        largada: "2026-11-22T04:00:00Z" },  // sábado 21, 20h local
  { nome: "GP do Catar",            largada: "2026-11-29T16:00:00Z" },  // 19h local
  { nome: "GP de Abu Dhabi",        largada: "2026-12-06T13:00:00Z" }   // 17h local
];

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

// Nome como o site exibe, a partir da chave normalizada
const ROTULO = Object.fromEntries(["Norris","Piastri","Antonelli","Russell","Leclerc","Hamilton","Verstappen","Hadjar",
  "Lawson","Lindblad","Alonso","Stroll","Gasly","Colapinto","Albon","Sainz","Ocon","Bearman","Hülkenberg","Bortoleto",
  "Pérez","Bottas"].map((n) => [n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""), n]));

// Busca a classificação mais recente na Jolpica F1 (sucessora da Ergast)
async function buscarResultado(config) {
  if (!config.rodada) return { erro: "nenhuma rodada aberta" };
  const r = await fetch("https://api.jolpi.ca/ergast/f1/2026/last/results.json", {
    headers: { "user-agent": "bolao-dos-buxas/1.0" }
  });
  if (!r.ok) return { erro: "a fonte respondeu " + r.status };
  const d = await r.json();
  const corrida = d?.MRData?.RaceTable?.Races?.[0];
  if (!corrida || !Array.isArray(corrida.Results) || !corrida.Results.length)
    return { erro: "a fonte ainda não publicou nenhum resultado desta temporada" };

  // A corrida mais recente na fonte tem que ser a desta rodada (±2 dias da largada)
  const dataFonte = Date.parse(corrida.date + "T" + (corrida.time || "12:00:00Z"));
  const largada = config.prazo ? Date.parse(config.prazo) : NaN;
  if (!isNaN(largada) && Math.abs(dataFonte - largada) > 2 * 86400e3)
    return { erro: "a fonte ainda não tem o resultado de " + config.rodada +
                   " (última corrida publicada: " + corrida.raceName + ", " + corrida.date + ")" };

  const top10 = corrida.Results
    .filter((x) => /^\d+$/.test(String(x.position)))
    .sort((a, b) => +a.position - +b.position)
    .slice(0, 10)
    .map((x) => {
      const sobrenome = x.Driver?.familyName || "";
      return ROTULO[norm(sobrenome)] || sobrenome;
    });
  if (top10.length !== 10) return { erro: "a fonte devolveu só " + top10.length + " classificados" };
  return { ok: true, resultado: top10, corrida: corrida.raceName, data: corrida.date,
           aviso: "Confira antes de finalizar: punições aplicadas depois da corrida podem ainda não estar refletidas." };
}

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

function historicoOrdenado(config) {
  const ordem = config.ordem || Object.keys(config.historico || {});
  const doSite = ordem.map((s) => (config.historico || {})[s]).filter(Boolean);
  return [...ANTERIORES, ...doSite];
}

function ranking(config, excluirUltima = false) {
  const totais = { ...BASE };
  const hist = historicoOrdenado(config);
  const usar = excluirUltima ? hist.slice(0, -1) : hist;
  for (const r of usar) {
    for (const [nome, pts] of Object.entries(r.pontos || {})) totais[nome] = (totais[nome] || 0) + pts;
  }
  return Object.entries(totais).sort((a, b) => b[1] - a[1]).map(([jogador, total]) => ({ jogador, total }));
}

function proximaCorrida(config) {
  const agora = Date.now();
  const usados = new Set([...(config.ordem || []), ...(config.rodada ? [slug(config.rodada)] : [])]);
  return CALENDARIO.find((c) => Date.parse(c.largada) > agora && !usados.has(slug(c.nome))) || null;
}

// Abre a próxima rodada do calendário se a atual estiver finalizada
// (ou não houver) e a largada estiver a menos de ABRIR_DIAS_ANTES dias.
async function abrirSePrecisar(config, store) {
  if (config.rodada) {
    const atual = await store.get(slug(config.rodada), { type: "json" });
    if (!atual || !atual.finalizada) return false;
  }
  const prox = proximaCorrida(config);
  if (!prox) return false;
  if (Date.parse(prox.largada) - Date.now() > ABRIR_DIAS_ANTES * 86400e3) return false;
  config.rodada = prox.nome;
  config.prazo = prox.largada;
  await store.setJSON(CONFIG, config);
  return true;
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

    // ---------- apuração: buscar resultado na fonte ----------
    if (corpo.acao === "buscar-resultado") {
      try {
        const res = await buscarResultado(config);
        return json(res, res.ok ? 200 : 400);
      } catch (e) {
        return json({ erro: "não consegui falar com a fonte (" + (e.message || e) + ")" }, 502);
      }
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
  const abriuAgora = await abrirSePrecisar(config, store);
  const prox = proximaCorrida(config);
  const base = { rodada: config.rodada, prazo: config.prazo || null, base: BASE,
                 ranking: ranking(config), rankingAnterior: ranking(config, true),
                 historico: historicoOrdenado(config), abriuAgora,
                 proxima: prox ? { nome: prox.nome, largada: prox.largada } : null };
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
