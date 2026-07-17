import { useEffect, useMemo, useRef, useState } from 'react';
import { SiProxmox, SiKubernetes } from 'react-icons/si';
import { GrVmware } from 'react-icons/gr';
import { FaLinux } from 'react-icons/fa';
import { LuShieldAlert, LuLink, LuCalendar, LuPackage, LuSearch, LuX } from 'react-icons/lu';
import { getUiText } from '../lib/uiText';
import DashModal from '../components/DashModal';
import { useData } from '../context/DataContext';

const SEV_COLOR = {
  CRITICAL: '#dc2626',
  HIGH:     '#f97316',
  MEDIUM:   '#d97706',
  LOW:      '#15803d',
};

const CVE_TECH_LIST = [
  { id: 'proxmox',    label: 'Proxmox',    Icon: SiProxmox,    color: '#e57000', subFilters: ['PVE', 'PBS', 'PDM'] },
  { id: 'vmware',     label: 'VMware',     Icon: GrVmware,     color: '#56a668', subFilters: ['ESXi', 'vCenter']   },
  { id: 'kubernetes', label: 'Kubernetes', Icon: SiKubernetes, color: '#326ce5', subFilters: []                     },
  { id: 'linux',      label: 'Linux',      Icon: FaLinux,      color: '#f9c800', subFilters: ['Kernel', 'Ubuntu', 'Debian', 'RHEL', 'Fedora'] },
];

const CveModal = ({ cve, copy, language, onClose }) => {
  const color = SEV_COLOR[cve.severity] || '#6b7280';
  return (
    <DashModal open onClose={onClose} icon={LuShieldAlert} title={cve.id}>
      <div className="dm-cve-hero">
        <span className={`sev ${cve.severity !== 'N/A' ? cve.severity.toLowerCase() : ''} dm-cve-sev`}>
          {cve.severity}
        </span>
        <span className="dm-cve-score" style={{ color }}>CVSS {cve.score}</span>
      </div>
      <div className="dm-info-rows">
        <div className="dm-info-row">
          <LuPackage className="dm-info-icon" />
          <span className="dm-info-label">{copy.product}</span>
          <span className="dm-info-val">{cve.productLabel}</span>
        </div>
        <div className="dm-info-row">
          <LuCalendar className="dm-info-icon" />
          <span className="dm-info-label">{copy.date}</span>
          <span className="dm-info-val">
            {cve.published.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US')}
          </span>
        </div>
      </div>
      <a href={cve.link} target="_blank" rel="noopener noreferrer" className="dm-read-btn">
        NVD <LuLink className="dm-read-btn-icon" />
      </a>
    </DashModal>
  );
};

const CVEWidget = ({ language = 'it' }) => {
  const { cves, requestCveTech }        = useData();
  const [selectedTech, setSelectedTech] = useState('proxmox');
  const [subFilter,    setSubFilter]    = useState('All');
  const [sevFilter,    setSevFilter]    = useState(null);
  const [modal,        setModal]        = useState(null);
  const [cveSearch,    setCveSearch]    = useState('');
  const searchInputRef                  = useRef(null);
  const { dashboard: copy }             = getUiText(language);

  const techCfg = CVE_TECH_LIST.find((t) => t.id === selectedTech);

  useEffect(() => {
    requestCveTech(selectedTech);
  }, [selectedTech, requestCveTech]);

  // When search is active, request all vendors so we can scan them
  useEffect(() => {
    if (!cveSearch.trim()) return;
    CVE_TECH_LIST.forEach(t => requestCveTech(t.id));
  }, [cveSearch, requestCveTech]);

  const handleTechChange = (id) => {
    setSelectedTech(id);
    setSubFilter('All');
    setSevFilter(null);
    setModal(null);
  };

  const handleClearSearch = () => {
    setCveSearch('');
    setSevFilter(null);
  };

  // Cross-vendor search: find which tech contains the query
  const searchResult = useMemo(() => {
    const q = cveSearch.trim().toUpperCase();
    if (!q) return null;
    for (const tech of CVE_TECH_LIST) {
      const techData = cves[tech.id]?.data ?? [];
      const matches = techData.filter(c =>
        c.id.toUpperCase().includes(q) ||
        (c.productLabel || '').toLowerCase().includes(q.toLowerCase())
      );
      if (matches.length > 0) return { techId: tech.id, matches };
    }
    return { techId: null, matches: [] };
  }, [cveSearch, cves]);

  // Auto-switch to the vendor that contains the search result
  useEffect(() => {
    if (searchResult?.techId && searchResult.techId !== selectedTech) {
      setSelectedTech(searchResult.techId);
      setSubFilter('All');
      setSevFilter(null);
    }
  }, [searchResult?.techId]);

  const techState = cves[selectedTech];
  const data      = techState?.data ?? [];

  const productFiltered = useMemo(() => {
    if (subFilter === 'All') return data;
    return data.filter((c) => c.products.includes(subFilter));
  }, [data, subFilter]);

  const filtered = useMemo(() => {
    let result = sevFilter
      ? productFiltered.filter(c => c.severity === sevFilter)
      : productFiltered;
    if (cveSearch.trim()) {
      const q = cveSearch.trim().toUpperCase();
      result = result.filter(c =>
        c.id.toUpperCase().includes(q) ||
        (c.productLabel || '').toLowerCase().includes(q.toLowerCase())
      );
    }
    return result;
  }, [productFiltered, sevFilter, cveSearch]);

  const summary = useMemo(() => ({
    CRITICAL: productFiltered.filter((c) => c.severity === 'CRITICAL').length,
    HIGH:     productFiltered.filter((c) => c.severity === 'HIGH').length,
    MEDIUM:   productFiltered.filter((c) => c.severity === 'MEDIUM').length,
    LOW:      productFiltered.filter((c) => c.severity === 'LOW').length,
  }), [productFiltered]);

  const searchActive = !!cveSearch.trim();
  const searchLoading = searchActive && CVE_TECH_LIST.some(t => cves[t.id]?.loading);
  const activeVendorCfg = CVE_TECH_LIST.find(t => t.id === selectedTech);

  return (
    <>
      <div className="widget cve-widget">
        <div className="wh">
          <LuShieldAlert className="wh-icon" />
          <span className="wh-title">{copy.cveTitle}</span>
        </div>

        {/* cross-vendor search */}
        <div
          className={`cve-search-wrap${searchActive ? ' is-active' : ''}`}
          style={{ '--cve-search-accent': activeVendorCfg?.color || '#5b5bd6' }}
        >
          <div className="cve-search-panel">
            <input
              ref={searchInputRef}
              type="text"
              className="cve-search-input"
              placeholder="Cerca CVE-ID o prodotto..."
              value={cveSearch}
              onChange={e => { setCveSearch(e.target.value); setSevFilter(null); }}
              aria-label="Cerca CVE-ID o prodotto"
              spellCheck={false}
            />
            {searchActive && (
              <button className="cve-search-clear" type="button" onClick={handleClearSearch} aria-label="Cancella ricerca">
                <LuX />
              </button>
            )}
            <button
              className="cve-search-trigger"
              type="button"
              onClick={() => searchInputRef.current?.focus()}
              aria-label="Apri ricerca CVE"
            >
              <LuSearch />
            </button>
          </div>

          {searchActive && !searchLoading && searchResult && (
            <div className={`cve-search-banner${searchResult.techId ? ' found' : ' notfound'}`}>
              {searchResult.techId ? (
                <>
                  <span
                    className="cve-search-vendor-pill"
                    style={{ background: `${activeVendorCfg?.color}22`, color: activeVendorCfg?.color, borderColor: `${activeVendorCfg?.color}44` }}
                  >
                    {activeVendorCfg?.label}
                  </span>
                  <span>{searchResult.matches.length} risultat{searchResult.matches.length === 1 ? 'o' : 'i'}</span>
                </>
              ) : (
                <span>nessun CVE trovato</span>
              )}
            </div>
          )}
          {searchActive && searchLoading && (
            <div className="cve-search-banner loading">ricerca in corso...</div>
          )}
        </div>

        {/* tech switcher */}
        <div className="tech-selector dl-tech-selector">
          {CVE_TECH_LIST.map(({ id, label, Icon, color }) => (
            <button
              key={id}
              type="button"
              className={`tech-pill${selectedTech === id ? ' active' : ''}`}
              style={selectedTech === id ? { '--pill-color': color, '--pill-color-dim': `${color}28` } : {}}
              onClick={() => { handleTechChange(id); setCveSearch(''); }}
            >
              <Icon className="tech-pill-icon" style={{ color, opacity: selectedTech === id ? 1 : 0.55 }} />
              {label}
            </button>
          ))}
        </div>

        {techState?.loading ? (
          <div className="w-empty">{copy.cveLoading}</div>
        ) : techState?.error ? (
          <div className="w-empty">{copy.cveError}</div>
        ) : (
          <>
            <div className="cve-stats">
              {[
                { key: 'CRITICAL', label: copy.sevCritical, cls: 'critical' },
                { key: 'HIGH',     label: copy.sevHigh,     cls: 'high'     },
                { key: 'MEDIUM',   label: copy.sevMedium,   cls: 'medium'   },
                { key: 'LOW',      label: copy.sevLow,      cls: 'low'      },
              ].map(({ key, label, cls }) => (
                <button
                  key={key}
                  type="button"
                  className={`cve-stat cve-stat--${cls}${sevFilter === key ? ' cve-stat--active' : ''}`}
                  onClick={() => setSevFilter(sevFilter === key ? null : key)}
                >
                  <span className="cve-stat-count">{summary[key]}</span>
                  <span className="cve-stat-label">{label}</span>
                </button>
              ))}
            </div>

            {techCfg?.subFilters.length > 0 && (
              <div className="cve-filter-row">
                {['All', ...techCfg.subFilters].map((f) => (
                  <button
                    key={f}
                    className={`cve-filter-btn${subFilter === f ? ' active' : ''}`}
                    onClick={() => setSubFilter(f)}
                  >
                    {f === 'All' ? copy.all : f}
                  </button>
                ))}
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="w-empty">{copy.noCve}</div>
            ) : (
              <div className="cve-scroll">
                <table className="cve-table">
                  <thead>
                    <tr>
                      <th>CVE</th>
                      <th>{copy.product}</th>
                      <th>{copy.severity}</th>
                      <th>{copy.score}</th>
                      <th>{copy.date}</th>
                      <th>{copy.link}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((cve) => (
                      <tr key={cve.id} className="cve-row-clickable" onClick={() => setModal(cve)}>
                        <td>{cve.id}</td>
                        <td>{cve.productLabel}</td>
                        <td><span className={`sev ${cve.severity !== 'N/A' ? cve.severity.toLowerCase() : ''}`}>{cve.severity}</span></td>
                        <td>{cve.score}</td>
                        <td>{cve.published.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US')}</td>
                        <td><span className="cve-row-detail">→</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
      {modal && <CveModal cve={modal} copy={copy} language={language} onClose={() => setModal(null)} />}
    </>
  );
};

export default CVEWidget;
