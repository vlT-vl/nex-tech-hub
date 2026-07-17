import { useState } from 'react';
import { SiProxmox, SiKubernetes } from 'react-icons/si';
import { GrVmware } from 'react-icons/gr';
import { LuCalendar, LuClock, LuRocket, LuHash } from 'react-icons/lu';
import { getUiText } from '../lib/uiText';
import DashModal from '../components/DashModal';
import { useData } from '../context/DataContext';

const TILE_META = {
  'PVE 9':     { Icon: SiProxmox,    color: '#e57000' },
  'PVE 8':     { Icon: SiProxmox,    color: '#e57000' },
  'ESXi 9':    { Icon: GrVmware,     color: '#56a668' },
  'ESXi 8':    { Icon: GrVmware,     color: '#56a668' },
  'vCenter 9': { Icon: GrVmware,     color: '#56a668' },
  'vCenter 8': { Icon: GrVmware,     color: '#56a668' },
  'K8s':       { Icon: SiKubernetes, color: '#326ce5' },
};

const DEFAULT_META = { Icon: SiProxmox, color: '#e57000' };

const getReleaseMajor = (item) => Number(item?.major) || 0;

const RelTile = ({ label, item, copy, onClick, variant = 'standard' }) => {
  const { Icon, color } = TILE_META[label] || DEFAULT_META;
  const isVmware = label.startsWith('ESXi') || label.startsWith('vCenter');
  return (
    <button
      className={`rel-tile rel-tile--${variant}`}
      style={variant === 'hero' ? { '--rel-hero-accent': color } : {}}
      onClick={() => item && onClick({ label, item, color })}
      disabled={!item}
    >
      <div className="rel-tile-icon">
        <Icon color={color} />
      </div>
      <div className="rel-tile-label">{label}</div>
      {item ? (
        <>
          <div className="rel-tile-ver">{item.rawVersion}</div>
          {!isVmware && <div className="rel-tile-name" style={{ color }}>{item.releaseName}</div>}
          <div className="rel-tile-date">{item.releaseDate}</div>
          {item.endOfSupport
            ? <div className="rel-tile-eos">{copy.eos}: {item.endOfSupport}</div>
            : item.buildNumber
              ? <div className="rel-tile-eos">Build {item.buildNumber}</div>
              : null
          }
        </>
      ) : (
        <div className="rel-tile-ver">—</div>
      )}
    </button>
  );
};

const ReleaseModal = ({ entry, copy, onClose }) => {
  if (!entry) return null;
  const { label, item, color } = entry;
  const { Icon } = TILE_META[label] || DEFAULT_META;
  const accent = color || '#5b5bd6';
  return (
    <DashModal open onClose={onClose} icon={Icon} title={label}>
      <div className="dm-rel-hero" style={{ '--dm-accent': accent }}>
        <div className="dm-rel-ver">{item.rawVersion}</div>
        <div className="dm-rel-name">{item.releaseName}</div>
      </div>
      <div className="dm-info-rows">
        <div className="dm-info-row">
          <LuCalendar className="dm-info-icon" />
          <span className="dm-info-label">{copy.releaseDate}</span>
          <span className="dm-info-val">{item.releaseDate || '—'}</span>
        </div>
        {item.endOfSupport && (
          <div className="dm-info-row">
            <LuClock className="dm-info-icon" />
            <span className="dm-info-label">{copy.eos}</span>
            <span className="dm-info-val">{item.endOfSupport}</span>
          </div>
        )}
        {item.buildNumber && (
          <div className="dm-info-row">
            <LuHash className="dm-info-icon" />
            <span className="dm-info-label">Build</span>
            <span className="dm-info-val">{item.buildNumber}</span>
          </div>
        )}
        {item.codename && item.codename !== item.rawVersion && (
          <div className="dm-info-row">
            <LuRocket className="dm-info-icon" />
            <span className="dm-info-label">{copy.codename}</span>
            <span className="dm-info-val">{item.codename}</span>
          </div>
        )}
      </div>
    </DashModal>
  );
};

const ReleaseWidget = ({ language = 'it' }) => {
  const { releases, techReleases } = useData();
  const [modal, setModal] = useState(null);
  const { common, dashboard: copy } = getUiText(language);

  const header = (
    <div className="wh">
      <LuRocket className="wh-icon" />
      <span className="wh-title">{copy.releaseTitle}</span>
    </div>
  );

  if (releases.loading || techReleases.loading) {
    return <div className="widget">{header}<div className="w-empty">{common.loading}</div></div>;
  }
  if (releases.error) {
    return <div className="widget">{header}<div className="w-empty">{copy.releaseLoadError}</div></div>;
  }

  const latest  = releases.data?.latest || {};
  const pve9    = latest.pve9;
  const pve8    = latest.pve8;
  const heroPve = pve9 || pve8;
  const heroLabel = heroPve ? `PVE ${getReleaseMajor(heroPve)}` : 'PVE 9';
  const prevPve   = heroPve === pve9 ? pve8 : null;
  const prevLabel = prevPve ? `PVE ${getReleaseMajor(prevPve)}` : 'PVE 8';

  const esxiAll    = techReleases.data?.vmware?.esxi    || [];
  const vcenterAll = techReleases.data?.vmware?.vcenter || [];

  const latestEsxi9    = esxiAll.find(r => r.branchVersion === '9.0')        || null;
  const latestEsxi8    = esxiAll.find(r => r.branchVersion === '8.0')        || null;
  const latestVcenter9 = vcenterAll.find(r => r.branchVersion === '9.0')     || null;
  const latestVcenter8 = vcenterAll.find(r => r.branchVersion === '8.0')     || null;
  const latestK8s      = techReleases.data?.kubernetes?.[0]                  || null;

  const allTiles = [
    { label: heroLabel,    item: heroPve        },
    { label: prevLabel,    item: prevPve        },
    { label: 'ESXi 9',    item: latestEsxi9    },
    { label: 'ESXi 8',    item: latestEsxi8    },
    { label: 'vCenter 9', item: latestVcenter9 },
    { label: 'vCenter 8', item: latestVcenter8 },
    { label: 'K8s',       item: latestK8s      },
  ];

  const sorted = [...allTiles].sort((a, b) => {
    const da = a.item ? new Date(a.item.releaseDate || 0) : new Date(0);
    const db = b.item ? new Date(b.item.releaseDate || 0) : new Date(0);
    return db - da;
  });

  const [hero, ...stdTiles] = sorted;

  return (
    <>
      <div className="widget">
        {header}
        <div className="rel-grid">
          <RelTile label={hero.label} item={hero.item} copy={copy} onClick={setModal} variant="hero" />
          {stdTiles.map(({ label, item }) => (
            <RelTile key={label} label={label} item={item} copy={copy} onClick={setModal} />
          ))}
        </div>
      </div>
      {modal && <ReleaseModal entry={modal} copy={copy} onClose={() => setModal(null)} />}
    </>
  );
};

export default ReleaseWidget;
