import { useState, useEffect, useRef } from 'react';

const POLL_INTERVAL = 4000;
const MAX_POLLS = 45;

export default function CompetitorAds() {
  const [query, setQuery] = useState('');
  const [runId, setRunId] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | starting | running | done | error
  const [ads, setAds] = useState([]);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedImg, setSelectedImg] = useState(0);
  const pollCount = useRef(0);
  const pollTimer = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const startScrape = async () => {
    if (!query.trim() || phase === 'starting' || phase === 'running') return;
    clearTimeout(pollTimer.current);
    setRunId(null);
    setAds([]);
    setError(null);
    setPhase('starting');
    pollCount.current = 0;

    try {
      const res = await fetch('/api/competitor-ads/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to start scrape');
      setRunId(data.runId);
      setPhase('running');
    } catch (err) {
      setError(err.message);
      setPhase('error');
    }
  };

  useEffect(() => {
    if (!runId || phase !== 'running') return;

    const poll = async () => {
      if (pollCount.current >= MAX_POLLS) {
        setError('Scrape timed out — try again.');
        setPhase('error');
        return;
      }
      pollCount.current += 1;

      try {
        const res = await fetch(`/api/competitor-ads/status/${runId}`);
        const data = await res.json();

        if (data.status === 'SUCCEEDED') {
          setAds(data.ads ?? []);
          setPhase('done');
        } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(data.status)) {
          setError(`Apify run ${data.status.toLowerCase()}.`);
          setPhase('error');
        } else {
          pollTimer.current = setTimeout(poll, POLL_INTERVAL);
        }
      } catch (err) {
        setError(err.message);
        setPhase('error');
      }
    };

    pollTimer.current = setTimeout(poll, POLL_INTERVAL);
    return () => clearTimeout(pollTimer.current);
  }, [runId, phase]);

  const isLoading = phase === 'starting' || phase === 'running';
  const elapsed = pollCount.current * (POLL_INTERVAL / 1000);

  const openAd = (ad) => { setSelected(ad); setSelectedImg(0); };

  return (
    <div className="competitor-wrap">
      <div className="competitor-header">
        <div className="hero-eyebrow">Competitor Intelligence</div>
        <h2 className="competitor-title">Facebook Ad Library Scraper</h2>
        <p className="competitor-sub">
          Enter a competitor's Facebook Page name or URL to pull their active ad creatives.
        </p>
      </div>

      <div className="competitor-search">
        <input
          className="competitor-input"
          type="text"
          placeholder="e.g. Green Valley Window Tint or facebook.com/Greenvalleywindowtint"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && startScrape()}
          disabled={isLoading}
        />
        <button
          className="competitor-btn"
          onClick={startScrape}
          disabled={!query.trim() || isLoading}
        >
          {isLoading ? 'Searching…' : 'Find Ads'}
        </button>
      </div>

      {isLoading && (
        <div className="competitor-loading">
          <div className="spinner" />
          <p>
            {phase === 'starting'
              ? 'Starting Apify scraper…'
              : `Scraping Facebook Ad Library… ${elapsed > 0 ? `(${elapsed}s)` : ''}`}
          </p>
          <p className="competitor-loading-hint">Usually takes 60–120 seconds</p>
        </div>
      )}

      {error && <div className="error-box"><strong>Error:</strong> {error}</div>}

      {phase === 'done' && ads.length === 0 && (
        <div className="gallery-status">
          <div className="gallery-empty-icon">📭</div>
          <p className="gallery-empty-title">No ads found</p>
          <p className="gallery-empty-sub">Try the exact Page name or a shorter search term.</p>
        </div>
      )}

      {ads.length > 0 && (
        <>
          <div className="competitor-count">
            <strong>{ads.length}</strong> ads found for{' '}
            <strong>{ads[0]?.pageName ?? query}</strong>
          </div>
          <div className="competitor-grid">
            {ads.map((ad) => (
              <div
                key={ad.id}
                className={`ad-card${ad.isActive ? ' active' : ''}`}
                onClick={() => openAd(ad)}
              >
                <div className="ad-card-media">
                  {ad.images[0] ? (
                    <img src={ad.images[0]} alt="Ad creative" loading="lazy" />
                  ) : ad.videos[0] ? (
                    <video src={ad.videos[0]} muted playsInline />
                  ) : (
                    <div className="ad-card-no-media">No creative</div>
                  )}
                  <div className="ad-card-overlay">View</div>
                  {ad.isActive && <span className="ad-active-badge">Active</span>}
                  {ad.images.length > 1 && (
                    <span className="ad-count-badge">{ad.images.length}</span>
                  )}
                </div>
                {ad.title && <div className="ad-card-title">{ad.title}</div>}
                {ad.body && (
                  <div className="ad-card-body">
                    {ad.body.length > 90 ? `${ad.body.slice(0, 90)}…` : ad.body}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {selected && (
        <div className="lightbox" onClick={() => setSelected(null)}>
          <div className="lightbox-inner ad-lightbox" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setSelected(null)}>✕</button>
            <div className="lightbox-title">
              {selected.pageName}
              {selected.isActive && <span className="ad-active-badge" style={{ marginLeft: '0.75rem' }}>Active</span>}
            </div>

            {selected.images.length > 0 && (
              <>
                <div className="lightbox-images single">
                  <div className="lightbox-img-wrap">
                    <img src={selected.images[selectedImg]} alt="Ad creative" />
                  </div>
                </div>
                {selected.images.length > 1 && (
                  <div className="ad-img-nav">
                    {selected.images.map((_, i) => (
                      <button
                        key={i}
                        className={`ad-img-dot${i === selectedImg ? ' active' : ''}`}
                        onClick={() => setSelectedImg(i)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {selected.videos.length > 0 && !selected.images.length && (
              <div className="lightbox-images single">
                <video src={selected.videos[0]} controls style={{ width: '100%', borderRadius: '10px' }} />
              </div>
            )}

            {selected.title && (
              <p className="ad-detail-title">{selected.title}</p>
            )}
            {selected.body && (
              <p className="ad-detail-body">{selected.body}</p>
            )}

            <div className="lightbox-footer">
              <span className="lightbox-date">
                {selected.startDate ? `Running since ${selected.startDate}` : 'Date unknown'}
              </span>
              {selected.images[selectedImg] && (
                <a
                  href={selected.images[selectedImg]}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-download"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', padding: '0.7rem 1.5rem' }}
                >
                  Open Image
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
