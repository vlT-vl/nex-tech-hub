import ReleaseWidget from './relasewidget.jsx';
import DownloadWidget from './downloadwidget.jsx';
import CVEWidget from './cvewidget.jsx';
import NewsWidget from './newswidget.jsx';
import NexthLogo from '../components/NexthLogo';

export default function Dashboard({ darkMode = false, language = 'it' }) {
  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="dashboard-logo">
          <NexthLogo variant="text" />
        </div>
      </div>
      <div className="dashboard-widgets">
        <ReleaseWidget language={language} />
        <DownloadWidget language={language} />
        <CVEWidget language={language} />
        <NewsWidget language={language} />
      </div>
    </div>
  );
}
