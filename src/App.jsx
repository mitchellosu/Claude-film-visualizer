import { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';

const FILMS = [
  {
    id: 'dual-reflective-15',
    name: 'Dual Reflective 15',
    desc: 'Deep charcoal-silver mirror finish — maximum privacy, premium look',
    swatch: 'linear-gradient(135deg, #1a1e22, #4a5560)',
    swatchBorder: '#5a6570',
  },
  {
    id: 'darkvu-10',
    name: 'DarkVu 10',
    desc: 'Deep charcoal ceramic, subtle warm bronze tone, glossy reflective finish',
    swatch: 'linear-gradient(135deg, #1c1a18, #3a3228)',
    swatchBorder: '#4a4035',
  },
  {
    id: 'darkvu-20',
    name: 'DarkVu 20',
    desc: 'Medium charcoal ceramic, slight warm bronze, soft reflectivity — lighter than DarkVu 10',
    swatch: 'linear-gradient(135deg, #2a2620, #524840)',
    swatchBorder: '#625850',
  },
  {
    id: 'dual-reflective-25',
    name: 'Dual Reflective 25',
    desc: 'Medium charcoal-silver mirror finish — balanced privacy with natural brightness',
    swatch: 'linear-gradient(135deg, #252a30, #5a6878)',
    swatchBorder: '#6a7888',
  },
  {
    id: 'ceramic-20',
    name: 'Ceramic 20',
    desc: 'Neutral charcoal-gray, moderately dark, realistic daytime privacy',
    swatch: 'linear-gradient(135deg, #282828, #505055)',
    swatchBorder: '#606065',
  },
];

const LOADING_STEPS = [
  'Scanning window positions…',
  'Calculating film coverage…',
  'Applying tint layer…',
  'Rendering reflections…',
  'Polishing highlights…',
  'Finalizing details…',
];

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ─── Gallery ──────────────────────────────────────────────────────────────────
function Gallery({ films, highlightId }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setFetching(true);
    setFetchError(null);
    const url = filter === 'all' ? '/api/gallery' : `/api/gallery?filmId=${filter}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => { setItems(d.items ?? []); setFetching(false); })
      .catch(() => { setFetchError('Could not load gallery.'); setFetching(false); });
  }, [filter]);

  // Close lightbox on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="gallery-wrap">
      {/* Filters */}
      <div className="gallery-filters">
        <button
          className={`filter-pill${filter === 'all' ? ' active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        {films.map((f) => (
          <button
            key={f.id}
            className={`filter-pill${filter === f.id ? ' active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* Grid */}
      {fetching ? (
        <div className="gallery-status">
          <div className="spinner" />
          <p>Loading visualizations…</p>
        </div>
      ) : fetchError ? (
        <div className="gallery-status">
          <p className="gallery-error">{fetchError}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="gallery-status">
          <div className="gallery-empty-icon">🏠</div>
          <p className="gallery-empty-title">No visualizations yet</p>
          <p className="gallery-empty-sub">
            {filter === 'all'
              ? 'Create your first visualization to see it here.'
              : `No ${films.find((f) => f.id === filter)?.name} results yet.`}
          </p>
        </div>
      ) : (
        <div className="gallery-grid">
          {items.map((item) => (
            <div
              key={item.id}
              className={`gallery-card${item.id === highlightId ? ' highlight' : ''}`}
              onClick={() => setSelected(item)}
            >
              <div className="gallery-card-img-wrap">
                <img src={item.result_url} alt={item.film_name} loading="lazy" />
                <div className="gallery-card-overlay">View</div>
              </div>
              <div className="gallery-card-info">
                <span className="gallery-card-film">{item.film_name}</span>
                <span className="gallery-card-date">{timeAgo(item.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selected && (
        <div className="lightbox" onClick={() => setSelected(null)}>
          <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setSelected(null)}>✕</button>
            <div className="lightbox-title">{selected.film_name}</div>
            <div className={`lightbox-images${!selected.original_url ? ' single' : ''}`}>
              {selected.original_url && (
                <div className="lightbox-img-wrap">
                  <img src={selected.original_url} alt="Before" />
                  <div className="lightbox-label">Before</div>
                </div>
              )}
              <div className="lightbox-img-wrap">
                <img src={selected.result_url} alt="After" />
                <div className="lightbox-label">After</div>
              </div>
            </div>
            <div className="lightbox-footer">
              <span className="lightbox-date">{timeAgo(selected.created_at)}</span>
              <a
                href={selected.result_url}
                download={`coolvu-${selected.film_id}.png`}
                className="btn-download"
              >
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState('create');
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [filmId, setFilmId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState(null);
  const [lastId, setLastId] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef(null);
  const loadingRef = useRef(null);
  const resultRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setPhoto(file);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); },
    [handleFile]
  );

  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const id = setInterval(() => setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 5000);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (loading) setTimeout(() => loadingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  }, [loading]);

  useEffect(() => {
    if (result) setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }, [result]);

  const handleApply = async () => {
    if (!photo || !filmId || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body = new FormData();
      body.append('image', photo);
      body.append('filmId', filmId);

      const res = await fetch('/api/visualize', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Visualization failed');
      setResult(data.image);
      setLastId(data.id ?? null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result;
    a.download = `coolvu-${filmId}-visualization.png`;
    a.click();
  };

  const selectedFilm = FILMS.find((f) => f.id === filmId);

  return (
    <>
      <header className="header">
        <div className="logo">Cool<span className="logo-accent">Vu</span></div>
        <nav className="nav-tabs">
          <button className={`nav-tab${view === 'create' ? ' active' : ''}`} onClick={() => setView('create')}>
            Create
          </button>
          <button className={`nav-tab${view === 'gallery' ? ' active' : ''}`} onClick={() => setView('gallery')}>
            Gallery
          </button>
        </nav>
        <a href="#consultation" className="header-cta" onClick={(e) => { if (view !== 'create') { e.preventDefault(); setView('create'); setTimeout(() => document.getElementById('consultation')?.scrollIntoView({ behavior: 'smooth' }), 50); } }}>
          Book Consultation
        </a>
      </header>

      {view === 'gallery' ? (
        <Gallery films={FILMS} highlightId={lastId} />
      ) : (
        <>
          <div className="hero">
            <div className="hero-eyebrow">AI Window Film Visualizer</div>
            <h1>See Your Home<br />With Window Film</h1>
            <p>Upload a photo of your house, pick a film, and watch the AI apply it instantly — before you commit to anything.</p>
          </div>

          <div className="container">
            {/* Step 1 */}
            <div className="step">
              <div className="step-label">Step 1 — Upload Your Photo</div>
              <div
                className={`upload-area${preview ? ' has-photo' : ''}${dragOver ? ' drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !preview && fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={(e) => handleFile(e.target.files[0])} />
                {preview ? (
                  <>
                    <img src={preview} alt="Uploaded house" className="upload-preview" />
                    <div className="upload-change-row">
                      <button className="btn-link" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                        Change photo
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="upload-icon">🏠</div>
                    <div className="upload-text">
                      <strong>Drop your photo here</strong> or click to browse
                      <span className="upload-hint">JPG or PNG, up to 20 MB</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Step 2 */}
            <div className="step">
              <div className="step-label">Step 2 — Choose Your Film</div>
              <div className="film-grid">
                {FILMS.map((film) => (
                  <div key={film.id} className={`film-card${filmId === film.id ? ' selected' : ''}`}
                    onClick={() => setFilmId(film.id)}>
                    <div className="film-swatch" style={{ background: film.swatch, borderColor: film.swatchBorder }} />
                    <div className="film-card-name">{film.name}</div>
                    <div className="film-card-desc">{film.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Apply */}
            <button className="apply-btn" onClick={handleApply} disabled={!photo || !filmId || loading}>
              {loading ? 'Visualizing…' : `Apply Film${selectedFilm ? ` — ${selectedFilm.name}` : ''}`}
            </button>

            {error && <div className="error-box"><strong>Error:</strong> {error}</div>}

            {loading && (
              <div className="loading" ref={loadingRef}>
                <div className="loading-film-name">{selectedFilm?.name}</div>
                <div className="loading-step-text">{LOADING_STEPS[loadingStep]}</div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" key={loading} />
                </div>
                <div className="loading-est">Usually takes 30–45 seconds</div>
              </div>
            )}

            {result && (
              <div className="results" ref={resultRef}>
                <div className="results-heading">Your Visualization</div>
                <div className="comparison">
                  <div className="comparison-item">
                    <img src={preview} alt="Before" />
                    <div className="comparison-label">Before</div>
                  </div>
                  <div className="comparison-item">
                    <img src={result} alt="After" />
                    <div className="comparison-label">After — {selectedFilm?.name}</div>
                  </div>
                </div>
                <div className="result-actions">
                  <button className="btn-download" onClick={handleDownload}>Download Result</button>
                  <button className="btn-retry" onClick={() => { setResult(null); setFilmId(null); }}>
                    Try Another Film
                  </button>
                  <button className="btn-gallery" onClick={() => setView('gallery')}>
                    View Gallery →
                  </button>
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="cta" id="consultation">
              <h2>Ready to Transform Your Home?</h2>
              <p>Get a free quote and professional installation from our certified team. Most installs completed same-day.</p>
              {/* Replace href with your actual booking URL */}
              <a href="#" className="btn-cta">Book a Free Consultation →</a>
            </div>
          </div>
        </>
      )}
    </>
  );
}
