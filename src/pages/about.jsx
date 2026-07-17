import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FiFileText, FiX } from 'react-icons/fi';
import { SiReact, SiVite, SiReactrouter } from 'react-icons/si';
import { TbBrandFramer } from 'react-icons/tb';
import pkgjson from '../../package.json';
import VltLogo from '../components/VltLogo';
import NexthLogo from '../components/NexthLogo';
import { getUiText } from '../lib/uiText';

const STACK = [
  { label: 'React',        ver: __VER_REACT__,  Icon: SiReact,       color: '#61DAFB' },
  { label: 'Vite',         ver: __VER_VITE__,   Icon: SiVite,        color: '#646CFF' },
  { label: 'React Router', ver: __VER_ROUTER__, Icon: SiReactrouter, color: '#CA4245' },
  { label: 'react-icons',  ver: __VER_ICONS__,  Icon: TbBrandFramer, color: '#e535ab' },
];

function LicenseModal({ copy, onClose }) {
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header__icon"><FiFileText size={17} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="modal-header__name">{copy.licenseTitle}</div>
            <div className="modal-header__meta">{copy.licenseMeta}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label={copy.closeLabel}>
            <FiX size={13} />
          </button>
        </div>
        <div className="modal-body">
          <pre className="modal-pre">{copy.licenseText}</pre>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function About({ darkMode = false, language = 'it' }) {
  const [licenseOpen, setLicenseOpen] = useState(false);
  const copy = getUiText(language).about;

  const INFO = [
    { label: copy.info.version,       value: pkgjson.version },
    { label: copy.info.build,         value: pkgjson.build },
    { label: copy.info.updated,       value: pkgjson.updated },
    { label: copy.info.initialBuild,  value: pkgjson.ibuild },
    { label: copy.info.license,       value: copy.info.licenseValue, action: () => setLicenseOpen(true), Icon: FiFileText },
    { label: copy.info.platform,      value: 'GitHub Pages' },
  ];

  return (
    <div className="about">
      {/* hero */}
      <div className="about-hero">
        <div className="about-hero__icon">
          <NexthLogo iconSize={48} variant="full" />
        </div>
        <div className="about-hero__desc">
          <span className="about-hero__desc-text">{copy.description}</span>
          <span className="about-hero__badge-line">
            <span className="about-hero__badge">vSphere · Proxmox · Kubernetes · Linux</span>
            {copy.descriptionSuffix && <span>{copy.descriptionSuffix}</span>}
          </span>
        </div>
        <div className="about-info-grid">
          {INFO.map(({ label, value, action, Icon }) =>
            action ? (
              <div
                key={label}
                className="about-info-cell about-info-cell--link"
                onClick={action}
                role="button"
                tabIndex={0}
              >
                <div className="about-info-cell__label">{label}</div>
                <div className="about-info-cell__value about-info-cell__value--link">
                  {value}{Icon && <Icon size={10} style={{ verticalAlign: 'middle', marginLeft: 3 }} />}
                </div>
              </div>
            ) : (
              <div key={label} className="about-info-cell">
                <div className="about-info-cell__label">{label}</div>
                <div className="about-info-cell__value">{value}</div>
              </div>
            )
          )}
        </div>
      </div>

      {/* stack */}
      <div className="about-card">
        <div className="about-card__title">{copy.builtWith}</div>
        <div className="about-stack-grid">
          {STACK.map(({ label, ver, Icon, color }) => (
            <div key={label} className="about-stack-item">
              <Icon className="about-stack-item__icon" style={{ color }} aria-hidden="true" />
              <div>
                <div className="about-stack-item__label">{label}</div>
                <div className="about-stack-item__ver">{ver}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* legal */}
      <div className="about-card">
        <div className="about-card__title">{copy.legalTitle}</div>
        <ul className="about-legal">
          {copy.legal.map((text, i) => <li key={i}>{text}</li>)}
        </ul>
      </div>

      {/* footer */}
      <div className="about-footer">
        <a
          className="about-footer__vlt about-footer__vlt-link"
          href="https://lorenzoveronesi.it/"
          target="_blank"
          rel="noreferrer"
          aria-label="lorenzoveronesi.it"
        >
          <VltLogo size="1.6rem" staticExpanded />
        </a>
        <div className="about-footer__copy">{pkgjson.author} — {copy.rights}</div>
      </div>

      {licenseOpen && <LicenseModal copy={copy} onClose={() => setLicenseOpen(false)} />}
    </div>
  );
}
