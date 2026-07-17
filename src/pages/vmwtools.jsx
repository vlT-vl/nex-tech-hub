import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import vmwtoolsParser from '../../scripts/vmwtools.js';
import { FaTimesCircle } from 'react-icons/fa';
import { DiWindows } from 'react-icons/di';
import { IoCloudDownloadSharp } from 'react-icons/io5';
import { GrVmMaintenance } from 'react-icons/gr';
import { RiResetLeftFill } from 'react-icons/ri';
import { LuFileJson, LuDownload } from 'react-icons/lu';
import { getUiText } from '../lib/uiText';

export default function VmwToolsConverter({ language = 'it' }) {
  const [parsedData, setParsedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { infrastructure: copy } = getUiText(language);

  const handleReset = () => {
    setParsedData(null);
    setError(null);
    setLoading(false);
    localStorage.removeItem('vmwtoolsReport');
    window.dispatchEvent(new Event('vmwtoolsReportUpdated'));
  };

  const downloadJsonReport = () => {
    const reportFileName =
      parsedData?.report?.name && typeof parsedData.report.name === 'string'
        ? parsedData.report.name
        : 'report-vmwtools.json';
    const blob = new Blob([JSON.stringify(parsedData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = reportFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const parseXlsxReport = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const fileBuffer = new Uint8Array(arrayBuffer);
      const report = await vmwtoolsParser(fileBuffer);
      if (!report || typeof report !== 'object') throw new Error(copy?.rvtoolsInvalidConversion || 'Conversione vmwtools non valida');
      setParsedData(report);
      localStorage.setItem('vmwtoolsReport', JSON.stringify(report));
      window.dispatchEvent(new Event('vmwtoolsReportUpdated'));
      setError(null);
    } catch (err) {
      setParsedData(null);
      setError(err.message || copy?.rvtoolsConvertError || 'File XLSX non valido o conversione fallita');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (acceptedFiles, fileRejections) => {
    if (fileRejections?.length) {
      setParsedData(null);
      setLoading(false);
      setError(copy?.rvtoolsOnlyXlsx || 'Puoi caricare solo un file .xlsx valido');
      return;
    }
    const file = acceptedFiles?.[0];
    if (!file) return;
    setLoading(true);
    parseXlsxReport(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    multiple: false,
    maxFiles: 1,
  });

  return (
    <>
      {!parsedData ? (
        <div className="iv-upload-form iv-upload-form--flex">
          <h2 className="iv-upload-title">
            <GrVmMaintenance className="vmw-iv-dashboard-icon title" /> rvtools converter
          </h2>
          <h2 className="iv-upload-subtitle">
            {copy?.rvtoolsSubtitle || 'converte un report RVTools XLSX in formato vmwtools JSON'}
          </h2>
          <div
            {...getRootProps()}
            className={`iv-dropzone${isDragActive ? ' iv-dropzone-active' : ''}`}
          >
            <input {...getInputProps()} />
            {loading ? (
              <p>{copy?.rvtoolsProcessing || 'Conversione file XLSX in corso...'}</p>
            ) : isDragActive ? (
              <p>{copy?.rvtoolsDropActive || 'Rilascia qui il file XLSX di RVTools'}</p>
            ) : (
              <p>{copy?.rvtoolsDropIdle || 'Trascina qui il file XLSX di RVTools da convertire o clicca per selezionarlo'}</p>
            )}
          </div>
          <div className="iv-download-card iv-rvtools-download-card">
            <h3 className="iv-download-card-title">
              <IoCloudDownloadSharp className="vmw-iv-dashboard-icon" /> {copy?.rvtoolsMissing || 'Non hai software RVTools? scaricalo!'}
            </h3>
            <div className="iv-download-card-actions iv-rvtools-download-actions">
              <a
                href="https://downloads.dell.com/rvtools/rvtools4.7.1.msi?hve=Download+RVTools"
                className="iv-download-os-btn"
                target="_blank"
                rel="noreferrer"
                title="Windows AMD64 official exe"
                aria-label="Windows AMD64 official exe"
              >
                <DiWindows className="iv-download-icon" />
                <span>Windows AMD64 official exe</span>
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="iv-upload-form iv-upload-form--flex">
          <h2 className="iv-upload-title">
            <GrVmMaintenance className="vmw-iv-dashboard-icon title" /> rvtools converter
          </h2>
          <div className="iv-download-card iv-rvtools-result-card">
            <div className="iv-rvtools-result-icon">
              <LuFileJson />
            </div>
            <div className="iv-rvtools-result-info">
              <p className="iv-rvtools-result-label">{copy?.rvtoolsCompleted || 'conversione completata'}</p>
              <p className="iv-rvtools-result-name">{parsedData.report.name}</p>
              <div className="iv-rvtools-result-actions">
                <button onClick={downloadJsonReport} className="iv-download-os-btn">
                  <LuDownload className="iv-download-icon" />
                  {copy?.downloadJson || 'scarica JSON'}
                </button>
                <button onClick={handleReset} className="iv-download-os-btn">
                  <RiResetLeftFill className="iv-download-icon" />
                  {copy?.reset || 'reset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-modal-backdrop">
          <div className="error-modal-box">
            <FaTimesCircle className="error-icon" />
            <h2>{copy?.rvtoolsInvalidTitle || 'File XLSX non valido'}</h2>
            <p>{error}</p>
            <button onClick={() => setError(null)}>{copy?.close || 'Chiudi'}</button>
          </div>
        </div>
      )}
    </>
  );
}
