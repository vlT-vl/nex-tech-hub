import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GoEye, GoFile, GoFileDirectory, GoGitCommit, GoRepo, GoRepoForked, GoStar, GoTag } from 'react-icons/go';
import { GrVmware } from 'react-icons/gr';
import {
  SiDebian, SiFedora, SiGithub, SiKubernetes, SiProxmox, SiRedhat, SiRockylinux, SiUbuntu,
} from 'react-icons/si';
import { LuExternalLink, LuSearch, LuX } from 'react-icons/lu';
import { TbBrandGithubCopilot } from 'react-icons/tb';
import { getUiText } from '../lib/uiText';

const GITHUB_USER = 'vlT-vl';
// nex-tech-hub è questa stessa app: va sempre esclusa dalla vista "vlT".
const GITHUB_EXCLUDED_REPOS = ['nex-tech-hub'];
const VENDOR_KEYWORDS = [
  'vmware', 'vsphere', 'esxi', 'vcenter',
  'proxmox', 'pve', 'pbs', 'pdm',
  'kubernetes', 'k8s',
  'linux', 'ubuntu', 'debian', 'rhel', 'redhat', 'rocky', 'fedora',
];
const COMMON_EXCLUDES = [
  'macos', 'macosx', 'osx', 'hackintosh', 'opencore', 'apple', 'ios',
  'android', 'game', 'gaming', 'minecraft', 'wallpaper', 'theme-pack',
];

const REPO_CATEGORIES = [
  {
    id: 'vlt',
    label: 'vlT',
    Icon: TbBrandGithubCopilot,
    color: '#5b5bd6',
    source: 'user',
    keywords: VENDOR_KEYWORDS,
  },
  {
    id: 'proxmox',
    label: 'Proxmox',
    Icon: SiProxmox,
    color: '#e57000',
    query: 'proxmox in:name,description,topics',
    requiredKeywords: ['proxmox', 'proxmox-ve', 'proxmoxve', 'pve', 'pbs', 'pdm'],
    excludeKeywords: [...COMMON_EXCLUDES, 'ventura', 'sonoma', 'sequoia', 'monterey'],
  },
  {
    id: 'vmware',
    label: 'VMware',
    Icon: GrVmware,
    color: '#56a668',
    query: 'vmware vsphere esxi vcenter in:name,description,topics',
    requiredKeywords: ['vmware', 'vsphere', 'esxi', 'vcenter', 'vcenter-server', 'powercli'],
    excludeKeywords: [...COMMON_EXCLUDES, 'virtualbox', 'hyper-v', 'kvm-only', 'qemu-only'],
  },
  {
    id: 'kubernetes',
    label: 'Kubernetes',
    Icon: SiKubernetes,
    color: '#326ce5',
    query: 'kubernetes k8s in:name,description,topics',
    requiredKeywords: ['kubernetes', 'k8s', 'kubectl', 'helm', 'operator', 'container', 'cluster'],
    excludeKeywords: [...COMMON_EXCLUDES, 'docker-only'],
  },
  {
    id: 'ubuntu',
    label: 'Ubuntu',
    Icon: SiUbuntu,
    color: '#e95420',
    query: 'ubuntu linux in:name,description,topics',
    requiredKeywords: ['ubuntu', 'linux', 'apt', 'deb', 'debian'],
    excludeKeywords: [...COMMON_EXCLUDES, 'windows-only'],
  },
  {
    id: 'debian',
    label: 'Debian',
    Icon: SiDebian,
    color: '#a81d33',
    query: 'debian linux in:name,description,topics',
    requiredKeywords: ['debian', 'linux', 'apt', 'deb', 'ubuntu'],
    excludeKeywords: [...COMMON_EXCLUDES, 'windows-only'],
  },
  {
    id: 'rhel',
    label: 'RHEL',
    Icon: SiRedhat,
    color: '#cc0000',
    query: 'redhat rhel enterprise-linux in:name,description,topics',
    requiredKeywords: ['rhel', 'redhat', 'red-hat', 'enterprise-linux', 'enterprise linux'],
    excludeKeywords: [...COMMON_EXCLUDES, 'debian-only', 'ubuntu-only'],
  },
  {
    id: 'rocky',
    label: 'Rocky',
    Icon: SiRockylinux,
    color: '#10b981',
    query: 'rocky linux in:name,description,topics',
    requiredKeywords: ['rocky', 'rockylinux', 'rocky-linux', 'enterprise-linux', 'rhel', 'almalinux'],
    excludeKeywords: [...COMMON_EXCLUDES, 'debian-only', 'ubuntu-only'],
  },
  {
    id: 'fedora',
    label: 'Fedora',
    Icon: SiFedora,
    color: '#3c6eb4',
    query: 'fedora linux in:name,description,topics',
    requiredKeywords: ['fedora', 'linux', 'dnf', 'rpm', 'redhat', 'rhel'],
    excludeKeywords: [...COMMON_EXCLUDES, 'debian-only', 'ubuntu-only'],
  },
];

const copyByLang = {
  it: {
    title: 'GitHub Repo',
    subtitle: 'Repository pubblici e tool GitHub collegati alle tecnologie del portale.',
    search: 'Cerca repo, descrizione, topic...',
    loading: 'Caricamento repository...',
    error: 'Repository GitHub non disponibili. Riprova tra qualche minuto.',
    empty: 'Nessun repository trovato per questa categoria.',
    updated: 'Aggiornato',
    source: 'Sorgente GitHub',
    allPublic: 'Repository pubblici',
    language: 'Language',
    noDescription: 'Nessuna descrizione disponibile.',
    readmeUnavailable: 'README non incluso nel dataset statico.',
    detailsUnavailable: 'Dettagli non inclusi nel dataset statico.',
    basicDetails: 'Dettagli base',
    defaultBranch: 'Branch default',
    size: 'Dimensione',
    type: 'Tipo',
    results: 'risultati',
  },
  en: {
    title: 'GitHub Repo',
    subtitle: 'Public repositories and GitHub tools related to the portal technologies.',
    search: 'Search repo, description, topic...',
    loading: 'Loading repositories...',
    error: 'GitHub repositories unavailable. Try again in a few minutes.',
    empty: 'No repositories found for this category.',
    updated: 'Updated',
    source: 'GitHub source',
    allPublic: 'Public repositories',
    language: 'Language',
    noDescription: 'No description available.',
    readmeUnavailable: 'README not included in the static dataset.',
    detailsUnavailable: 'Details not included in the static dataset.',
    basicDetails: 'Basic details',
    defaultBranch: 'Default branch',
    size: 'Size',
    type: 'Type',
    results: 'results',
  },
};

function VltCubeIcon({ className }) {
  return (
    <img
      className={`gh-repo-vlt-cube${className ? ` ${className}` : ''}`}
      src={`${import.meta.env.BASE_URL}res/vltcube.svg`}
      alt=""
      aria-hidden="true"
    />
  );
}

function extractReadmePreviewImage(html) {
  const src = html?.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || '';
  if (!src || src.startsWith('data:')) return '';
  return src.replace(
    /https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\//,
    'https://raw.githubusercontent.com/$1/'
  );
}

function normalizeRepo(repo) {
  const readmeHtml = repo.readmeHtml || '';
  const readmePreview = extractReadmePreviewImage(readmeHtml);

  return {
    id: repo.id ?? repo.fullName ?? repo.full_name ?? repo.name,
    name: repo.name || repo.fullName || repo.full_name || 'repository',
    fullName: repo.fullName || repo.full_name || repo.name || '',
    htmlUrl: repo.htmlUrl || repo.html_url || '',
    description: repo.description || '',
    language: repo.language || '',
    stars: repo.stars ?? repo.stargazers_count ?? 0,
    forks: repo.forks ?? repo.forks_count ?? 0,
    watchers: repo.watchers ?? repo.watchers_count ?? 0,
    size: repo.size ?? 0,
    license: repo.license || null,
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    updatedAt: repo.updatedAt || repo.pushed_at || repo.updated_at || '',
    defaultBranch: repo.defaultBranch || repo.default_branch || 'main',
    archived: !!repo.archived,
    fork: !!repo.fork,
    ownerAvatarUrl: repo.ownerAvatarUrl || repo.owner?.avatar_url || '',
    previewImage: readmePreview || repo.previewImage || repo.readmeImage || '',
    readmeImage: readmePreview || repo.readmeImage || repo.previewImage || '',
    readmeHtml,
    dash: repo.dash || null,
    readmeFetchedAt: repo.readmeFetchedAt || '',
    readmeMissing: !!repo.readmeMissing,
    dashFetchedAt: repo.dashFetchedAt || '',
  };
}

const REPO_NON_IT_EN_LETTER_RE = /(?![A-Za-zÀÈÉÌÒÙàèéìòù])\p{L}/u;
const repoSearchText = (repo) => [
    repo.name,
    repo.fullName,
    repo.description,
    repo.language,
    ...repo.topics,
  ].join(' ');
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const repoKeywordMatches = (haystack, keyword) => {
  const k = String(keyword || '').trim().toLowerCase();
  if (!k) return false;
  if (/[\s-]/.test(k)) return haystack.includes(k);
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(k)}([^a-z0-9]|$)`, 'i').test(haystack);
};

function repoMatchesKeywords(repo, keywords = []) {
  if (!keywords.length) return true;
  const haystack = repoSearchText(repo).toLowerCase();
  return keywords.some(keyword => repoKeywordMatches(haystack, keyword));
}

function repoMatchesCategory(repo, category) {
  if (REPO_NON_IT_EN_LETTER_RE.test(repoSearchText(repo))) return false;
  if (category.source === 'user') return repoMatchesKeywords(repo, category.keywords);
  if (category.requiredKeywords?.length && !repoMatchesKeywords(repo, category.requiredKeywords)) return false;
  if (category.excludeKeywords?.length && repoMatchesKeywords(repo, category.excludeKeywords)) return false;
  return true;
}

async function fetchStaticRepos(category) {
  const cleanBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  const paths = [
    `${cleanBase}/data/github/${category.id}.json`,
    `./data/github/${category.id}.json`,
    `/data/github/${category.id}.json`,
  ];
  let payload = null;
  let lastError = null;

  for (const path of [...new Set(paths)]) {
    try {
      const current = await fetch(path, { cache: 'no-store' });
      if (current.ok) {
        payload = await current.json();
        break;
      }
      lastError = new Error(`${path} HTTP ${current.status}`);
    } catch (err) {
      lastError = err;
    }
  }

  if (!payload) {
    if (lastError) console.warn('[GitHub Repo] static data fetch failed', lastError);
    throw lastError || new Error('GitHub static data unavailable');
  }

  const sourceList = Array.isArray(payload) ? payload : (payload.repos || payload.items);
  return (Array.isArray(sourceList) ? sourceList : [])
    .map(normalizeRepo)
    .filter(repo => !repo.archived)
    .filter(repo => !GITHUB_EXCLUDED_REPOS.includes(String(repo.name || '').toLowerCase()))
    .filter(repo => repoMatchesCategory(repo, category))
    .sort((a, b) => (b.stars - a.stars) || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

function formatDate(value, language) {
  if (!value) return 'N/D';
  try {
    return new Intl.DateTimeFormat(language === 'it' ? 'it-IT' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatSize(kb) {
  if (!Number.isFinite(kb)) return '0 KB';
  return kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

function timeAgo(value, language) {
  if (!value) return 'N/D';
  const diff = Date.now() - new Date(value).getTime();
  const minute = Math.floor(diff / 60000);
  if (minute < 1) return language === 'it' ? 'adesso' : 'now';
  if (minute < 60) return `${minute}m`;
  const hour = Math.floor(minute / 60);
  if (hour < 24) return `${hour}h`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day}d`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo`;
  return `${Math.floor(day / 365)}y`;
}

function RepoCard({ repo, color, copy, language, onOpen, isVlt }) {
  return (
    <article
      className="gh-repo-card"
      style={{ '--repo-color': color }}
      onClick={() => onOpen(repo)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen(repo)}
    >
      <div className="gh-repo-card__top">
        <div className="gh-repo-card__icon">
          {isVlt ? <VltCubeIcon /> : <GoRepo />}
          {repo.previewImage && (
            <img
              className="gh-repo-card__icon-photo"
              src={repo.previewImage}
              alt=""
              loading="lazy"
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          )}
        </div>
        <div className="gh-repo-card__title">
          <h3>{repo.name}</h3>
          <span>{repo.fullName}</span>
        </div>
        <a
          className="gh-repo-card__open"
          href={repo.htmlUrl}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          aria-label={`${copy.source}: ${repo.fullName}`}
        >
          <LuExternalLink />
        </a>
      </div>

      <p className="gh-repo-card__desc">{repo.description || copy.noDescription}</p>

      <div className="gh-repo-card__meta">
        {repo.language && <span className="gh-repo-chip">{copy.language}: {repo.language}</span>}
        <span className="gh-repo-stat"><GoStar /> {repo.stars}</span>
        <span className="gh-repo-stat"><GoRepoForked /> {repo.forks}</span>
      </div>

      {repo.topics.length > 0 && (
        <div className="gh-repo-card__topics">
          {repo.topics.slice(0, 5).map(topic => <span key={topic}>{topic}</span>)}
        </div>
      )}

      <div className="gh-repo-card__footer">
        <span>{copy.updated}: {formatDate(repo.updatedAt, language)}</span>
        {repo.fork && <span>fork</span>}
      </div>
    </article>
  );
}

function GithubRepoModal({ repo, color, copy, language, onClose }) {
  const [activeTab, setActiveTab] = useState('readme');
  const readme = repo.readmeHtml || '';
  const details = repo.dash ? {
    languages: repo.dash.languages && typeof repo.dash.languages === 'object' ? repo.dash.languages : {},
    contents: Array.isArray(repo.dash.contents) ? repo.dash.contents : [],
    commits: Array.isArray(repo.dash.commits) ? repo.dash.commits : [],
    release: repo.dash.release || null,
  } : null;

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const totalBytes = details
    ? Object.values(details.languages).reduce((acc, value) => acc + value, 0)
    : 0;
  const hasRichDetails = details && (
    totalBytes > 0 ||
    details.contents.length > 0 ||
    details.commits.length > 0 ||
    details.release
  );
  const basicDetails = [
    [copy.defaultBranch, repo.defaultBranch],
    [copy.language, repo.language || 'N/D'],
    [copy.size, formatSize(repo.size)],
    [copy.updated, formatDate(repo.updatedAt, language)],
    [copy.type, repo.fork ? 'fork' : 'source'],
  ];

  return createPortal(
    <div className="gh-rmo-overlay" onClick={onClose}>
      <div className="gh-rmo-card" style={{ '--repo-color': color, '--repo-color-dim': `${color}20` }} onClick={e => e.stopPropagation()}>
        <div className="gh-rmo-scroll">
          <div className="gh-rmo-header">
            <div className="gh-rmo-header-main">
              <div className="gh-rmo-icon"><GoRepo /></div>
              <div>
                <div className="gh-rmo-title-row">
                  <h2>{repo.name}</h2>
                  {repo.language && <span className="gh-rmo-lang">{repo.language}</span>}
                </div>
                <p>{repo.description || copy.noDescription}</p>
              </div>
            </div>
            <div className="gh-rmo-actions">
              <a href={repo.htmlUrl} target="_blank" rel="noreferrer" aria-label={`${copy.source}: ${repo.fullName}`}>
                <SiGithub />
              </a>
              <button type="button" onClick={onClose} aria-label={getUiText(language).common.close}>
                <LuX />
              </button>
            </div>
          </div>

          <div className="gh-rmo-stats">
            <span><GoStar /> {repo.stars}</span>
            <span><GoRepoForked /> {repo.forks}</span>
            <span><GoEye /> {repo.watchers}</span>
            <span>{formatSize(repo.size)}</span>
            {repo.license && <span>{repo.license.spdx_id || repo.license.name}</span>}
          </div>

          {repo.topics.length > 0 && (
            <div className="gh-rmo-topics">
              {repo.topics.map(topic => <span key={topic}>{topic}</span>)}
            </div>
          )}

          <div className="gh-rmo-tabs">
            <button type="button" className={activeTab === 'readme' ? 'active' : ''} onClick={() => setActiveTab('readme')}>README</button>
            <button type="button" className={activeTab === 'details' ? 'active' : ''} onClick={() => setActiveTab('details')}>Dettagli</button>
          </div>

          {activeTab === 'readme' && (
            <div className="gh-rmo-body">
              {readme && <div className="gh-rmo-readme" dangerouslySetInnerHTML={{ __html: readme }} />}
              {!readme && <p className="gh-rmo-empty">{copy.readmeUnavailable}</p>}
            </div>
          )}

          {activeTab === 'details' && (
            <div className="gh-rmo-body">
              {hasRichDetails && (
                <>
                  {totalBytes > 0 && (
                    <section className="gh-rmo-section">
                      <h3>Linguaggi</h3>
                      <div className="gh-rmo-langbar">
                        {Object.entries(details.languages).map(([lang, bytes]) => (
                          <span
                            key={lang}
                            style={{ width: `${Math.max((bytes / totalBytes) * 100, 2)}%` }}
                            title={`${lang} ${((bytes / totalBytes) * 100).toFixed(1)}%`}
                          />
                        ))}
                      </div>
                      <div className="gh-rmo-langlegend">
                        {Object.entries(details.languages).map(([lang, bytes]) => (
                          <span key={lang}>{lang} {((bytes / totalBytes) * 100).toFixed(1)}%</span>
                        ))}
                      </div>
                    </section>
                  )}

                  {details.contents.length > 0 && (
                    <section className="gh-rmo-section">
                      <h3>File</h3>
                      <div className="gh-rmo-files">
                        {details.contents.map(item => (
                          <a key={item.sha || item.name} href={item.html_url} target="_blank" rel="noreferrer">
                            {item.type === 'dir' ? <GoFileDirectory /> : <GoFile />}
                            <span>{item.name}</span>
                          </a>
                        ))}
                      </div>
                    </section>
                  )}

                  {details.commits.length > 0 && (
                    <section className="gh-rmo-section">
                      <h3>Commit recenti</h3>
                      <div className="gh-rmo-commits">
                        {details.commits.map(commit => (
                          <a key={commit.sha} href={commit.html_url} target="_blank" rel="noreferrer">
                            <GoGitCommit />
                            <span>{commit.commit?.message?.split('\n')[0] || commit.sha}</span>
                            <small>{timeAgo(commit.commit?.author?.date, language)} · {commit.sha.slice(0, 7)}</small>
                          </a>
                        ))}
                      </div>
                    </section>
                  )}

                  {details.release && (
                    <section className="gh-rmo-section">
                      <h3>Ultima release</h3>
                      <a className="gh-rmo-release" href={details.release.html_url} target="_blank" rel="noreferrer">
                        <GoTag />
                        <span>{details.release.tag_name}</span>
                        <small>{timeAgo(details.release.published_at, language)}</small>
                      </a>
                    </section>
                  )}
                </>
              )}
              {!hasRichDetails && (
                <section className="gh-rmo-section">
                  <h3>{copy.basicDetails}</h3>
                  <div className="gh-rmo-basic-grid">
                    {basicDetails.map(([label, value]) => (
                      <span key={label}>
                        <small>{label}</small>
                        <strong>{value}</strong>
                      </span>
                    ))}
                  </div>
                  {!details && <p className="gh-rmo-note">{copy.detailsUnavailable}</p>}
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function GithubRepo({ language = 'it' }) {
  const common = getUiText(language).common;
  const copy = copyByLang[language] || copyByLang.it;
  const [categoryId, setCategoryId] = useState('vlt');
  const [reposByCategory, setReposByCategory] = useState({});
  const [loadingByCategory, setLoadingByCategory] = useState({});
  const [errorByCategory, setErrorByCategory] = useState({});
  const [search, setSearch] = useState('');
  const [activeRepo, setActiveRepo] = useState(null);
  const loadedCategoriesRef = useRef(new Set());

  const category = REPO_CATEGORIES.find(item => item.id === categoryId) || REPO_CATEGORIES[0];
  const repos = reposByCategory[categoryId] || [];
  const loading = loadingByCategory[categoryId];
  const error = errorByCategory[categoryId];

  useEffect(() => {
    if (loadedCategoriesRef.current.has(categoryId)) return;
    let cancelled = false;
    setLoadingByCategory(state => ({ ...state, [categoryId]: true }));
    setErrorByCategory(state => ({ ...state, [categoryId]: '' }));

    fetchStaticRepos(category)
      .then(data => {
        if (cancelled) return;
        loadedCategoriesRef.current.add(categoryId);
        setReposByCategory(state => ({ ...state, [categoryId]: data }));
      })
      .catch(err => {
        if (cancelled) return;
        setErrorByCategory(state => ({ ...state, [categoryId]: err.message || 'GitHub static data unavailable' }));
      })
      .finally(() => {
        if (!cancelled) setLoadingByCategory(state => ({ ...state, [categoryId]: false }));
      });

    return () => { cancelled = true; };
  }, [categoryId]);

  // Ricerca cross-vendor: se la categoria attiva non ha risultati per la query,
  // prova le altre categorie in ordine (caricandole al volo se serve) e passa
  // automaticamente alla prima che ha almeno un match, senza svuotare la ricerca.
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) return;
    let cancelled = false;

    const matchesQuery = (repo) => [
      repo.name, repo.fullName, repo.description, repo.language, ...repo.topics,
    ].join(' ').toLowerCase().includes(q);

    const ensureLoaded = async (id) => {
      if (loadedCategoriesRef.current.has(id)) return reposByCategory[id] || [];
      const cat = REPO_CATEGORIES.find(item => item.id === id);
      setLoadingByCategory(state => ({ ...state, [id]: true }));
      setErrorByCategory(state => ({ ...state, [id]: '' }));
      try {
        const data = await fetchStaticRepos(cat);
        loadedCategoriesRef.current.add(id);
        setReposByCategory(state => ({ ...state, [id]: data }));
        return data;
      } catch (err) {
        setErrorByCategory(state => ({ ...state, [id]: err.message || 'GitHub static data unavailable' }));
        return [];
      } finally {
        setLoadingByCategory(state => ({ ...state, [id]: false }));
      }
    };

    const timeout = setTimeout(async () => {
      const current = await ensureLoaded(categoryId);
      if (cancelled || current.some(matchesQuery)) return;

      for (const cat of REPO_CATEGORIES) {
        if (cat.id === categoryId) continue;
        const data = await ensureLoaded(cat.id);
        if (cancelled) return;
        if (data.some(matchesQuery)) {
          setCategoryId(cat.id);
          return;
        }
      }
    }, 300);

    return () => { cancelled = true; clearTimeout(timeout); };
  }, [search]);

  const filteredRepos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(repo => [
      repo.name,
      repo.fullName,
      repo.description,
      repo.language,
      ...repo.topics,
    ].join(' ').toLowerCase().includes(q));
  }, [repos, search]);

  const handleCategoryChange = (id) => {
    setCategoryId(id);
    setSearch('');
  };

  return (
    <div className="gh-repo-page" style={{ '--repo-color': category.color, '--repo-color-dim': `${category.color}20` }}>
      <div className="gh-repo-header">
        <div>
          <h2 className="gh-repo-title">
            {category.id === 'vlt'
              ? <VltCubeIcon className="page-head-icon" />
              : <SiGithub className="page-head-icon" style={{ color: category.color }} />
            }
            {copy.title}
          </h2>
          <p>{copy.subtitle}</p>
        </div>
      </div>

      <div className="tech-selector gh-repo-tech-selector">
        {REPO_CATEGORIES.map(({ id, label, Icon, color }) => (
          <button
            key={id}
            type="button"
            className={`tech-pill${categoryId === id ? ' active' : ''}`}
            style={categoryId === id ? { '--pill-color': color, '--pill-color-dim': `${color}28` } : {}}
            onClick={() => handleCategoryChange(id)}
          >
            {id === 'vlt'
              ? <VltCubeIcon className="tech-pill-icon" />
              : <Icon className="tech-pill-icon" style={{ color, opacity: categoryId === id ? 1 : 0.55 }} />
            }
            {label}
          </button>
        ))}
      </div>

      <div className="gh-repo-toolbar">
        <div className="gh-repo-search">
          <LuSearch />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={copy.search}
          />
        </div>
        <a
          className="gh-repo-source"
          href={category.source === 'user' ? `https://github.com/${GITHUB_USER}` : `https://github.com/search?q=${encodeURIComponent(category.query)}&type=repositories`}
          target="_blank"
          rel="noreferrer"
        >
          <SiGithub /> {copy.source}
        </a>
        <span className="gh-repo-count">{filteredRepos.length} {copy.results}</span>
      </div>

      {loading && <div className="gh-repo-state">{copy.loading || common.loading}</div>}
      {!loading && error && <div className="gh-repo-state gh-repo-state--error">{copy.error}</div>}
      {!loading && !error && filteredRepos.length === 0 && <div className="gh-repo-state">{copy.empty}</div>}

      {!loading && !error && filteredRepos.length > 0 && (
        <div className="gh-repo-grid">
          {filteredRepos.map(repo => (
            <RepoCard
              key={repo.id}
              repo={repo}
              color={category.color}
              copy={copy}
              language={language}
              onOpen={setActiveRepo}
              isVlt={categoryId === 'vlt'}
            />
          ))}
        </div>
      )}

      {activeRepo && (
        <GithubRepoModal
          repo={activeRepo}
          color={category.color}
          copy={copy}
          language={language}
          onClose={() => setActiveRepo(null)}
        />
      )}
    </div>
  );
}
