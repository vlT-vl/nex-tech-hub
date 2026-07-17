#!/usr/bin/env node
/**
 * fetch-static-data.mjs — genera public/data/ per nex-tech-hub
 * CVE da NVD/CIRCL + news RSS + GitHub repo pubbliche per vendor.
 * Chiamato da predev e dal CI (deploy.yml).
 *
 *   node scripts/fetch-static-data.mjs          rispetta TTL 6h (predev)
 *   node scripts/fetch-static-data.mjs --force  rigenera tutto (data:fetch)
 */

import { writeFileSync, readFileSync, unlinkSync, mkdirSync, existsSync, statSync } from 'fs';
import { join, dirname }   from 'path';
import { fileURLToPath }   from 'url';
import { execFileSync } from 'child_process';
import { request as pwRequest } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const OUT_CVE   = join(ROOT, 'public', 'data', 'cve');
const OUT_NEWS  = join(ROOT, 'public', 'data', 'news');
const OUT_GITHUB = join(ROOT, 'public', 'data', 'github');
const FORCE     = process.argv.includes('--force');
const FORCE_GITHUB = process.argv.includes('--force-github') || process.env.GITHUB_FORCE === '1';

const CVE_TTL_MS = 6 * 60 * 60 * 1000;
const GITHUB_TTL_MS = Number(process.env.GITHUB_TTL_HOURS || 24) * 60 * 60 * 1000;
const ERR_TTL_MS = 1 * 60 * 60 * 1000;

const sleep      = (ms) => new Promise(r => setTimeout(r, ms));
const ensureDir  = (p)  => { if (!existsSync(p)) mkdirSync(p, { recursive: true }); };
const isFresh    = (f, ttl, force = FORCE) => !force && existsSync(f) && Date.now() - statSync(f).mtimeMs < ttl;
const errStamp   = (f) => f.replace(/\.\w+$/, '.error');
const clearErr   = (f) => { try { if (existsSync(errStamp(f))) unlinkSync(errStamp(f)); } catch {} };
const markErr    = (f) => writeFileSync(errStamp(f), String(Date.now()), 'utf8');
const readGithubCliToken = () => {
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
};

// ─── Playwright HTTP client ───────────────────────────────────────────────────
let _ctx;
const ctx = async () => {
  if (!_ctx) _ctx = await pwRequest.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  return _ctx;
};

const GET = async (url, accept, timeout = 20000) => {
  const c   = await ctx();
  const res = await c.get(url, { timeout, headers: { Accept: accept } });
  if (!res.ok()) throw new Error(`HTTP ${res.status()}`);
  return res;
};

const getJson = async (url, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try { return await GET(url, 'application/json', 90000).then(r => r.json()); }
    catch (e) {
      if (i === retries - 1) throw e;
      const wait = (i + 1) * 12000;
      console.warn(`    retry ${i + 1}/${retries - 1} in ${wait / 1000}s…`);
      await sleep(wait);
    }
  }
};
const getText = (url) => GET(url, 'application/rss+xml,application/xml,text/xml,*/*').then(r => r.text());

// ─── NVD CVE ─────────────────────────────────────────────────────────────────
const DELAY   = 7500;
const PER_PAGE = 100;
let   _nvdN   = 0;
const nvdGet  = async (url) => { if (_nvdN++ > 0) await sleep(DELAY); return getJson(url); };

const nvdUrl = (kw, idx = 0, from = null) => {
  const p = new URLSearchParams({ keywordSearch: kw, resultsPerPage: String(PER_PAGE), startIndex: String(idx) });
  if (from) p.set('pubStartDate', from);
  return `https://services.nvd.nist.gov/rest/json/cves/2.0?${p}`;
};

const nvdPages = async (kw, from) => {
  let idx = 0, total = 0, all = [], first = true;
  do {
    const d = await nvdGet(nvdUrl(kw, first ? 0 : idx, from));
    total = d.totalResults || 0; all = [...all, ...(d.vulnerabilities || [])];
    idx += d.resultsPerPage || PER_PAGE; first = false;
  } while (idx < total);
  return all;
};

// ─── CVE detection ───────────────────────────────────────────────────────────
const nt  = v  => (v||'').toLowerCase();
const exD = c  => (c.descriptions||[]).map(d=>d.value||'').join(' ');
const exR = c  => (c.references||[]).map(r=>`${r.url||''} ${(r.tags||[]).join(' ')}`).join(' ');
const exC = (ns=[]) => { const v=[]; const w=l=>l.forEach(n=>{ (n.cpeMatch||[]).forEach(m=>{ if(m.criteria)v.push(m.criteria); if(m.matchCriteriaId)v.push(m.matchCriteriaId); }); if(n.nodes?.length)w(n.nodes); }); w(ns); return v.join(' '); };
const blob = c => [nt(exD(c)), nt(exC(c.configurations?.nodes||[])), nt(exR(c))].join(' ');

const dPVE  = c => { const t=blob(c),o=[]; if(/proxmox/i.test(t)&&(/\bproxmox\s+ve\b/i.test(t)||/\bproxmox\s+virtual\s+environment\b/i.test(t)||/virtual_environment/i.test(t)))o.push('PVE'); if(/proxmox/i.test(t)&&(/\bproxmox\s+backup\s+server\b/i.test(t)||/backup_server/i.test(t)))o.push('PBS'); if(/proxmox/i.test(t)&&(/\bproxmox\s+datacenter\s+manager\b/i.test(t)||/datacenter_manager/i.test(t)))o.push('PDM'); return o; };
const dVMW  = c => { const t=blob(c),o=[]; if(/\besxi\b/i.test(t)||/vmware_esxi/i.test(t))o.push('ESXi'); if(/\bvcenter\b/i.test(t)||/vsphere_client/i.test(t))o.push('vCenter'); if(!o.length)o.push('VMware'); return o; };
const dK8S  = () => ['Kubernetes'];
const DETECT = { proxmox: dPVE, vmware: dVMW, kubernetes: dK8S };
const getSev = c => { const m=c.metrics?.cvssMetricV31?.[0]||c.metrics?.cvssMetricV30?.[0]||c.metrics?.cvssMetricV2?.[0]||null,d=m?.cvssData||null; return { severity: m?.baseSeverity||d?.baseSeverity||'N/A', score: d?.baseScore??'N/A' }; };

const yearAgo = () => { const d=new Date(); d.setFullYear(d.getFullYear()-1); return d.toISOString().slice(0,23); };

// ─── CIRCL CVE API ─────────────────────────────────────────────────────────--
// Primary for VMware + Kubernetes: no rate limit, no delay, 290+ and 122+ CVEs.
// CIRCL does NOT index Proxmox — NVD is used for Proxmox.
const CIRCL_QUERIES = {
  vmware:     [{ v:'vmware',     p:'esxi',             fp:'ESXi'       },
               { v:'vmware',     p:'vcenter_server',   fp:'vCenter'    }],
  kubernetes: [{ v:'kubernetes', p:'kubernetes',        fp:'Kubernetes' }],
  linux:      [{ v:'linux',         p:'linux_kernel',    fp:'Kernel'     },
               { v:'canonical',     p:'ubuntu_linux',    fp:'Ubuntu'     },
               { v:'debian',        p:'debian_linux',    fp:'Debian'     },
               { v:'redhat',        p:'enterprise_linux',fp:'RHEL'       },
               { v:'fedoraproject', p:'fedora',          fp:'Fedora'     }],
};

const circlPages = async (vendor, product) => {
  const all = []; let page = 1, totalPages = 1;
  do {
    const d = await getJson(`https://cve.circl.lu/api/search/${vendor}/${product}?page=${page}`);
    all.push(...(d?.results?.nvd || []));
    if (page === 1) totalPages = Math.ceil((d?.total_count||0) / (d?.page_size||10));
    page++;
  } while (page <= totalPages && all.length < 150);
  return all;
};

const normCircl = ([cveId, rec], fp) => {
  const meta = rec?.cveMetadata || {};
  const cna  = rec?.containers?.cna || {};
  const id   = meta.cveId || cveId;
  let score='N/A', severity='N/A';
  for (const m of (cna.metrics||[])) {
    const cv = m.cvssV3_1||m.cvssV30||m.cvssV2||null;
    if (cv) { score=cv.baseScore??'N/A'; severity=cv.baseSeverity??'N/A'; break; }
  }
  return { id, products:fp?[fp]:[], productLabel:fp||'', severity, score,
           published:meta.datePublished||'', link:`https://nvd.nist.gov/vuln/detail/${id}` };
};

const buildCveCircl = async (tech) => {
  const map = new Map();
  await Promise.all((CIRCL_QUERIES[tech]||[]).map(async ({ v, p, fp }) => {
    try {
      const items = await circlPages(v, p);
      console.log(`    ✓ CIRCL ${v}/${p} → ${items.length}`);
      items.forEach(pair => {
        const c=normCircl(pair,fp); if(!c.id) return;
        if (!map.has(c.id)) map.set(c.id,c);
        else { const e=map.get(c.id),m=[...new Set([...e.products,...c.products])]; e.products=m; e.productLabel=m.join(', '); }
      });
    } catch(e) { console.warn(`    ✗ CIRCL ${v}/${p}: ${e.message.split('\n')[0]}`); }
  }));
  if (!map.size) throw new Error('CIRCL no data');
  return [...map.values()].sort((a,b)=>new Date(b.published)-new Date(a.published));
};

// ─── NVD — Proxmox only ───────────────────────────────────────────────────────
const NVD_PROXMOX = [
  {kw:'Proxmox VE',fp:'PVE'},{kw:'Proxmox Virtual Environment',fp:'PVE'},
  {kw:'Proxmox Backup Server',fp:'PBS'},{kw:'Proxmox Datacenter Manager',fp:'PDM'},
  {kw:'Proxmox',fp:null},
];

const buildCveNvd = async () => {
  const map = new Map(); let ok = false;
  for (const { kw, fp } of NVD_PROXMOX) {
    try {
      const raw = await nvdPages(kw, null); ok = true;
      console.log(`    ✓ NVD "${kw}" → ${raw.length}`);
      raw.forEach(({ cve }) => {
        if (!cve?.id) return;
        let prods = dPVE(cve);
        if (fp && !prods.includes(fp)) prods=[...prods,fp];
        prods=[...new Set(prods)]; if(!prods.length) return;
        const {severity,score}=getSev(cve);
        if (!map.has(cve.id)) map.set(cve.id,{id:cve.id,products:prods,productLabel:prods.join(', '),severity,score,published:cve.published,link:`https://nvd.nist.gov/vuln/detail/${cve.id}`});
        else { const e=map.get(cve.id),m=[...new Set([...e.products,...prods])]; e.products=m; e.productLabel=m.join(', '); if(e.severity==='N/A'&&severity!=='N/A')e.severity=severity; if(e.score==='N/A'&&score!=='N/A')e.score=score; }
      });
    } catch(e) { console.warn(`    ✗ NVD "${kw}": ${e.message.split('\n')[0]}`); }
  }
  if (!ok) throw new Error('NVD unavailable');
  return [...map.values()].sort((a,b)=>new Date(b.published)-new Date(a.published));
};

const buildCve = async (tech) => {
  if (tech === 'proxmox') return buildCveNvd();
  try { return await buildCveCircl(tech); }
  catch(e) { console.warn(`  CIRCL fallito, provo NVD…`); throw e; }
};

// ─── RSS news feeds ───────────────────────────────────────────────────────────
const NEWS_FEEDS = {
  proxmox:    [
    'https://www.proxmox.com/en/news?format=feed&type=rss',
    'https://www.proxmox.com/index.php?format=feed&type=rss',
    'https://forum.proxmox.com/whats-new/posts.rss',
    'https://forum.proxmox.com/forums/-/index.rss',
  ],
  vmware:     [
    'https://blogs.vmware.com/feed/',
    'https://blogs.vmware.com/vsphere/feed/',
    'https://community.broadcom.com/vmware-cloud-foundation/rss-all',
    'https://blogs.broadcom.com/feed/',
  ],
  kubernetes: ['https://kubernetes.io/feed.xml'],
};

// Linux: più sorgenti fuse in un unico file linux.xml
const LINUX_NEWS_SOURCES = [
  'https://www.phoronix.com/rss.php',
  'https://ubuntu.com/blog/feed',
  'https://lwn.net/headlines/rss',
  'https://linuxfoundation.org/blog/feed/',
];

const fetchFeed = async (tech) => {
  for (const url of NEWS_FEEDS[tech]) {
    try {
      const xml = await getText(url);
      if (xml.includes('<item>') || xml.includes('<entry>')) { console.log(`    ✓ ${tech}: ${url}`); return xml; }
    } catch(e) { console.warn(`    ✗ ${url}: ${e.message.split('\n')[0]}`); }
  }
  throw new Error('all feeds failed');
};

const NON_LATIN_RE = /[぀-鿿가-힯؀-ۿऀ-ॿ฀-๿]/;

const fetchLinuxNews = async () => {
  const items = [];
  for (const url of LINUX_NEWS_SOURCES) {
    try {
      const xml = await getText(url);
      const matches = (xml.match(/<item>[\s\S]*?<\/item>/g) || [])
        .filter(i => !NON_LATIN_RE.test(i));
      console.log(`    ✓ linux: ${url} → ${matches.length} items`);
      items.push(...matches);
    } catch(e) { console.warn(`    ✗ ${url}: ${e.message.split('\n')[0]}`); }
  }
  if (!items.length) throw new Error('no linux news');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Linux News</title>${items.join('')}</channel></rss>`;
};

// ─── GitHub repository data ─────────────────────────────────────────────────
const GITHUB_USER = 'vlT-vl';
// nex-tech-hub è questa stessa app: non ha senso mostrarla nella sua vista "vlT",
// va sempre esclusa a prescindere da eventuali match sui keyword vendor.
const GITHUB_EXCLUDED_REPOS = ['nex-tech-hub'];
const GITHUB_VENDOR_KEYWORDS = [
  'vmware', 'vsphere', 'esxi', 'vcenter',
  'proxmox', 'pve', 'pbs', 'pdm',
  'kubernetes', 'k8s',
  'linux', 'ubuntu', 'debian', 'rhel', 'redhat', 'rocky', 'fedora',
];
const GITHUB_COMMON_EXCLUDES = [
  'macos', 'macosx', 'osx', 'hackintosh', 'opencore', 'apple', 'ios',
  'android', 'game', 'gaming', 'minecraft', 'wallpaper', 'theme-pack',
];
const GITHUB_CATEGORIES = [
  {
    id: 'vlt',
    label: 'vlT',
    source: 'user',
    url: `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated&type=owner`,
    keywords: GITHUB_VENDOR_KEYWORDS,
  },
  {
    id: 'proxmox',
    label: 'Proxmox',
    query: 'proxmox in:name,description,topics',
    requiredKeywords: ['proxmox', 'proxmox-ve', 'proxmoxve', 'pve', 'pbs', 'pdm'],
    excludeKeywords: [...GITHUB_COMMON_EXCLUDES, 'ventura', 'sonoma', 'sequoia', 'monterey'],
  },
  {
    id: 'vmware',
    label: 'VMware',
    query: 'vmware vsphere esxi vcenter in:name,description,topics',
    requiredKeywords: ['vmware', 'vsphere', 'esxi', 'vcenter', 'vcenter-server', 'powercli'],
    excludeKeywords: [...GITHUB_COMMON_EXCLUDES, 'virtualbox', 'hyper-v', 'kvm-only', 'qemu-only'],
  },
  {
    id: 'kubernetes',
    label: 'Kubernetes',
    query: 'kubernetes k8s in:name,description,topics',
    requiredKeywords: ['kubernetes', 'k8s', 'kubectl', 'helm', 'operator', 'container', 'cluster'],
    excludeKeywords: [...GITHUB_COMMON_EXCLUDES, 'docker-only'],
  },
  {
    id: 'ubuntu',
    label: 'Ubuntu',
    query: 'ubuntu linux in:name,description,topics',
    requiredKeywords: ['ubuntu', 'linux', 'apt', 'deb', 'debian'],
    excludeKeywords: [...GITHUB_COMMON_EXCLUDES, 'windows-only'],
  },
  {
    id: 'debian',
    label: 'Debian',
    query: 'debian linux in:name,description,topics',
    requiredKeywords: ['debian', 'linux', 'apt', 'deb', 'ubuntu'],
    excludeKeywords: [...GITHUB_COMMON_EXCLUDES, 'windows-only'],
  },
  {
    id: 'rhel',
    label: 'RHEL',
    query: 'redhat rhel enterprise-linux in:name,description,topics',
    requiredKeywords: ['rhel', 'redhat', 'red-hat', 'enterprise-linux', 'enterprise linux'],
    excludeKeywords: [...GITHUB_COMMON_EXCLUDES, 'debian-only', 'ubuntu-only'],
  },
  {
    id: 'rocky',
    label: 'Rocky',
    query: 'rocky linux in:name,description,topics',
    requiredKeywords: ['rocky', 'rockylinux', 'rocky-linux', 'enterprise-linux', 'rhel', 'almalinux'],
    excludeKeywords: [...GITHUB_COMMON_EXCLUDES, 'debian-only', 'ubuntu-only'],
  },
  {
    id: 'fedora',
    label: 'Fedora',
    query: 'fedora linux in:name,description,topics',
    requiredKeywords: ['fedora', 'linux', 'dnf', 'rpm', 'redhat', 'rhel'],
    excludeKeywords: [...GITHUB_COMMON_EXCLUDES, 'debian-only', 'ubuntu-only'],
  },
];

const normRepo = repo => ({
  id: repo.id ?? repo.full_name ?? repo.name,
  name: repo.name || repo.full_name || 'repository',
  fullName: repo.full_name || repo.name || '',
  htmlUrl: repo.html_url || '',
  description: repo.description || '',
  language: repo.language || '',
  stars: repo.stargazers_count ?? 0,
  forks: repo.forks_count ?? 0,
  watchers: repo.watchers_count ?? 0,
  size: repo.size ?? 0,
  license: repo.license || null,
  topics: Array.isArray(repo.topics) ? repo.topics : [],
  updatedAt: repo.pushed_at || repo.updated_at || '',
  defaultBranch: repo.default_branch || 'main',
  archived: !!repo.archived,
  fork: !!repo.fork,
  ownerAvatarUrl: repo.ownerAvatarUrl || repo.owner?.avatar_url || '',
  previewImage: repo.previewImage || repo.readmeImage || '',
  readmeImage: repo.readmeImage || repo.previewImage || '',
  readmeHtml: repo.readmeHtml || '',
  dash: repo.dash || null,
  readmeFetchedAt: repo.readmeFetchedAt || '',
  readmeMissing: !!repo.readmeMissing,
  dashFetchedAt: repo.dashFetchedAt || '',
});

const REPO_NON_IT_EN_LETTER_RE = /(?![A-Za-zÀÈÉÌÒÙàèéìòù])\p{L}/u;
const repoSearchText = (repo) => [
    repo.name, repo.fullName, repo.full_name, repo.description, repo.language,
    ...(Array.isArray(repo.topics) ? repo.topics : []),
  ].join(' ');
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const repoKeywordMatches = (haystack, keyword) => {
  const k = String(keyword || '').trim().toLowerCase();
  if (!k) return false;
  if (/[\s-]/.test(k)) return haystack.includes(k);
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(k)}([^a-z0-9]|$)`, 'i').test(haystack);
};
const repoHasAny = (repo, keywords) => {
  const haystack = repoSearchText(repo).toLowerCase();
  return keywords.some(keyword => repoKeywordMatches(haystack, keyword));
};
const repoHasItEnText = (repo) => !REPO_NON_IT_EN_LETTER_RE.test(repoSearchText(repo));

const repoMatchesCategory = (repo, category) => {
  if (!repoHasItEnText(repo)) return false;
  if (category.source === 'user') return repoHasAny(repo, category.keywords || []);
  if (category.requiredKeywords?.length && !repoHasAny(repo, category.requiredKeywords)) return false;
  if (category.excludeKeywords?.length && repoHasAny(repo, category.excludeKeywords)) return false;
  return true;
};

// ─── GitHub API — coda seriale + guardia rate-limit ─────────────────────────
// TUTTE le chiamate a api.github.com (liste, search, README, languages, contents,
// commits, release) passano da un'unica coda seriale: una alla volta, con delay,
// e con verifica del quota residuo (letto dagli header x-ratelimit-* della
// risposta precedente) PRIMA di ogni nuova richiesta. Se il margine di sicurezza
// non è rispettato la richiesta non parte nemmeno: la repo/categoria resta
// "da fare" e viene ripresa alla prossima run invece di rischiare un 429.
const GH_TOKEN                 = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || readGithubCliToken();
const GITHUB_AUTH_MODE         = process.env.GITHUB_TOKEN || process.env.GH_TOKEN ? 'env token' : (GH_TOKEN ? 'gh cli token' : 'anonimo');
const GITHUB_README_ENRICH_MAX = Number(process.env.GITHUB_README_ENRICH_MAX || (GH_TOKEN ? 10000 : 10)); // autenticato: backfill completo
const GITHUB_DASH_ENRICH_MAX   = Number(process.env.GITHUB_DASH_ENRICH_MAX || (GH_TOKEN ? 10000 : 1));
const GITHUB_CALL_DELAY        = 350;  // ms tra una chiamata GitHub e la successiva
const GH_CORE_MARGIN           = 5;    // non scendere mai sotto questo residuo su "core"
const GH_SEARCH_MARGIN         = 2;    // idem per il bucket "search" (10/min anonimo)

class GhBudgetExhausted extends Error {}
class GhNotFound extends Error {}

const ghState = { core: Infinity, coreReset: 0, search: Infinity, searchReset: 0 };
const ghResourceFor = (url) => (url.includes('/search/') ? 'search' : 'core');
const ghResetLabel = (ms) => (ms ? new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '?');
const ghHeaders = (accept) => ({
  Accept: accept,
  ...(GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' } : {}),
});

const ghPreflight = async () => {
  try {
    const c = await ctx();
    const res = await c.get('https://api.github.com/rate_limit', { timeout: 10000, headers: ghHeaders('application/json') });
    if (!res.ok()) return;
    const data = await res.json();
    ghState.core = data.resources?.core?.remaining ?? Infinity;
    ghState.coreReset = (data.resources?.core?.reset ?? 0) * 1000;
    ghState.search = data.resources?.search?.remaining ?? Infinity;
    ghState.searchReset = (data.resources?.search?.reset ?? 0) * 1000;
    const coreLimit = data.resources?.core?.limit ?? '?';
    const searchLimit = data.resources?.search?.limit ?? '?';
    const authMode = GH_TOKEN ? GITHUB_AUTH_MODE : 'anonimo';
    console.log(`  quota GitHub (${authMode}) → core ${ghState.core}/${coreLimit} (reset ${ghResetLabel(ghState.coreReset)}), search ${ghState.search}/${searchLimit} (reset ${ghResetLabel(ghState.searchReset)})`);
  } catch (e) { console.warn(`  quota GitHub: preflight fallito (${e.message.split('\n')[0]}), procedo con prudenza`); }
};

let ghChain = Promise.resolve();
const ghGetRaw = async (url, accept, asText) => {
  const resource = ghResourceFor(url);
  const margin = resource === 'search' ? GH_SEARCH_MARGIN : GH_CORE_MARGIN;
  if (ghState[resource] <= margin) {
    throw new GhBudgetExhausted(`quota GitHub ${resource} sotto margine di sicurezza (reset ~${ghResetLabel(ghState[`${resource}Reset`])})`);
  }
  const c = await ctx();
  const res = await c.get(url, { timeout: 20000, headers: ghHeaders(accept) });
  const headers = res.headers();
  if (headers['x-ratelimit-remaining'] !== undefined) ghState[resource] = Number(headers['x-ratelimit-remaining']);
  if (headers['x-ratelimit-reset'] !== undefined) ghState[`${resource}Reset`] = Number(headers['x-ratelimit-reset']) * 1000;
  if (res.status() === 404) throw new GhNotFound(`404 ${url}`);
  if (!res.ok()) throw new Error(`HTTP ${res.status()} ${url}`);
  return asText ? await res.text() : await res.json();
};

// Coda seriale globale: una richiesta GitHub alla volta, mai in parallelo.
const ghGet = (url, accept, asText = false) => {
  const step = () => sleep(GITHUB_CALL_DELAY).then(() => ghGetRaw(url, accept, asText));
  ghChain = ghChain.then(step, step);
  return ghChain;
};

const fetchGithubRepoList = async (category) => {
  const url = category.source === 'user'
    ? category.url
    : `https://api.github.com/search/repositories?q=${encodeURIComponent(category.query)}&sort=stars&order=desc&per_page=18`;
  const payload = await ghGet(url, 'application/json');
  const list = category.source === 'user' ? payload : payload.items;
  return (Array.isArray(list) ? list : [])
    .map(normRepo)
    .filter(repo => !repo.archived)
    .filter(repo => !GITHUB_EXCLUDED_REPOS.includes(String(repo.name || '').toLowerCase()))
    .filter(repo => repoMatchesCategory(repo, category))
    .sort((a, b) => (b.stars - a.stars) || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, 18);
};

// Il render HTML di GitHub assolutizza (via camo) i link immagine standard markdown,
// ma non sempre le src/srcset dentro tag <img>/<picture> scritti a mano in HTML puro
// nel README (es. loghi con <picture>/<source> come questo stesso progetto). Le
// riscriviamo esplicitamente su raw.githubusercontent.com/{repo}/{defaultBranch}/…
// così le immagini si vedono anche nel modale, non solo su github.com.
const absolutizeUrl = (url, rawBase) => {
  if (!url) return url;
  if (/^([a-z]+:)?\/\//i.test(url) || url.startsWith('data:')) return url;
  return rawBase + url.replace(/^\.?\//, '');
};

const absolutizeReadmeImages = (html, fullName, defaultBranch) => {
  if (!html) return html;
  const rawBase = `https://raw.githubusercontent.com/${fullName}/${defaultBranch || 'main'}/`;
  return html.replace(/\b(src|srcset)=("|')(.*?)\2/gi, (match, attr, quote, value) => {
    if (attr.toLowerCase() === 'srcset') {
      const rewritten = value.split(',').map(part => {
        const trimmed = part.trim();
        if (!trimmed) return trimmed;
        const [url, descriptor] = trimmed.split(/\s+/, 2);
        return descriptor ? `${absolutizeUrl(url, rawBase)} ${descriptor}` : absolutizeUrl(url, rawBase);
      }).join(', ');
      return `${attr}=${quote}${rewritten}${quote}`;
    }
    return `${attr}=${quote}${absolutizeUrl(value, rawBase)}${quote}`;
  });
};

const extractReadmePreviewImage = (html) => {
  const src = html?.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || '';
  if (!src || src.startsWith('data:')) return '';
  return src.replace(
    /https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\//,
    'https://raw.githubusercontent.com/$1/'
  );
};

// 404 = assenza reale (niente README / niente release ecc.) → dato vuoto legittimo, va cachato.
// GhBudgetExhausted / altri errori propagano: la repo NON va marcata come arricchita,
// così viene ritentata alla prossima run invece di restare vuota per sempre.
const fetchRepoReadmeHtml = async (fullName, defaultBranch) => {
  try {
    const html = await ghGet(`https://api.github.com/repos/${fullName}/readme`, 'application/vnd.github.html+json', true);
    return absolutizeReadmeImages(html, fullName, defaultBranch);
  } catch (e) {
    if (e instanceof GhNotFound) return '';
    throw e;
  }
};

const fetchOptionalJson = async (url) => {
  try { return await ghGet(url, 'application/json'); }
  catch (e) {
    if (e instanceof GhNotFound) return null;
    throw e;
  }
};

const buildRepoDash = async (fullName) => {
  let complete = true;
  const getPart = async (label, url) => {
    try {
      return await fetchOptionalJson(url);
    } catch (e) {
      if (e instanceof GhBudgetExhausted) throw e;
      complete = false;
      console.warn(`    ✗ dettagli ${fullName}/${label}: ${e.message.split('\n')[0]}`);
      return null;
    }
  };

  const languages = await getPart('languages', `https://api.github.com/repos/${fullName}/languages`);
  const contents  = await getPart('contents', `https://api.github.com/repos/${fullName}/contents`);
  const commits   = await getPart('commits', `https://api.github.com/repos/${fullName}/commits?per_page=5`);
  const release   = await getPart('release', `https://api.github.com/repos/${fullName}/releases/latest`);
  return {
    complete,
    languages: languages && typeof languages === 'object' ? languages : {},
    contents: Array.isArray(contents) ? contents.slice(0, 20) : [],
    commits: Array.isArray(commits) ? commits.slice(0, 5) : [],
    release: release && release.tag_name ? release : null,
  };
};

const readPreviousRepoMap = (categoryId) => {
  const p = join(OUT_GITHUB, `${categoryId}.json`);
  const map = new Map();
  if (!existsSync(p)) return map;
  try {
    const prev = JSON.parse(readFileSync(p, 'utf8'));
    (prev.repos || []).forEach(r => {
      if (r.id != null) map.set(`id:${r.id}`, r);
      if (r.fullName) map.set(`name:${r.fullName}`, r);
    });
  } catch {}
  return map;
};

// Un repo può cambiare il proprio README (es. aggiungere/cambiare un'immagine di
// header SVG/PNG) dopo che è già stato fetchato una volta: readmeFetchedAt da solo
// non basta a decidere se è ancora valido, va confrontato con l'ultimo push del repo.
const isReadmeStale = (repo) =>
  !!(repo.readmeFetchedAt && repo.updatedAt &&
     new Date(repo.updatedAt).getTime() > new Date(repo.readmeFetchedAt).getTime());

const githubNeedsBackfill = (file) => {
  if (!existsSync(file)) return true;
  try {
    const payload = JSON.parse(readFileSync(file, 'utf8'));
    const repos = Array.isArray(payload?.repos) ? payload.repos : [];
    if (!repos.length) return true;
    return repos.some(repo => {
      const readmePending = (!repo.readmeFetchedAt && !repo.readmeMissing) || isReadmeStale(repo);
      const dashPending = !repo.dashFetchedAt || !repo.dash;
      return readmePending || dashPending;
    });
  } catch {
    return true;
  }
};

const isGithubFresh = (file) => {
  if (FORCE_GITHUB || !existsSync(file)) return false;
  try {
    const payload = JSON.parse(readFileSync(file, 'utf8'));
    const ts = Date.parse(payload?.generatedAt || '');
    return Number.isFinite(ts) && Date.now() - ts < GITHUB_TTL_MS;
  } catch {
    return false;
  }
};

const getCachedRepo = (previous, repo) => previous.get(`id:${repo.id}`) || previous.get(`name:${repo.fullName}`) || null;

const copyCachedEnrichment = (repo, cached) => {
  if (!cached) return;
  repo.readmeHtml = cached.readmeHtml || '';
  const readmePreview = extractReadmePreviewImage(repo.readmeHtml);
  repo.previewImage = readmePreview || cached.previewImage || cached.readmeImage || '';
  repo.readmeImage = repo.previewImage;
  repo.readmeFetchedAt = cached.readmeFetchedAt || cached.dashFetchedAt || '';
  repo.readmeMissing = !!cached.readmeMissing;
  repo.dash = cached.dash || null;
  repo.dashFetchedAt = cached.dashFetchedAt || '';
};

const enrichRepos = async (categoryId, repos, budget) => {
  const previous = readPreviousRepoMap(categoryId);

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    const cached = getCachedRepo(previous, repo);
    copyCachedEnrichment(repo, cached);

    if ((!repo.readmeFetchedAt || isReadmeStale(repo)) && budget.readmeRemaining > 0 && !budget.hit) {
      try {
        repo.readmeHtml = await fetchRepoReadmeHtml(repo.fullName, repo.defaultBranch);
        repo.previewImage = extractReadmePreviewImage(repo.readmeHtml);
        repo.readmeImage = repo.previewImage;
        repo.readmeFetchedAt = new Date().toISOString();
        repo.readmeMissing = !repo.readmeHtml;
        budget.readmeRemaining -= 1;
        budget.readmeDone += 1;
      } catch (e) {
        if (e instanceof GhBudgetExhausted) {
          console.log(`    ⏸ ${repo.fullName}: ${e.message} — riprendo alla prossima run`);
          budget.hit = true;
        } else {
          console.warn(`    ✗ README ${repo.fullName}: ${e.message.split('\n')[0]}`);
        }
      }
    }

    if (!repo.dashFetchedAt && budget.dashRemaining > 0 && !budget.hit) {
      try {
        const dash = await buildRepoDash(repo.fullName);
        const complete = !!dash.complete;
        delete dash.complete;
        repo.dash = dash;
        if (complete) repo.dashFetchedAt = new Date().toISOString();
        budget.dashRemaining -= 1;
        budget.dashDone += 1;
        if (!complete) console.log(`    ↻ ${repo.fullName}: dettagli parziali salvati, ritento alla prossima run`);
      } catch (e) {
        if (e instanceof GhBudgetExhausted) {
          console.log(`    ⏸ ${repo.fullName}: ${e.message} — dettagli rimandati alla prossima run`);
          budget.hit = true;
        } else {
          console.warn(`    ✗ dettagli ${repo.fullName}: ${e.message.split('\n')[0]}`);
        }
      }
    }

    if (!repo.readmeFetchedAt || !repo.dashFetchedAt) budget.deferred += 1;
  }

  return repos;
};

const buildGithubCategory = async (category, budget) => {
  const repos = await fetchGithubRepoList(category);
  await enrichRepos(category.id, repos, budget);
  return {
    generatedAt: new Date().toISOString(),
    category: { id: category.id, label: category.label, source: category.source || 'search', query: category.query || '' },
    repos,
  };
};

// ─── main ─────────────────────────────────────────────────────────────────────
const run = async () => {
  ensureDir(OUT_CVE);
  ensureDir(OUT_NEWS);
  ensureDir(OUT_GITHUB);
  let didWork = false;
  const failures = []; // solo per il riepilogo finale — non fa mai fallire lo script

  // CVE — seriali (NVD rate limit)
  for (const tech of ['proxmox', 'vmware', 'kubernetes', 'linux']) {
    const out = join(OUT_CVE, `${tech}.json`);
    const err = errStamp(out);
    if (isFresh(out, CVE_TTL_MS)) { console.log(`CVE ${tech}: ok (<6h)`); continue; }
    if (isFresh(err, ERR_TTL_MS)) { console.log(`CVE ${tech}: skip (errore recente)`); continue; }
    didWork = true;
    console.log(`\nCVE ${tech}...`);
    try {
      const data = await buildCve(tech);
      writeFileSync(out, JSON.stringify(data), 'utf8');
      clearErr(out);
      console.log(`  → ${data.length} CVE`);
    } catch(e) { console.error(`  ERRORE: ${e.message}`); markErr(out); failures.push(`CVE ${tech}`); }
  }

  // News — parallele
  console.log('\nNews...');

  // Linux: merge multi-source → linux.xml
  const linuxOut = join(OUT_NEWS, 'linux.xml');
  const linuxErr = errStamp(linuxOut);
  if (!isFresh(linuxOut, CVE_TTL_MS) && !isFresh(linuxErr, ERR_TTL_MS)) {
    didWork = true;
    try {
      const xml = await fetchLinuxNews();
      writeFileSync(linuxOut, xml, 'utf8');
      clearErr(linuxOut);
    } catch(e) { console.error(`  linux ERRORE: ${e.message}`); markErr(linuxOut); failures.push('News linux'); }
  } else { console.log('News linux: ok (<6h)'); }

  // Altri tech: un feed alla volta, primo funzionante vince
  await Promise.allSettled(Object.keys(NEWS_FEEDS).map(async (tech) => {
    const out = join(OUT_NEWS, `${tech}.xml`);
    const err = errStamp(out);
    if (isFresh(out, CVE_TTL_MS)) { console.log(`News ${tech}: ok (<6h)`); return; }
    if (isFresh(err, ERR_TTL_MS)) { console.log(`News ${tech}: skip (errore recente)`); return; }
    didWork = true;
    try {
      const xml = await fetchFeed(tech);
      writeFileSync(out, xml, 'utf8');
      clearErr(out);
    } catch(e) { console.error(`  ${tech} ERRORE: ${e.message}`); markErr(out); failures.push(`News ${tech}`); }
  }));

  // GitHub repositories — static-first like CVE/news.
  console.log('\nGitHub repos...');
  await ghPreflight();
  const ghBudget = {
    readmeRemaining: GITHUB_README_ENRICH_MAX,
    dashRemaining: GITHUB_DASH_ENRICH_MAX,
    readmeDone: 0,
    dashDone: 0,
    deferred: 0,
    hit: false,
  };
  for (const category of GITHUB_CATEGORIES) {
    const out = join(OUT_GITHUB, `${category.id}.json`);
    const err = errStamp(out);
    const needsBackfill = githubNeedsBackfill(out);
    if (isGithubFresh(out) && !(GH_TOKEN && needsBackfill)) {
      console.log(`GitHub ${category.id}: ok (<${Math.round(GITHUB_TTL_MS / 3600000)}h${needsBackfill ? ', backfill rimandato senza token' : ''})`);
      continue;
    }
    if (isFresh(err, ERR_TTL_MS, FORCE_GITHUB)) { console.log(`GitHub ${category.id}: skip (errore recente)`); continue; }
    didWork = true;
    if (needsBackfill && GH_TOKEN) console.log(`  ${category.id}: backfill completo con ${GITHUB_AUTH_MODE}`);
    try {
      const data = await buildGithubCategory(category, ghBudget);
      writeFileSync(out, JSON.stringify(data), 'utf8');
      clearErr(out);
      console.log(`  ✓ ${category.id}: ${data.repos.length} repo`);
    } catch(e) {
      if (e instanceof GhBudgetExhausted) {
        console.log(`  ${category.id}: ${e.message} — mantengo il JSON esistente e riprendo alla prossima run`);
      } else {
        console.error(`  ${category.id} ERRORE: ${e.message}`);
        markErr(out);
        failures.push(`GitHub ${category.id}`);
      }
    }
  }
  console.log(`  enrichment GitHub → README ${ghBudget.readmeDone}/${GITHUB_README_ENRICH_MAX}, dettagli ${ghBudget.dashDone}/${GITHUB_DASH_ENRICH_MAX}, rimandati ${ghBudget.deferred}`);

  if (_ctx) await _ctx.dispose();
  console.log(didWork ? '\n✅ completato' : '✅ tutto fresco, nessun fetch.');
  if (failures.length) console.warn(`⚠️  fonti non aggiornate in questa run (dato precedente mantenuto, si ritenta alla prossima): ${failures.join(', ')}`);
};

// Non deve MAI uscire con exit code diverso da 0: una fonte esterna irraggiungibile
// (NVD/CIRCL/RSS/GitHub) non deve bloccare lo step CI né il commit/build/deploy a
// valle. Ogni fallimento è già gestito per-sezione sopra (dato precedente mantenuto
// su disco, retry alla run successiva); questo catch copre solo errori imprevisti
// dello script stesso e si limita a loggarli.
run().catch(e => { console.error('ERRORE IMPREVISTO:', e); });
