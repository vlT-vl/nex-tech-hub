import { useEffect, useRef, useState } from 'react';
import { SiProxmox, SiKubernetes, SiUbuntu } from 'react-icons/si';
import { GrVmware } from 'react-icons/gr';
import { FaLinux } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { HiOutlineNewspaper } from 'react-icons/hi';
import { LuExternalLink, LuCalendar, LuTag, LuGlobe } from 'react-icons/lu';
import { getUiText } from '../lib/uiText';
import DashModal from '../components/DashModal';
import { useData, NEWS_LINKS } from '../context/DataContext';

const NEWS_TECH_LIST = [
  { id: 'proxmox',    label: 'Proxmox',    Icon: SiProxmox,    color: '#e57000' },
  { id: 'vmware',     label: 'VMware',     Icon: GrVmware,     color: '#56a668' },
  { id: 'kubernetes', label: 'Kubernetes', Icon: SiKubernetes, color: '#326ce5' },
  { id: 'linux',      label: 'Linux',      Icon: FaLinux,      color: '#f9c800' },
];

const ICON_MAP = [
  { match: (href) => href.includes('proxmox.com'),    Icon: SiProxmox,    color: '#f97316' },
  { match: (href) => href.includes('vmware.com'),     Icon: GrVmware,     color: '#56a668' },
  { match: (href) => href.includes('broadcom.com'),   Icon: GrVmware,     color: '#56a668' },
  { match: (href) => href.includes('kubernetes.io'),  Icon: SiKubernetes, color: '#326ce5' },
  { match: (href) => href.includes('ubuntu.com'),     Icon: SiUbuntu,     color: '#e95420' },
  { match: (href) => href.includes('phoronix.com'),   Icon: FaLinux,      color: '#f9c800' },
  { match: (href) => href.includes('kernel.org'),     Icon: FaLinux,      color: '#f9c800' },
  { match: (href) => href.includes('news.google.com'), Icon: FcGoogle,    color: ''        },
];

const getNewsIcon  = (item) => ICON_MAP.find((e) => e.match(item.href || ''))?.Icon  ?? HiOutlineNewspaper;
const getNewsColor = (item) => ICON_MAP.find((e) => e.match(item.href || ''))?.color ?? 'currentColor';
const isGoogle     = (item) => (item.href || '').includes('news.google.com');

const NewsModal = ({ item, copy, onClose }) => {
  const Icon  = getNewsIcon(item);
  const color = getNewsColor(item);
  return (
    <DashModal open onClose={onClose} icon={Icon} title={item.category || copy.newsModalTitle}>
      <div className="dm-news-hero">
        <Icon className={`dm-news-hero-icon${isGoogle(item) ? ' dm-news-hero-icon--google' : ''}`} style={color ? { color } : undefined} />
      </div>
      <div className="dm-news-meta">
        {item.date && (
          <span className="dm-meta-chip dm-meta-chip--date">
            <LuCalendar className="dm-meta-chip-icon" />{item.date}
          </span>
        )}
        {item.category && (
          <span className="dm-meta-chip">
            <LuTag className="dm-meta-chip-icon" />{item.category}
          </span>
        )}
      </div>
      <h3 className="dm-news-title">{item.title}</h3>
      {item.summary && (
        <div className="dm-news-preview">
          <p className="dm-news-summary">{item.summary}</p>
        </div>
      )}
      <a href={item.href} target="_blank" rel="noreferrer" className="dm-read-btn">
        {copy.readNews} <LuExternalLink className="dm-read-btn-icon" />
      </a>
    </DashModal>
  );
};

export default function NewsWidget({ language = 'it' }) {
  const { news, requestNewsTech }       = useData();
  const [selectedTech, setSelectedTech] = useState('proxmox');
  const [modal,        setModal]        = useState(null);
  const [isSliding,    setIsSliding]    = useState(false);
  const listRef       = useRef(null);
  const slideTimerRef = useRef(null);
  const { dashboard: copy } = getUiText(language);

  const techNews  = news[selectedTech] ?? { data: [], loading: false, error: 'error' };
  const newsLinks = NEWS_LINKS[selectedTech]?.[language] ?? NEWS_LINKS.proxmox.it;

  // Trigger lazy fetch on tab switch or language change.
  // requestNewsTech is idempotent: same tech+lang pair is fetched only once.
  useEffect(() => {
    requestNewsTech(selectedTech, language);
  }, [selectedTech, language, requestNewsTech]);

  const handleTechChange = (id) => {
    setSelectedTech(id);
    setModal(null);
    if (listRef.current) listRef.current.scrollTo({ left: 0, behavior: 'instant' });
  };

  useEffect(() => {
    if (techNews.loading || techNews.error || modal || techNews.data.length <= 3) return undefined;

    const list = listRef.current;
    if (!list) return undefined;

    const timer = window.setInterval(() => {
      const maxScroll = list.scrollWidth - list.clientWidth;
      if (maxScroll <= 1) return;

      const nextLeft = list.scrollLeft + list.clientWidth;
      setIsSliding(false);
      window.requestAnimationFrame(() => setIsSliding(true));
      window.clearTimeout(slideTimerRef.current);
      slideTimerRef.current = window.setTimeout(() => setIsSliding(false), 640);

      list.scrollTo({
        left: nextLeft >= maxScroll - 4 ? 0 : nextLeft,
        behavior: 'smooth',
      });
    }, 15000);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(slideTimerRef.current);
    };
  }, [modal, techNews.data.length, techNews.error, techNews.loading, selectedTech]);

  return (
    <>
      <div className="widget news-widget">
        <div className="news-head">
          <HiOutlineNewspaper className="wh-icon" />
          <span className="wh-title">{copy.newsTitle}</span>
          <div className="news-links">
            <a href={newsLinks.source}    target="_blank" rel="noreferrer" className="news-link">{copy.newsSource}</a>
            <a href={newsLinks.community} target="_blank" rel="noreferrer" className="news-link">{copy.newsCommunity}</a>
          </div>
        </div>

        {/* tech switcher */}
        <div className="tech-selector dl-tech-selector news-tech-selector">
          {NEWS_TECH_LIST.map(({ id, label, Icon, color }) => (
            <button
              key={id}
              type="button"
              className={`tech-pill${selectedTech === id ? ' active' : ''}`}
              style={selectedTech === id ? { '--pill-color': color, '--pill-color-dim': `${color}28` } : {}}
              onClick={() => handleTechChange(id)}
            >
              <Icon className="tech-pill-icon" style={{ color, opacity: selectedTech === id ? 1 : 0.55 }} />
              {label}
            </button>
          ))}
        </div>

        {techNews.loading ? (
          <div className="w-empty">{copy.newsLoading}</div>
        ) : techNews.error ? (
          <div className="w-empty">{copy.newsError}</div>
        ) : (
          <div className={`news-list${isSliding ? ' news-list--sliding' : ''}`} ref={listRef}>
            {techNews.data.map((item) => {
              const Icon  = getNewsIcon(item);
              const color = getNewsColor(item);
              return (
                <button key={`${item.date}-${item.title}`} className="news-card" onClick={() => setModal(item)}>
                  <div className="news-card-icon-wrap">
                    <Icon className={`news-card-icon${isGoogle(item) ? ' news-card-icon--google' : ''}`} style={color ? { color } : undefined} />
                  </div>
                  <div className="news-card-title">{item.title}</div>
                  <div className="news-card-pills">
                    {item.date && (
                      <span className="news-pill news-pill-date">
                        <LuCalendar className="news-pill-icon" />{item.date}
                      </span>
                    )}
                    {item.category && (
                      <span className="news-pill">
                        <LuTag className="news-pill-icon" />{item.category}
                      </span>
                    )}
                    {item.sourceDomain && (
                      <span className="news-pill news-pill-source">
                        <LuGlobe className="news-pill-icon" />{item.sourceDomain}
                      </span>
                    )}
                  </div>
                  {item.summary && <p className="news-card-summary">{item.summary}</p>}
                  <span className="news-card-cta">{copy.readNews} →</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {modal && <NewsModal item={modal} copy={copy} onClose={() => setModal(null)} />}
    </>
  );
}
