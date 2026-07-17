import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { SiProxmox, SiMacos, SiLinux } from 'react-icons/si';
import { GrVmware, GrVmMaintenance } from 'react-icons/gr';
import { FaTimesCircle } from 'react-icons/fa';
import { IoCloudDownloadSharp } from 'react-icons/io5';
import { DiWindows } from 'react-icons/di';
import { LuFileJson } from 'react-icons/lu';
import pmxtoolsUiLogo from '../../res/pmxtools-ui.png';
import { getUiText } from '../lib/uiText';
import ProxmoxInfraDash from './proxmoxinfradash';
import VMwareInfraDash from './vmwareinfradash';
import VmwToolsConverter from './vmwtools';

export default function Insights({ language = 'it', infraSettings = {} }) {
  const showProxmox = infraSettings.infraProxmox !== false;
  const showVmware  = infraSettings.infraVmware  !== false;
  const showPmxtoolsCli = infraSettings.infraPmxtoolsCli === true;
  const showPmxtoolsDownload = infraSettings.infraPmxtoolsDownload !== false;
  const showRvtoolsConverter = infraSettings.infraRvtoolsConverter !== false;

  const [activeTech, setActiveTech] = useState('proxmox');

  useEffect(() => {
    if (!showProxmox && showVmware)  setActiveTech('vmware');
    if (!showVmware  && showProxmox) setActiveTech('proxmox');
  }, [showProxmox, showVmware]);

  const [pmxData, setPmxData] = useState(null);
  const [pmxLoading, setPmxLoading] = useState(false);
  const [pmxError, setPmxError] = useState(null);
  const [pmxRelease, setPmxRelease] = useState(null);
  const [pmxReleaseLoading, setPmxReleaseLoading] = useState(true);
  const [pmxReleaseError, setPmxReleaseError] = useState(null);

  const [pmxUiRelease, setPmxUiRelease] = useState(null);
  const [pmxUiReleaseLoading, setPmxUiReleaseLoading] = useState(true);
  const [pmxUiReleaseError, setPmxUiReleaseError] = useState(null);

  const [vmwData, setVmwData] = useState(null);
  const [vmwLoading, setVmwLoading] = useState(false);
  const [vmwError, setVmwError] = useState(null);
  const [hasConvertedReport, setHasConvertedReport] = useState(
    () => !!localStorage.getItem('vmwtoolsReport')
  );

  const { common, infrastructure: copy } = getUiText(language);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch('https://api.github.com/repos/vlT-vl/pmxtools/releases/latest');
        if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
        const release = await res.json();
        const assets = Array.isArray(release.assets) ? release.assets : [];
        const findAsset = (patterns) =>
          assets.find((a) => {
            const n = String(a.name || '').toLowerCase();
            return patterns.every((p) => n.includes(p));
          }) || null;
        if (ignore) return;
        setPmxRelease({
          name: release.name || release.tag_name || 'N/D',
          htmlUrl: release.html_url || 'https://github.com/vlT-vl/pmxtools/releases/latest',
          macosArm64: findAsset(['darwin', 'arm64']) || findAsset(['macos', 'arm64']),
          macosAmd64: findAsset(['darwin', 'amd64']) || findAsset(['macos', 'amd64']) || findAsset(['darwin', 'x86_64']),
          linuxAmd64: findAsset(['linux', 'amd64']) || findAsset(['linux', 'x86_64']),
          windowsAmd64: findAsset(['windows', 'amd64']) || findAsset(['windows', 'x86_64']) || findAsset(['win', 'amd64']),
        });
      } catch (err) {
        if (ignore) return;
        setPmxRelease(null);
        setPmxReleaseError(err.message || copy?.releaseError || 'Errore nel recupero release');
      } finally {
        if (!ignore) setPmxReleaseLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch('https://api.github.com/repos/vlT-vl/pmxtools-ui/releases/latest');
        if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
        const release = await res.json();
        const assets = Array.isArray(release.assets) ? release.assets : [];
        const findAsset = (patterns) =>
          assets.find((a) => {
            const n = String(a.name || '').toLowerCase();
            return patterns.every((p) => n.includes(p));
          }) || null;
        if (ignore) return;
        setPmxUiRelease({
          name: release.name || release.tag_name || 'N/D',
          htmlUrl: release.html_url || 'https://github.com/vlT-vl/pmxtools-ui/releases/latest',
          macosArm64: findAsset(['darwin', 'arm64']) || findAsset(['macos', 'arm64']),
          macosAmd64: findAsset(['darwin', 'amd64']) || findAsset(['macos', 'amd64']) || findAsset(['darwin', 'x86_64']),
          linuxAmd64: findAsset(['linux', 'amd64']) || findAsset(['linux', 'x86_64']),
          linuxArm64: findAsset(['linux', 'arm64']),
          windowsAmd64: findAsset(['windows', 'amd64']) || findAsset(['windows', 'x86_64']) || findAsset(['win', 'amd64']),
        });
      } catch (err) {
        if (ignore) return;
        setPmxUiRelease(null);
        setPmxUiReleaseError(err.message || copy?.releaseError || 'Errore nel recupero release');
      } finally {
        if (!ignore) setPmxUiReleaseLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    const check = () => setHasConvertedReport(!!localStorage.getItem('vmwtoolsReport'));
    window.addEventListener('vmwtoolsReportUpdated', check);
    window.addEventListener('focus', check);
    return () => {
      window.removeEventListener('vmwtoolsReportUpdated', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  const parseProxmoxJson = (file) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result);
        if (!json?.pmxtools || !json?.datacenter) {
          throw new Error(copy?.invalidFormat || 'Formato pmxtools non valido');
        }
        setPmxData(json);
        setPmxError(null);
      } catch (err) {
        setPmxData(null);
        setPmxError(err.message || copy?.invalidJson || 'File JSON non valido');
      } finally {
        setPmxLoading(false);
      }
    };
    reader.onerror = () => {
      setPmxData(null);
      setPmxError(copy?.readError || 'Errore durante la lettura del file');
      setPmxLoading(false);
    };
    reader.readAsText(file);
  };

  const onDropPmx = (acceptedFiles) => {
    const file = acceptedFiles?.[0];
    if (!file) return;
    setPmxLoading(true);
    parseProxmoxJson(file);
  };

  const { getRootProps: getPmxRootProps, getInputProps: getPmxInputProps, isDragActive: isPmxDragActive } = useDropzone({
    onDrop: onDropPmx,
    accept: { 'application/json': ['.json'] },
    multiple: false,
  });

  const parseVmwJson = (json) => {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new Error(copy?.invalidJson || 'File JSON non valido');
    }
    const { vmwtools: vmwtoolsVal, report } = json;
    const isValidVmwtools =
      typeof vmwtoolsVal === 'string' &&
      vmwtoolsVal.trim() !== '' &&
      /version\s+\S+/i.test(vmwtoolsVal) &&
      /build\s*:\s*\S+/i.test(vmwtoolsVal);
    if (!isValidVmwtools) {
      throw new Error(copy?.vmwInvalidReportVmwtools || "Il file caricato non è un report vmwtools valido: campo 'vmwtools' mancante o non valido");
    }
    if (!report || typeof report !== 'object' || Array.isArray(report)) {
      throw new Error(copy?.vmwInvalidReportSection || "Il file caricato non è un report vmwtools valido: sezione 'report' mancante o non valida");
    }
    const { captured_at, name: repName } = report;
    const isValidCapturedAt =
      typeof captured_at === 'string' &&
      captured_at.trim() !== '' &&
      /^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2}$/.test(captured_at);
    if (!isValidCapturedAt) {
      throw new Error(copy?.vmwInvalidReportCapturedAt || "Il file caricato non è un report vmwtools valido: campo 'report.captured_at' mancante o non valido");
    }
    if (!repName?.trim()) {
      throw new Error(copy?.vmwInvalidReportName || "Il file caricato non è un report vmwtools valido: campo 'report.name' mancante o non valido");
    }
    setVmwData(json);
    setVmwError(null);
  };

  const parseVmwFile = (file) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result);
        parseVmwJson(json);
      } catch (err) {
        setVmwData(null);
        setVmwError(err.message || copy?.invalidJson || 'File JSON non valido');
      } finally {
        setVmwLoading(false);
      }
    };
    reader.onerror = () => {
      setVmwData(null);
      setVmwError(copy?.readError || 'Errore durante la lettura del file');
      setVmwLoading(false);
    };
    reader.readAsText(file);
  };

  const onDropVmw = (acceptedFiles) => {
    const file = acceptedFiles?.[0];
    if (!file) return;
    setVmwLoading(true);
    parseVmwFile(file);
  };

  const { getRootProps: getVmwRootProps, getInputProps: getVmwInputProps, isDragActive: isVmwDragActive } = useDropzone({
    onDrop: onDropVmw,
    accept: { 'application/json': ['.json'] },
    multiple: false,
  });

  const [downloadingKey, setDownloadingKey] = useState(null);
  const triggerDownloadAnim = (key) => {
    setDownloadingKey(key);
    setTimeout(() => setDownloadingKey((k) => (k === key ? null : k)), 2000);
  };

  const handleUseConvertedReport = () => {
    try {
      const saved = localStorage.getItem('vmwtoolsReport');
      if (!saved) { setHasConvertedReport(false); return; }
      const json = JSON.parse(saved);
      parseVmwJson(json);
    } catch (err) {
      setVmwData(null);
      setVmwError(err.message || copy?.convertedReportInvalid || 'Report convertito non valido');
    }
  };

  const pmxtoolsDownloads = [
    { label: 'macOS ARM64', icon: <SiMacos className="iv-download-icon" />, href: pmxRelease?.macosArm64?.browser_download_url || pmxRelease?.htmlUrl || '#' },
    { label: 'macOS AMD64', icon: <SiMacos className="iv-download-icon" />, href: pmxRelease?.macosAmd64?.browser_download_url || pmxRelease?.htmlUrl || '#' },
    { label: 'Linux AMD64', icon: <SiLinux className="iv-download-icon" />, href: pmxRelease?.linuxAmd64?.browser_download_url || pmxRelease?.htmlUrl || '#' },
    { label: 'Windows AMD64', icon: <DiWindows className="iv-download-icon" />, href: pmxRelease?.windowsAmd64?.browser_download_url || pmxRelease?.htmlUrl || '#' },
  ];

  const pmxtoolsUiDownloads = [
    { label: 'macOS ARM64', icon: <SiMacos className="iv-download-icon" />, href: pmxUiRelease?.macosArm64?.browser_download_url || pmxUiRelease?.htmlUrl || '#' },
    { label: 'macOS AMD64', icon: <SiMacos className="iv-download-icon" />, href: pmxUiRelease?.macosAmd64?.browser_download_url || pmxUiRelease?.htmlUrl || '#' },
    { label: 'Linux AMD64', icon: <SiLinux className="iv-download-icon" />, href: pmxUiRelease?.linuxAmd64?.browser_download_url || pmxUiRelease?.htmlUrl || '#' },
    { label: 'Linux ARM64', icon: <SiLinux className="iv-download-icon" />, href: pmxUiRelease?.linuxArm64?.browser_download_url || pmxUiRelease?.htmlUrl || '#' },
    { label: 'Windows AMD64', icon: <DiWindows className="iv-download-icon" />, href: pmxUiRelease?.windowsAmd64?.browser_download_url || pmxUiRelease?.htmlUrl || '#' },
  ];

  return (
    <div className="iv-container">
      <div className="insights-header">
        <h2 className="iv-page-title">
          {activeTech === 'vmware'
            ? <GrVmware className="page-head-icon" style={{ color: '#56a668' }} />
            : <SiProxmox className="page-head-icon" style={{ color: '#f97316' }} />}
          Infrastructure Insights
        </h2>
      </div>

      <div className="insights-tech-switcher">
        {showProxmox && (
          <button
            className={`insights-tech-tab${activeTech === 'proxmox' ? ' active' : ''}`}
            onClick={() => setActiveTech('proxmox')}
            style={{ '--tab-color': '#f97316' }}
          >
            <SiProxmox className="insights-tab-icon" />
            Proxmox
          </button>
        )}
        {showVmware && (
          <button
            className={`insights-tech-tab${activeTech === 'vmware' ? ' active' : ''}`}
            onClick={() => setActiveTech('vmware')}
            style={{ '--tab-color': '#56a668' }}
          >
            <GrVmware className="insights-tab-icon" />
            VMware
          </button>
        )}
        {!showProxmox && !showVmware && (
          <p className="insights-no-tech">{copy?.noTechAvailable || 'Nessuna tecnologia abilitata.'}</p>
        )}
      </div>

      {/* Proxmox section */}
      {showProxmox && <div className={activeTech === 'proxmox' ? 'view-panel--active' : 'view-panel--hidden'}>
        {!pmxData ? (
          <div className="iv-upload-form">
            <h2 className="iv-upload-title">
              <SiProxmox className="pmx-iv-dashboard-icon title" />
              {copy?.uploadTitle || 'upload pmxtools'}
            </h2>

            <div
              {...getPmxRootProps()}
              className={`iv-dropzone${isPmxDragActive ? ' iv-dropzone-active' : ''}`}
            >
              <input {...getPmxInputProps()} />
              {pmxLoading ? (
                <p>{copy?.processing || 'Elaborazione...'}</p>
              ) : isPmxDragActive ? (
                <p>{copy?.dropActive || 'Rilascia qui il file JSON di pmxtools'}</p>
              ) : (
                <p>{copy?.dropIdle || 'Trascina qui il file JSON di pmxtools o clicca per selezionarlo'}</p>
              )}
            </div>

            {showPmxtoolsCli && (
              <div className="iv-download-card">
                <h3 className="iv-download-card-title">
                  <IoCloudDownloadSharp className="pmx-iv-dashboard-icon" />
                  {copy?.missingCli || 'Non hai pmxtools-cli? Scaricalo.'}
                </h3>
                <p className="iv-download-card-version">
                  {pmxReleaseLoading
                    ? (copy?.releaseLoading || 'Recupero ultima release...')
                    : `${copy?.latestRelease || 'Ultima release'}: ${pmxRelease?.name || common?.unavailable || 'non disponibile'}`}
                </p>
                <div className="iv-pmxcli-notice">
                  <span className="iv-pmxcli-notice__pill">pmxtools-cli</span>
                  <span>
                    {copy?.cliNotice}{' '}
                    <strong>{copy?.cliNoticeStrong}</strong>
                  </span>
                </div>
                <div className="iv-download-card-actions">
                  {pmxtoolsDownloads.map((item) => {
                    const key = `cli-${item.label}`;
                    const isDownloading = downloadingKey === key;
                    return (
                      <a
                        key={item.label}
                        href={item.href}
                        className={`iv-download-os-btn${isDownloading ? ' iv-download-os-btn--downloading' : ''}`}
                        target="_blank"
                        rel="noreferrer"
                        title={item.label}
                        aria-label={item.label}
                        onClick={() => triggerDownloadAnim(key)}
                      >
                        {isDownloading ? (
                          <IoCloudDownloadSharp className="iv-download-btn-progress-icon" />
                        ) : (
                          <>
                            {item.icon}
                            <span>{item.label}</span>
                          </>
                        )}
                      </a>
                    );
                  })}
                </div>
                {pmxReleaseError && (
                  <p className="iv-download-card-error">
                    {copy?.releaseError || 'Errore nel recupero release'}: {pmxReleaseError}
                  </p>
                )}
              </div>
            )}

            {showPmxtoolsDownload && (
              <div className="iv-download-card iv-pmxui-card">
                <div className="iv-pmxui-icon-wrap">
                  <img src={pmxtoolsUiLogo} className="iv-pmxui-logo" alt="pmxtools" />
                </div>
                <h3 className="iv-download-card-title iv-pmxui-title">
                  {copy?.missingUi || 'Non hai pmxtools? Scaricalo.'}
                </h3>
                <p className="iv-download-card-version iv-pmxui-version">
                  {pmxUiReleaseLoading
                    ? (copy?.releaseLoading || 'Recupero ultima release...')
                    : `${copy?.latestRelease || 'Ultima release'}: ${pmxUiRelease?.name || common?.unavailable || 'non disponibile'}`}
                </p>
                <p className="iv-pmxui-desc">
                  {copy?.uiDescription}{' '}
                  <strong>{copy?.uiDescriptionStrong}</strong> -{' '}
                  {copy?.uiDescriptionSuffix}
                </p>
                <div className="iv-download-card-actions iv-pmxui-actions">
                  {pmxtoolsUiDownloads.map((item) => {
                    const key = `ui-${item.label}`;
                    const isDownloading = downloadingKey === key;
                    return (
                      <a
                        key={item.label}
                        href={item.href}
                        className={`iv-download-os-btn iv-pmxui-btn${isDownloading ? ' iv-download-os-btn--downloading' : ''}`}
                        target="_blank"
                        rel="noreferrer"
                        title={item.label}
                        aria-label={item.label}
                        onClick={() => triggerDownloadAnim(key)}
                      >
                        {isDownloading ? (
                          <IoCloudDownloadSharp className="iv-download-btn-progress-icon" />
                        ) : (
                          <>
                            {item.icon}
                            <span>{item.label}</span>
                          </>
                        )}
                      </a>
                    );
                  })}
                </div>
                {pmxUiReleaseError && (
                  <p className="iv-download-card-error">
                    {copy?.releaseError || 'Errore nel recupero release'}: {pmxUiReleaseError}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <ProxmoxInfraDash
            data={pmxData}
            handleReset={() => setPmxData(null)}
            language={language}
          />
        )}

        {pmxError && (
          <div className="error-modal-backdrop">
            <div className="error-modal-box">
              <FaTimesCircle className="error-icon" />
              <h2>{copy?.invalidReportTitle || 'Report pmxtools non valido'}</h2>
              <p>{pmxError}</p>
              <button onClick={() => setPmxError(null)}>{copy?.close || 'Chiudi'}</button>
            </div>
          </div>
        )}
      </div>}

      {/* VMware section */}
      {showVmware && <div className={activeTech === 'vmware' ? 'view-panel--active' : 'view-panel--hidden'}>
        {!vmwData ? (
          <div className="insights-vmw-wrap">
            <div className="iv-upload-form iv-upload-form--flex">
              <h2 className="iv-upload-title">
                <GrVmware className="vmw-iv-dashboard-icon title" />
                {copy?.vmwUploadTitle || 'vmwtools upload'}
              </h2>

              <div
                {...getVmwRootProps()}
                className={`iv-dropzone${isVmwDragActive ? ' iv-dropzone-active' : ''}`}
              >
                <input {...getVmwInputProps()} />
                {vmwLoading ? (
                  <p>{copy?.vmwProcessing || 'Elaborazione file JSON in corso...'}</p>
                ) : isVmwDragActive ? (
                  <p>{copy?.vmwDropActive || 'Rilascia qui il file JSON'}</p>
                ) : (
                  <p>{copy?.vmwDropIdle || 'Trascina qui il file JSON o clicca per selezionarlo'}</p>
                )}
              </div>

              {hasConvertedReport && (
                <div className="iv-download-card iv-rvtools-download-card">
                  <h3 className="iv-download-card-title">
                    <LuFileJson className="vmw-iv-dashboard-icon" /> {copy?.convertedReportAvailable || 'report vmwtools disponibile'}
                  </h3>
                  <p className="iv-download-card-version">{copy?.useConvertedReport || 'usa il report appena convertito'}</p>
                  <div className="iv-download-card-actions iv-rvtools-download-actions">
                    <button onClick={handleUseConvertedReport} className="iv-download-os-btn">
                      <LuFileJson className="iv-download-icon" />
                      <span>{copy?.loadReport || 'carica report'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {showRvtoolsConverter && (
              <>
                <div className="insights-divider">{copy?.rvtoolsDivider || 'oppure converti da RVTools'}</div>
                <VmwToolsConverter language={language} />
              </>
            )}
          </div>
        ) : (
          <VMwareInfraDash
            data={vmwData}
            handleReset={() => setVmwData(null)}
            language={language}
          />
        )}

        {vmwError && (
          <div className="error-modal-backdrop">
            <div className="error-modal-box">
              <FaTimesCircle className="error-icon" />
              <h2>{copy?.vmwInvalidTitle || 'vmwtools non valido'}</h2>
              <p>{vmwError}</p>
              <button onClick={() => setVmwError(null)}>{copy?.close || 'Chiudi'}</button>
            </div>
          </div>
        )}
      </div>}
    </div>
  );
}
