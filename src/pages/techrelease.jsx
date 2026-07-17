import { useState } from 'react';
import {
  SiProxmox, SiKubernetes,
  SiUbuntu, SiDebian, SiRedhat, SiRockylinux, SiFedora,
} from 'react-icons/si';
import { GrVmware } from 'react-icons/gr';
import { TbVersions } from 'react-icons/tb';
import { getUiText } from '../lib/uiText';
import { useData } from '../context/DataContext';

const VMWARE_BRANCHES = ['6.0', '6.5', '6.7', '7.0', '8.0', '9.0'];

const TECH_LIST = [
  { id: 'proxmox',    label: 'Proxmox',    Icon: SiProxmox,    color: '#e57000' },
  { id: 'vmware',     label: 'VMware',     Icon: GrVmware,     color: '#56a668' },
  { id: 'kubernetes', label: 'Kubernetes', Icon: SiKubernetes, color: '#326ce5' },
  { id: 'ubuntu',     label: 'Ubuntu',     Icon: SiUbuntu,     color: '#e95420' },
  { id: 'debian',     label: 'Debian',     Icon: SiDebian,     color: '#a81d33' },
  { id: 'rhel',       label: 'RHEL',       Icon: SiRedhat,     color: '#cc0000' },
  { id: 'rocky',      label: 'Rocky',      Icon: SiRockylinux, color: '#10b981' },
  { id: 'fedora',     label: 'Fedora',     Icon: SiFedora,     color: '#3c6eb4' },
];

const LINUX_IDS = new Set(['ubuntu', 'debian', 'rhel', 'rocky', 'fedora']);

export default function TechRelease({ language = 'it' }) {
  const { releases, techReleases } = useData();
  const copy = getUiText(language).releases;
  const common = getUiText(language).common;

  const [tech,         setTech]         = useState('proxmox');
  const [subProduct,   setSubProduct]   = useState('pve');
  const [vmwareBranch, setVmwareBranch] = useState('all');
  const [version,      setVersion]      = useState('All');
  const [search,       setSearch]       = useState('');

  const handleTechChange = (id) => {
    setTech(id);
    setVersion('All');
    setSearch('');
    if (id === 'proxmox') setSubProduct('pve');
    if (id === 'vmware')  { setSubProduct('esxi'); setVmwareBranch('all'); }
  };

  const getData = () => {
    if (tech === 'proxmox')    return releases.data?.[subProduct] || [];
    if (tech === 'vmware')     return techReleases.data?.vmware?.[subProduct] || [];
    if (tech === 'kubernetes') return techReleases.data?.kubernetes || [];
    if (LINUX_IDS.has(tech))   return techReleases.data?.linux?.[tech] || [];
    return [];
  };

  const rawData = getData();

  const afterBranch = (tech === 'vmware' && vmwareBranch !== 'all')
    ? rawData.filter(r => r.branchVersion === vmwareBranch)
    : rawData;

  const availableVersions = [...new Set(
    rawData.map(r => r.major).filter(Boolean)
  )].sort((a, b) => Number(b) - Number(a));

  const afterVersion = version === 'All'
    ? afterBranch
    : afterBranch.filter(r => r.major === version);

  const filteredData = afterVersion.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.rawVersion?.toLowerCase().includes(s)  ||
      r.releaseName?.toLowerCase().includes(s) ||
      r.codename?.toLowerCase().includes(s)    ||
      r.releaseDate?.toLowerCase().includes(s) ||
      r.endOfSupport?.toLowerCase().includes(s)||
      String(r.buildNumber ?? '').includes(s)  ||
      r.tipo?.toLowerCase().includes(s)
    );
  });

  const isVmware  = tech === 'vmware';
  const isEsxi    = isVmware && subProduct === 'esxi';
  const isLoading = tech === 'proxmox' ? releases.loading : techReleases.loading;

  const transKey = `${tech}-${subProduct}-${vmwareBranch}-${version}-${search.trim()}`;
  const currentTech = TECH_LIST.find(t => t.id === tech);

  if (isLoading) {
    return (
      <div className="tech-release-page">
        <div className="w-empty">{common.loading}</div>
      </div>
    );
  }

  return (
    <div className="tech-release-page" style={{ '--pill-color': currentTech?.color || '#5b5bd6' }}>
      <div className="tech-release-header">
        <h2 className="tech-release-title">
          {currentTech
            ? <currentTech.Icon className="page-head-icon" style={{ color: currentTech.color }} />
            : <TbVersions className="page-head-icon" />
          }
          {copy.title}
        </h2>
      </div>

      {/* technology pills */}
      <div className="tech-selector">
        {TECH_LIST.map(({ id, label, Icon, color }) => (
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

      {/* sub-selectors */}
      <div className="tech-release-selectors">
        {tech === 'proxmox' && (
          <select
            value={subProduct}
            onChange={e => { setSubProduct(e.target.value); setVersion('All'); }}
          >
            <option value="pve">PVE</option>
            <option value="pbs">PBS</option>
            <option value="pdm">PDM</option>
          </select>
        )}

        {isVmware && (
          <>
            <select
              value={subProduct}
              onChange={e => { setSubProduct(e.target.value); setVersion('All'); setVmwareBranch('all'); }}
            >
              <option value="esxi">ESXi</option>
              <option value="vcenter">vCenter</option>
            </select>
            <select value={vmwareBranch} onChange={e => setVmwareBranch(e.target.value)}>
              <option value="all">{copy.allBranches}</option>
              {VMWARE_BRANCHES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </>
        )}

        {!isVmware && (
          <select value={version} onChange={e => setVersion(e.target.value)}>
            <option value="All">{copy.allVersions}</option>
            {availableVersions.map(ver => <option key={ver} value={ver}>{ver}</option>)}
          </select>
        )}

        <input
          type="text"
          placeholder={copy.filter}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* table */}
      <div key={transKey} className="tech-release-table-transition">
        <table className="tech-release-table">
          <thead>
            <tr>
              <th>{copy.releaseName}</th>
              <th>{copy.version}</th>
              <th>{isVmware ? copy.buildNumber : copy.codename}</th>
              <th>{copy.releaseDate}</th>
              <th>{isEsxi ? copy.type : copy.eos}</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, idx) => (
              <tr key={`${item.rawVersion}-${idx}`}>
                <td>{item.releaseName || '—'}</td>
                <td>{item.rawVersion  || '—'}</td>
                <td>{isVmware ? (item.buildNumber ?? '—') : (item.codename || '—')}</td>
                <td>{item.releaseDate  || '—'}</td>
                <td>{isEsxi ? (item.tipo || '—') : (item.endOfSupport || '—')}</td>
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={5} className="tech-release-empty">—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
