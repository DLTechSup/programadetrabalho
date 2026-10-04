// Teste de internet: velocidade de resolução de nomes (DNS) e latência. Funciona em qualquer sistema.
const dns = require("node:dns");
const net = require("node:net");

const SITES = ["google.com", "youtube.com", "microsoft.com", "whatsapp.com"];

function tempo(fn, limite) {
  const t0 = process.hrtime.bigint();
  return Promise.race([
    fn().then(() => Number(process.hrtime.bigint() - t0) / 1e6),
    new Promise((r) => setTimeout(() => r(null), limite)),
  ]).catch(() => null);
}

async function medirResolvedor(nome, servidores) {
  const res = new dns.promises.Resolver({ timeout: 2500, tries: 1 });
  if (servidores) res.setServers(servidores);
  const tempos = [];
  for (const s of SITES) {
    const t = await tempo(() => (servidores ? res.resolve4(s) : dns.promises.lookup(s, { family: 4 })), 3000);
    if (t != null) tempos.push(t);
  }
  const media = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null;
  return { nome, ms: media == null ? null : Math.round(media), falhas: SITES.length - tempos.length };
}

function latenciaTcp(host, porta) {
  return tempo(
    () =>
      new Promise((resolve, reject) => {
        const s = net.connect({ host, port: porta }, () => {
          s.destroy();
          resolve();
        });
        s.on("error", reject);
      }),
    3000,
  ).then((v) => (v == null ? null : Math.round(v)));
}

async function testarInternet() {
  const [atual, cloudflare, google, lat] = await Promise.all([
    medirResolvedor("DNS atual do Windows", null),
    medirResolvedor("Cloudflare (1.1.1.1)", ["1.1.1.1"]),
    medirResolvedor("Google (8.8.8.8)", ["8.8.8.8"]),
    latenciaTcp("1.1.1.1", 443),
  ]);
  return { resolvedores: [atual, cloudflare, google], latenciaMs: lat, conectado: lat != null || atual.ms != null };
}

module.exports = { testarInternet };
