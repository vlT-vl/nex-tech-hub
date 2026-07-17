import { useEffect, useMemo, useRef, useState } from 'react';
import isoIcon from '../../res/iso-icon.png';
import { SiProxmox, SiUbuntu, SiDebian, SiRockylinux, SiKubernetes, SiRedhat, SiFedora } from 'react-icons/si';
import { LuDownload, LuCalendar, LuWeight, LuShieldCheck, LuHardDriveDownload, LuSearch, LuX } from 'react-icons/lu';
import { VscPackage } from 'react-icons/vsc';
import { getUiText } from '../lib/uiText';
import DashModal from '../components/DashModal';
import { useData } from '../context/DataContext';

const DL_TECH_LIST = [
  { id: 'proxmox',    label: 'Proxmox',    Icon: SiProxmox,    color: '#e57000' },
  { id: 'ubuntu',     label: 'Ubuntu',     Icon: SiUbuntu,     color: '#e95420' },
  { id: 'debian',     label: 'Debian',     Icon: SiDebian,     color: '#a81d33' },
  { id: 'rhel',       label: 'RHEL',       Icon: SiRedhat,     color: '#cc0000' },
  { id: 'rocky',      label: 'Rocky',      Icon: SiRockylinux, color: '#10b981' },
  { id: 'fedora',     label: 'Fedora',     Icon: SiFedora,     color: '#3c6eb4' },
  { id: 'kubernetes', label: 'Kubernetes', Icon: SiKubernetes, color: '#326ce5' },
];

const PROXMOX_TABS = { pve: 'PVE', pbs: 'PBS', pdm: 'PDM' };
const PROXMOX_CONTEXTS = Object.entries(PROXMOX_TABS).map(([id, label]) => ({
  id,
  label: `Proxmox ${label}`,
  tech: 'proxmox',
}));
const GLOBAL_DOWNLOAD_CONTEXTS = [
  ...PROXMOX_CONTEXTS,
  ...DL_TECH_LIST.filter(({ id }) => id !== 'proxmox').map(({ id, label }) => ({ id, label, tech: id })),
];

const formatDate = (dateString, language) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
};

const DlIcon = ({ item, className }) =>
  item.tipo === 'Binary'
    ? <VscPackage className={className} style={{ color: '#326ce5' }} />
    : <img src={isoIcon} alt="ISO" className={className} />;

const DownloadModal = ({ item, copy, language, onClose }) => (
  <DashModal open onClose={onClose} icon={item.tipo === 'Binary' ? VscPackage : LuHardDriveDownload} title={item.nome}>
    <div className="dm-dl-hero">
      <DlIcon item={item} className="dm-dl-iso" />
      <div>
        <div className="dm-dl-name">{item.nome}</div>
        {item.versione && <div className="dm-dl-ver">{item.versione}</div>}
      </div>
    </div>
    <div className="dm-info-rows">
      <div className="dm-info-row">
        <LuCalendar className="dm-info-icon" />
        <span className="dm-info-label">{copy.lastUpdated}</span>
        <span className="dm-info-val">{formatDate(item.data_ultimo_aggiornamento, language)}</span>
      </div>
      <div className="dm-info-row">
        <LuWeight className="dm-info-icon" />
        <span className="dm-info-label">{copy.fileSize}</span>
        <span className="dm-info-val">{item.dimensione_file || '—'}</span>
      </div>
      {item.sha256sum && (
        <div className="dm-info-row dm-info-row--wrap">
          <LuShieldCheck className="dm-info-icon" />
          <span className="dm-info-label">SHA256</span>
          <span className="dm-info-val dm-info-val--mono">{item.sha256sum}</span>
        </div>
      )}
    </div>
    <a href={item.link} target="_blank" rel="noreferrer" className="dm-read-btn">
      {copy.download} <LuDownload className="dm-read-btn-icon" />
    </a>
  </DashModal>
);

const DlCard = ({ item, copy, language, onClick }) => (
  <div className="dl-card" onClick={() => onClick(item)} style={{ cursor: 'pointer' }}>
    <DlIcon item={item} className="dl-card-icon" />
    <div className="dl-card-body">
      <div className="dl-card-name">{item.nome}</div>
      <div className="dl-card-meta">
        {item.__dlContext && <span className="dl-meta-chip dl-meta-chip--context">{item.__dlContext}</span>}
        <span className="dl-meta-chip"><strong>{copy.version}:</strong> {item.versione || '—'}</span>
        <span className="dl-meta-chip"><strong>{copy.fileSize}:</strong> {item.dimensione_file || '—'}</span>
        <span className="dl-meta-chip"><strong>{copy.lastUpdated}:</strong> {formatDate(item.data_ultimo_aggiornamento, language)}</span>
      </div>
      {item.sha256sum && <div className="dl-card-sha">SHA256 · {item.sha256sum}</div>}
    </div>
    <a href={item.link} target="_blank" rel="noreferrer" className="dl-btn" onClick={(e) => e.stopPropagation()}>
      {copy.download}
    </a>
  </div>
);

const DownloadWidget = ({ language = 'it' }) => {
  const { downloads } = useData();
  const [tech,            setTech]            = useState('proxmox');
  const [selectedProduct, setSelectedProduct] = useState('pve');
  const [modal,           setModal]           = useState(null);
  const [downloadSearch,  setDownloadSearch]  = useState('');
  const searchInputRef                       = useRef(null);
  const { common, dashboard: copy } = getUiText(language);
  const activeTechCfg = DL_TECH_LIST.find((item) => item.id === tech);

  const header = (
    <div className="wh">
      <LuDownload className="wh-icon" />
      <span className="wh-title">{copy.downloadsTitle}</span>
    </div>
  );

  const handleTechChange = (id) => {
    setTech(id);
    if (id === 'proxmox') setSelectedProduct('pve');
    setModal(null);
  };

  const handleProductChange = (key) => {
    setSelectedProduct(key);
  };

  const handleClearSearch = () => {
    setDownloadSearch('');
  };

  // For proxmox: PVE/PBS/PDM sub-keyed. For others: key = tech id.
  const currentData = tech === 'proxmox'
    ? (downloads.data?.[selectedProduct] || [])
    : (downloads.data?.[tech] || []);

  const globalData = useMemo(() => {
    const data = downloads.data || {};
    return GLOBAL_DOWNLOAD_CONTEXTS.flatMap(({ id, label, tech: contextTech }) =>
      (data[id] || []).map((item) => ({
        ...item,
        __dlContext: label,
        __dlScope: `${contextTech}-${id}`,
        __dlTech: contextTech,
        __dlProduct: contextTech === 'proxmox' ? id : null,
      }))
    );
  }, [downloads.data]);

  const filteredData = useMemo(() => {
    const q = downloadSearch.trim().toLowerCase();
    if (!q) return currentData;
    return globalData.filter((item) => [
      item.__dlContext,
      item.nome,
      item.versione,
      item.dimensione_file,
      item.data_ultimo_aggiornamento,
      item.sha256sum,
      item.link,
      item.tipo,
    ].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [currentData, downloadSearch, globalData]);

  const searchActive = !!downloadSearch.trim();

  useEffect(() => {
    if (!searchActive || !filteredData.length) return;
    const first = filteredData[0];
    if (first.__dlTech && first.__dlTech !== tech) {
      setTech(first.__dlTech);
    }
    if (first.__dlTech === 'proxmox' && first.__dlProduct && first.__dlProduct !== selectedProduct) {
      setSelectedProduct(first.__dlProduct);
    }
  }, [filteredData, searchActive, selectedProduct, tech]);

  if (downloads.loading) return <div className="widget">{header}<div className="w-empty">{common.loading}</div></div>;
  if (downloads.error)   return <div className="widget">{header}<div className="w-empty">{copy.downloadsLoadError}</div></div>;

  return (
    <>
      <div className="widget download-widget">
        {header}

        <div
          className={`dl-search-wrap${searchActive ? ' is-active' : ''}`}
          style={{ '--dl-search-accent': activeTechCfg?.color || '#5b5bd6' }}
        >
          <div className="dl-search-panel">
            <input
              ref={searchInputRef}
              type="text"
              className="dl-search-input"
              placeholder="Cerca download..."
              value={downloadSearch}
              onChange={e => setDownloadSearch(e.target.value)}
              aria-label="Cerca download"
              spellCheck={false}
            />
            {searchActive && (
              <button className="dl-search-clear" type="button" onClick={handleClearSearch} aria-label="Cancella ricerca">
                <LuX />
              </button>
            )}
            <button
              className="dl-search-trigger"
              type="button"
              onClick={() => searchInputRef.current?.focus()}
              aria-label="Apri ricerca download"
            >
              <LuSearch />
            </button>
          </div>
        </div>

        {/* tech selector */}
        <div className="tech-selector dl-tech-selector">
          {DL_TECH_LIST.map(({ id, label, Icon, color }) => (
            <button
              key={id}
              type="button"
              className={`tech-pill${tech === id ? ' active' : ''}`}
              style={tech === id ? { '--pill-color': color, '--pill-color-dim': `${color}28` } : {}}
              onClick={() => handleTechChange(id)}
            >
              <Icon className="tech-pill-icon" style={{ color, opacity: tech === id ? 1 : 0.55 }} />
              {label}
            </button>
          ))}
        </div>

        {/* proxmox sub-tabs */}
        {tech === 'proxmox' && (
          <div className="dl-tabs">
            {Object.entries(PROXMOX_TABS).map(([key, label]) => (
              <button
                key={key}
                className={`dl-tab${selectedProduct === key ? ' active' : ''}`}
                onClick={() => handleProductChange(key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* download list */}
        {filteredData.length > 0 ? (
          <div className="dl-list">
            {filteredData.map((item, i) => (
              <DlCard
                key={`${item.__dlScope || tech}-${item.nome}-${i}`}
                item={item} copy={copy} language={language} onClick={setModal}
              />
            ))}
          </div>
        ) : (
          <div className="w-empty">{copy.noDownloads ?? copy.noDownloadPve}</div>
        )}
      </div>
      {modal && <DownloadModal item={modal} copy={copy} language={language} onClose={() => setModal(null)} />}
    </>
  );
};

export default DownloadWidget;
