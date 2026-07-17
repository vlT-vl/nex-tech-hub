import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// ─── constants ────────────────────────────────────────────────────────────────
const API_BASE = 'https://raw.githubusercontent.com/vlT-vl/rest-api-vlt/api';

// CORS proxy chain — tried in order, first success wins.
// corsproxy.io can fail / rate-limit for Google News; allorigins.win is the fallback.
const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

// ─── shared helpers ───────────────────────────────────────────────────────────
const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// Direct fetch for trusted URLs (GitHub raw, rest-api-vlt)
const readText = async (url) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};

// Proxy fetch for third-party URLs (Google News RSS) — tries each proxy in order
const readTextViaProxy = async (rawUrl) => {
  let lastErr;
  for (const buildUrl of CORS_PROXIES) {
    try {
      const res = await fetch(buildUrl(rawUrl), { cache: 'no-store' });
      if (res.ok) return res.text();
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) { lastErr = e; }
  }
  throw lastErr ?? new Error('All proxies failed');
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const parseMajor = (version) => {
  const m = String(version || '').match(/^(\d+)/);
  return m ? m[1] : null;
};

// ─── releases ─────────────────────────────────────────────────────────────────
const normalizeRelease = (r, component) => ({
  Versione:         r.Versione || '',
  'Nome Release':   r['Nome Release'] || '',
  'Data Rilascio':  r['Data Rilascio'] || '',
  'End Of Support': r['End Of Support'] || '',
  Codename:         r.Codename || '',
  rawVersion:   r.Versione || '',
  releaseName:  r['Nome Release'] || '',
  codename:     r.Codename || '',
  releaseDate:  r['Data Rilascio'] || '',
  endOfSupport: r['End Of Support'] || '',
  major:        parseMajor(r.Versione),
  component,
});

const compareVersions = (a, b) => {
  const pa = String(a.rawVersion).match(/\d+/g)?.map(Number) || [];
  const pb = String(b.rawVersion).match(/\d+/g)?.map(Number) || [];
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pb[i] || 0) - (pa[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

const sortByReleaseDate = (arr) =>
  [...arr].sort((a, b) => new Date(b['Data Rilascio'] || 0) - new Date(a['Data Rilascio'] || 0));

const getLatestByMajor = (arr, major) =>
  sortByReleaseDate(arr.filter((r) => r.major === major))[0] || null;

const fetchAllReleases = async () => {
  const [pveRaw, pbsRaw, pdmRaw] = await Promise.all([
    fetchJson(`${API_BASE}/v1/proxmox/pve/releases.json`),
    fetchJson(`${API_BASE}/v1/proxmox/pbs/releases.json`),
    fetchJson(`${API_BASE}/v1/proxmox/pdm/releases.json`),
  ]);

  const norm = (arr, label) =>
    (Array.isArray(arr) ? arr : []).map((r) => normalizeRelease(r, label)).sort(compareVersions);

  const pve = norm(pveRaw, 'PVE');
  const pbs = norm(pbsRaw, 'PBS');
  const pdm = norm(pdmRaw, 'PDM');

  return {
    pve, pbs, pdm,
    latest: {
      pve9: getLatestByMajor(pve, '9'),
      pve8: getLatestByMajor(pve, '8'),
      pbs:  sortByReleaseDate(pbs)[0] || null,
      pdm:  sortByReleaseDate(pdm)[0] || null,
    },
  };
};

// ─── tech releases (all vendors) ─────────────────────────────────────────────
const VMWARE_BRANCHES = ['6.0', '6.5', '6.7', '7.0', '8.0', '9.0'];

const normalizeTechRelease = (r, extra = {}) => ({
  rawVersion:   r['Versione']        || '',
  releaseName:  r['Nome Release']    || '',
  codename:     r['Codename']        || '',
  releaseDate:  (r['Data Rilascio']  || '').replace(/\//g, '-'),
  endOfSupport: r['End Of Support']  || '',
  buildNumber:  r['Build Number']    ?? null,
  tipo:         r['Tipo']            || '',
  major:        parseMajor(r['Versione']),
  ...extra,
});

const fetchTechReleases = async () => {
  const [
    k8sRaw,
    ubuntuRaw, debianRaw, rhelRaw, rockyRaw, fedoraRaw,
    esxiResults, vcenterResults,
  ] = await Promise.all([
    fetchJson(`${API_BASE}/v1/kubernetes/releases.json`),
    fetchJson(`${API_BASE}/v1/linux/ubuntu/releases.json`),
    fetchJson(`${API_BASE}/v1/linux/debian/releases.json`),
    fetchJson(`${API_BASE}/v1/linux/rhel/releases.json`),
    fetchJson(`${API_BASE}/v1/linux/rocky/releases.json`),
    fetchJson(`${API_BASE}/v1/linux/fedora/releases.json`),
    Promise.all(VMWARE_BRANCHES.map(v =>
      fetchJson(`${API_BASE}/v1/vmware/esxi/${v}/releases.json`).catch(() => [])
    )),
    Promise.all(VMWARE_BRANCHES.map(v =>
      fetchJson(`${API_BASE}/v1/vmware/vcenter/${v}/releases.json`).catch(() => [])
    )),
  ]);

  const norm = (arr, extra = {}) =>
    (Array.isArray(arr) ? arr : []).map(r => normalizeTechRelease(r, extra));

  const sortByDate = (arr) =>
    [...arr].sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));

  const esxi = sortByDate(
    VMWARE_BRANCHES.flatMap((v, i) =>
      norm(esxiResults[i], { branchVersion: v, major: v.split('.')[0] })
    )
  );

  const vcenter = sortByDate(
    VMWARE_BRANCHES.flatMap((v, i) =>
      norm(vcenterResults[i], { branchVersion: v, major: v.split('.')[0] })
    )
  );

  return {
    kubernetes: norm(k8sRaw),
    linux: {
      ubuntu: norm(ubuntuRaw),
      debian: norm(debianRaw),
      rhel:   norm(rhelRaw),
      rocky:  norm(rockyRaw),
      fedora: norm(fedoraRaw),
    },
    vmware: { esxi, vcenter },
  };
};

// ─── downloads ────────────────────────────────────────────────────────────────
const fetchAllDownloads = async () => {
  const [pveRaw, pbsRaw, pdmRaw, ubuntuRaw, debianRaw, rhelRaw, rockyRaw, fedoraRaw, k8sRaw] = await Promise.all([
    fetchJson(`${API_BASE}/v1/proxmox/downloads/pve.json`),
    fetchJson(`${API_BASE}/v1/proxmox/downloads/pbs.json`),
    fetchJson(`${API_BASE}/v1/proxmox/downloads/pdm.json`),
    fetchJson(`${API_BASE}/v1/linux/ubuntu/downloads.json`).catch(() => []),
    fetchJson(`${API_BASE}/v1/linux/debian/downloads.json`).catch(() => []),
    fetchJson(`${API_BASE}/v1/linux/rhel/downloads.json`).catch(() => []),
    fetchJson(`${API_BASE}/v1/linux/rocky/downloads.json`).catch(() => []),
    fetchJson(`${API_BASE}/v1/linux/fedora/downloads.json`).catch(() => []),
    fetchJson(`${API_BASE}/v1/kubernetes/downloads.json`).catch(() => []),
  ]);
  const sortDl = (arr) =>
    (Array.isArray(arr) ? arr : []).sort(
      (a, b) => new Date(b.data_ultimo_aggiornamento || 0) - new Date(a.data_ultimo_aggiornamento || 0)
    );
  return {
    pve: sortDl(pveRaw), pbs: sortDl(pbsRaw), pdm: sortDl(pdmRaw),
    ubuntu: sortDl(ubuntuRaw), debian: sortDl(debianRaw), rhel: sortDl(rhelRaw),
    rocky: sortDl(rockyRaw), fedora: sortDl(fedoraRaw), kubernetes: sortDl(k8sRaw),
  };
};

// ─── CVE ──────────────────────────────────────────────────────────────────────
// Static files generated by scripts/fetch-static-data.mjs (CI + npm run data:fetch)
const CVE_STATIC = (tech) => `${import.meta.env.BASE_URL}data/cve/${tech}.json`;

const CVE_CACHE_KEYS = { proxmox: 'cve_proxmox_cache', vmware: 'cve_vmware_cache', kubernetes: 'cve_k8s_cache', linux: 'cve_linux_cache' };
// 24h TTL: localStorage persists across sessions. Used as in-session cache
// when static files are present, and as the only cache in local dev (NVD fallback).
const CVE_CACHE_TTL = 1000 * 60 * 60 * 24;
const RESULTS_PER_PAGE = 100;
// NVD free tier: 5 req / 30s rolling window. 7.5s gives ~4 req/30s — safe margin.
const REQUEST_DELAY_MS = 7500;

// Searches per tech — each array is processed sequentially inside fetchCvesForTech
// to respect NVD rate limit (5 req / 30s without API key).
// Fetches for different techs are triggered lazily (one at a time) by the widget,
// so there is NO parallel cross-tech NVD pressure.
const CVE_SEARCHES = {
  proxmox: [
    { keyword: 'Proxmox VE',                  forceProduct: 'PVE' },
    { keyword: 'Proxmox Virtual Environment', forceProduct: 'PVE' },
    { keyword: 'Proxmox Backup Server',        forceProduct: 'PBS' },
    { keyword: 'Proxmox Datacenter Manager',   forceProduct: 'PDM' },
    { keyword: 'Proxmox',                      forceProduct: null  },
  ],
  vmware: [
    { keyword: 'VMware ESXi',    forceProduct: 'ESXi'    },
    { keyword: 'vCenter Server', forceProduct: 'vCenter' },
  ],
  kubernetes: [
    { keyword: 'Kubernetes', forceProduct: 'Kubernetes' },
  ],
  linux: [
    { keyword: 'Linux kernel', forceProduct: 'Kernel' },
    { keyword: 'Ubuntu Linux', forceProduct: 'Ubuntu' },
  ],
};

const oneYearAgo = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 23);
};

const readCveCache = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CVE_CACHE_TTL) return null;
    return data.map((c) => ({ ...c, published: new Date(c.published) }));
  } catch { return null; }
};

const writeCveCache = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
};

const normalizeText       = (v) => (v || '').toString().toLowerCase();
const extractDescriptions = (cve) => (cve.descriptions || []).map((d) => d.value || '').join(' ');
const extractReferences   = (cve) => (cve.references  || []).map((r) => `${r.url || ''} ${(r.tags || []).join(' ')}`).join(' ');

const collectCriteria = (nodes = []) => {
  const vals = [];
  const walk = (list) => list.forEach((n) => {
    (n.cpeMatch || []).forEach((m) => {
      if (m.criteria)        vals.push(m.criteria);
      if (m.matchCriteriaId) vals.push(m.matchCriteriaId);
    });
    if (n.nodes?.length) walk(n.nodes);
  });
  walk(nodes);
  return vals.join(' ');
};

const cveTextBlob = (cve) => [
  normalizeText(extractDescriptions(cve)),
  normalizeText(collectCriteria(cve.configurations?.nodes || [])),
  normalizeText(extractReferences(cve)),
].join(' ');

const detectProxmoxProducts = (cve) => {
  const t = cveTextBlob(cve);
  const out = [];
  if (/proxmox/i.test(t) && (/\bproxmox\s+ve\b/i.test(t) || /\bproxmox\s+virtual\s+environment\b/i.test(t) || /virtual_environment/i.test(t))) out.push('PVE');
  if (/proxmox/i.test(t) && (/\bproxmox\s+backup\s+server\b/i.test(t) || /backup_server/i.test(t)))                                               out.push('PBS');
  if (/proxmox/i.test(t) && (/\bproxmox\s+datacenter\s+manager\b/i.test(t) || /datacenter_manager/i.test(t)))                                     out.push('PDM');
  return out;
};

const detectVmwareProducts = (cve) => {
  const t = cveTextBlob(cve);
  const out = [];
  if (/\besxi\b/i.test(t) || /vmware_esxi/i.test(t))       out.push('ESXi');
  if (/\bvcenter\b/i.test(t) || /vsphere_client/i.test(t)) out.push('vCenter');
  if (!out.length) out.push('VMware');
  return out;
};

const detectK8sProducts   = () => ['Kubernetes'];
const detectLinuxProducts = () => ['Linux'];

const DETECT_FN = {
  proxmox:    detectProxmoxProducts,
  vmware:     detectVmwareProducts,
  kubernetes: detectK8sProducts,
  linux:      detectLinuxProducts,
};

const getSeverityData = (cve) => {
  const metric = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV30?.[0] || cve.metrics?.cvssMetricV2?.[0] || null;
  const data   = metric?.cvssData || null;
  return { severity: metric?.baseSeverity || data?.baseSeverity || 'N/A', score: data?.baseScore ?? 'N/A' };
};

const nvdUrl = (keyword, startIndex = 0, pubStart = null) => {
  const params = {
    keywordSearch: keyword,
    resultsPerPage: String(RESULTS_PER_PAGE),
    startIndex: String(startIndex),
  };
  if (pubStart) params.pubStartDate = pubStart;
  return `https://services.nvd.nist.gov/rest/json/cves/2.0?${new URLSearchParams(params)}`;
};

const fetchAllNvdPages = async (keyword, pubStart = null) => {
  let idx = 0, total = 0, all = [], first = true;
  do {
    if (!first) await sleep(REQUEST_DELAY_MS);
    const res = await fetch(nvdUrl(keyword, idx, pubStart));
    if (!res.ok) throw new Error(`NVD ${res.status}`);
    const data = await res.json();
    total = data.totalResults || 0;
    all   = [...all, ...(data.vulnerabilities || [])];
    idx  += data.resultsPerPage || RESULTS_PER_PAGE;
    first = false;
  } while (idx < total);
  return all;
};

const fetchCvesForTech = async (tech) => {
  const cacheKey = CVE_CACHE_KEYS[tech];
  const cached   = readCveCache(cacheKey);
  if (cached) return cached;

  // Fast path: static file pre-generated by CI (scripts/fetch-static-data.mjs).
  // In production: always present, instant load. In dev: run `npm run data:fetch` once.
  try {
    const res = await fetch(CVE_STATIC(tech));
    if (res.ok) {
      const data   = await res.json();
      const parsed = data.map((c) => ({ ...c, published: new Date(c.published) }));
      writeCveCache(cacheKey, parsed);
      return parsed;
    }
  } catch {}

  // Slow path: live NVD API (dev without static files, or CI fetch failure).
  const searches = CVE_SEARCHES[tech];
  const detectFn = DETECT_FN[tech];
  const pubStart = tech !== 'proxmox' ? oneYearAgo() : null;

  const map        = new Map();
  let   anySuccess = false; // track if at least one NVD request succeeded (HTTP 200)

  for (let i = 0; i < searches.length; i++) {
    const { keyword, forceProduct } = searches[i];
    if (i > 0) await sleep(REQUEST_DELAY_MS);
    let raw = [];
    try {
      raw        = await fetchAllNvdPages(keyword, pubStart);
      anySuccess = true;
    } catch { continue; } // rate limit or network error — try next keyword

    raw.forEach(({ cve }) => {
      if (!cve?.id) return;
      let products = detectFn(cve);
      if (forceProduct && !products.includes(forceProduct)) products = [...products, forceProduct];
      products = Array.from(new Set(products));
      if (!products.length) return;
      const { severity, score } = getSeverityData(cve);
      if (!map.has(cve.id)) {
        map.set(cve.id, {
          id: cve.id, products, productLabel: products.join(', '),
          severity, score, published: new Date(cve.published),
          link: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
        });
      } else {
        const e      = map.get(cve.id);
        const merged = Array.from(new Set([...e.products, ...products]));
        e.products = merged; e.productLabel = merged.join(', ');
        if (e.severity === 'N/A' && severity !== 'N/A') e.severity = severity;
        if (e.score    === 'N/A' && score    !== 'N/A') e.score    = score;
        if (new Date(cve.published) > e.published) e.published = new Date(cve.published);
      }
    });
  }

  // If zero NVD requests succeeded, the API is unavailable (rate limit / network).
  // Throw so the widget shows an error state rather than an empty table.
  if (!anySuccess) throw new Error('NVD API unavailable');

  const result = Array.from(map.values()).sort((a, b) => b.published - a.published);
  writeCveCache(cacheKey, result);
  return result;
};

// ─── news ─────────────────────────────────────────────────────────────────────

// Static files generated by scripts/fetch-static-data.mjs (CI + npm run data:fetch).
// Fallback: live proxy fetch (dev without static files, or CI partial failure).
const NEWS_STATIC_FILES = {
  proxmox:    [`${import.meta.env.BASE_URL}data/news/proxmox.xml`],
  vmware:     [`${import.meta.env.BASE_URL}data/news/vmware.xml`],
  kubernetes: [`${import.meta.env.BASE_URL}data/news/kubernetes.xml`],
  linux:      [`${import.meta.env.BASE_URL}data/news/linux.xml`],
};

const NEWS_PROXY_FEEDS = {
  proxmox:    ['https://www.proxmox.com/en/news?format=feed&type=rss', 'https://forum.proxmox.com/whats-new/posts.rss'],
  vmware:     ['https://blogs.vmware.com/feed/', 'https://blogs.broadcom.com/feed/'],
  kubernetes: ['https://kubernetes.io/feed.xml'],
  linux:      ['https://www.phoronix.com/rss.php', 'https://ubuntu.com/blog/feed', 'https://lwn.net/headlines/rss'],
};

export const NEWS_LINKS = {
  proxmox: {
    it: {
      source:    'https://www.proxmox.com/en/about/company-details/press-releases',
      community: 'https://news.google.com/search?q=Proxmox%20VE%20OR%20Proxmox%20Backup%20Server&hl=it&gl=IT&ceid=IT:it',
    },
    en: {
      source:    'https://www.proxmox.com/en/about/company-details/press-releases',
      community: 'https://news.google.com/search?q=Proxmox%20VE%20OR%20Proxmox%20Backup%20Server&hl=en-US&gl=US&ceid=US:en',
    },
  },
  vmware: {
    it: {
      source:    'https://blogs.vmware.com/',
      community: 'https://news.google.com/search?q=VMware+ESXi+OR+vCenter+Server&hl=it&gl=IT&ceid=IT:it',
    },
    en: {
      source:    'https://blogs.vmware.com/',
      community: 'https://news.google.com/search?q=VMware+ESXi+OR+vCenter+Server&hl=en-US&gl=US&ceid=US:en',
    },
  },
  kubernetes: {
    it: {
      source:    'https://kubernetes.io/blog/',
      community: 'https://news.google.com/search?q=Kubernetes+release+OR+kubernetes.io&hl=it&gl=IT&ceid=IT:it',
    },
    en: {
      source:    'https://kubernetes.io/blog/',
      community: 'https://news.google.com/search?q=Kubernetes+release+OR+kubernetes.io&hl=en-US&gl=US&ceid=US:en',
    },
  },
  linux: {
    it: {
      source:    'https://www.linux.org/news/',
      community: 'https://news.google.com/search?q=Ubuntu+Linux+OR+Debian+release+OR+Red+Hat+Enterprise+Linux&hl=it&gl=IT&ceid=IT:it',
    },
    en: {
      source:    'https://www.linux.org/news/',
      community: 'https://news.google.com/search?q=Ubuntu+Linux+OR+Debian+release+OR+Red+Hat+Enterprise+Linux&hl=en-US&gl=US&ceid=US:en',
    },
  },
};

const getSourceDomain = (href) => {
  try { return new URL(href).hostname.replace(/^www\./, ''); } catch { return ''; }
};

const fmtNewsDate = (value, language) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'it' ? 'it-IT' : 'en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(d);
};

const nodeText = (node, sel) => node.querySelector(sel)?.textContent?.trim() || '';

const decodeHtml = (value) => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value || '';
  return textarea.value;
};

const sameNewsText = (a, b) =>
  a.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() ===
  b.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const cleanNewsSummary = (value, title) => {
  const decoded = decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  const summary = decodeHtml(decoded).replace(/\s+/g, ' ').trim();
  if (!summary || sameNewsText(summary, title)) return '';

  const normalizedSummary = summary.toLowerCase();
  const normalizedTitle   = title.toLowerCase();
  if (normalizedSummary.includes(normalizedTitle) && summary.length <= title.length + 80) return '';

  return summary;
};

const PROXMOX_TITLE_RE = /\bProxmox\b/i;
// Reject titles in non-Latin scripts (Japanese, Chinese, Korean, Arabic, etc.)
const NON_LATIN_RE = /[぀-鿿가-힯؀-ۿऀ-ॿ฀-๿]/;

const parseRss = (xml, language, fallback, limit = 5, skipFilter = false) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid RSS');
  const channelTitle = nodeText(doc, 'channel > title') || 'News';
  const seen = new Set();
  return Array.from(doc.querySelectorAll('item'))
    .map((item) => {
      const title = nodeText(item, 'title').replace(/\s+/g, ' ');
      if (title.length < 12 || seen.has(title)) return null;
      if (NON_LATIN_RE.test(title)) return null;
      if (!skipFilter && !PROXMOX_TITLE_RE.test(title)) return null;
      seen.add(title);
      const href      = nodeText(item, 'link') || fallback;
      const sourceUrl = item.querySelector('source')?.getAttribute('url') || '';
      return {
        title,
        date:         fmtNewsDate(nodeText(item, 'pubDate'), language),
        category:     nodeText(item, 'category') || nodeText(item, 'source') || channelTitle,
        summary:      cleanNewsSummary(nodeText(item, 'description'), title),
        href,
        sourceDomain: getSourceDomain(sourceUrl || href),
      };
    })
    .filter(Boolean)
    .slice(0, limit);
};

const fetchNewsForTech = async (tech, language) => {
  const links = NEWS_LINKS[tech]?.[language] || NEWS_LINKS.proxmox.it;

  // 1. Static file (CI-generated, same-origin, no CORS).
  for (const url of (NEWS_STATIC_FILES[tech] || [])) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const items = parseRss(await res.text(), language, links.source, 12, true);
        if (items.length) return items;
      }
    } catch {}
  }

  // 2. Live proxy fallback (dev without static files, or CI partial failure).
  for (const url of (NEWS_PROXY_FEEDS[tech] || [])) {
    try {
      const items = parseRss(await readTextViaProxy(url), language, links.source, 12, true);
      if (items.length) return items;
    } catch {}
  }

  throw new Error(`No news for ${tech}`);
};

// ─── context ──────────────────────────────────────────────────────────────────
const DataContext = createContext(null);

export const useData = () => useContext(DataContext);

const IDLE = { data: [], loading: false, error: '' };

export function DataProvider({ language, children }) {
  const [releases,     setReleases]     = useState({ data: null, loading: true, error: '' });
  const [downloads,    setDownloads]    = useState({ data: null, loading: true, error: '' });
  const [techReleases, setTechReleases] = useState({ data: null, loading: true, error: '' });

  // All techs start idle. Fetches are triggered lazily by the widgets via
  // requestCveTech / requestNewsTech when the user switches to that tab.
  const [cves, setCves] = useState({
    proxmox:    { ...IDLE },
    vmware:     { ...IDLE },
    kubernetes: { ...IDLE },
    linux:      { ...IDLE },
  });

  const [news, setNews] = useState({
    proxmox:    { ...IDLE },
    vmware:     { ...IDLE },
    kubernetes: { ...IDLE },
    linux:      { ...IDLE },
  });

  // Idempotency guards — prevent the same key from being fetched twice.
  const cveFetched  = useRef(new Set());
  const newsFetched = useRef(new Set());

  // NVD fetch chain: all CVE fetches run serially to avoid hitting NVD rate limits
  // (5 req / 30s without API key). Each requestCveTech call appends to the chain;
  // the next fetch only starts after the previous one resolves/rejects.
  const nvdChain = useRef(Promise.resolve());

  useEffect(() => {
    fetchAllReleases()
      .then((data) => setReleases({ data, loading: false, error: '' }))
      .catch(() => setReleases({ data: null, loading: false, error: 'error' }));
  }, []);

  useEffect(() => {
    fetchAllDownloads()
      .then((data) => setDownloads({ data, loading: false, error: '' }))
      .catch(() => setDownloads({ data: null, loading: false, error: 'error' }));
  }, []);

  useEffect(() => {
    fetchTechReleases()
      .then((data) => setTechReleases({ data, loading: false, error: '' }))
      .catch(() => setTechReleases({ data: null, loading: false, error: 'error' }));
  }, []);

  // Called by cvewidget when the user switches to a tech tab.
  // Idempotent. Appends to nvdChain so fetches never run in parallel.
  const requestCveTech = useCallback((tech) => {
    if (cveFetched.current.has(tech)) return;
    cveFetched.current.add(tech);
    setCves((prev) => ({ ...prev, [tech]: { data: [], loading: true, error: '' } }));
    nvdChain.current = nvdChain.current.then(() =>
      fetchCvesForTech(tech)
        .then((data) => setCves((prev) => ({ ...prev, [tech]: { data, loading: false, error: '' } })))
        .catch(() => setCves((prev) => ({ ...prev, [tech]: { data: [], loading: false, error: 'error' } })))
    );
  }, []);

  // Called by newswidget when the user switches to a tech tab (or language changes).
  // Key includes language so a language switch re-fetches with the new locale.
  const requestNewsTech = useCallback((tech, lang) => {
    const key = `${tech}-${lang}`;
    if (newsFetched.current.has(key)) return;
    newsFetched.current.add(key);
    setNews((prev) => ({ ...prev, [tech]: { data: [], loading: true, error: '' } }));
    fetchNewsForTech(tech, lang)
      .then((data) => setNews((prev) => ({ ...prev, [tech]: { data, loading: false, error: '' } })))
      .catch(() => setNews((prev) => ({ ...prev, [tech]: { data: [], loading: false, error: 'error' } })));
  }, []);

  return (
    <DataContext.Provider value={{
      releases, downloads, techReleases, cves, news,
      requestCveTech, requestNewsTech,
    }}>
      {children}
    </DataContext.Provider>
  );
}
