import { useState, useRef, useCallback } from 'react';
import './App.css';

const FILMS = [
  {
    id: 'dual-reflective-15',
    name: 'Dual Reflective 15',
    desc: 'Deep charcoal-silver mirror finish — maximum privacy, premium look',
    swatch: 'linear-gradient(135deg, #1a1e22, #4a5560)',
    swatchBorder: '#5a6570',
  },
];

export default function App() {
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [filmId, setFilmId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef(null);

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
    (e) => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

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
        <div className="logo">
          Cool<span className="logo-accent">Vu</span>
        </div>
        <a href="#consultation" className="header-cta">
          Book Consultation
        </a>
      </header>

      <div className="hero">
        <div className="hero-eyebrow">AI Window Film Visualizer</div>
        <h1>
          See Your Home<br />
          With Window Film
        </h1>
        <p>
          Upload a photo of your house, pick a film, and watch the AI apply it
          instantly — before you commit to anything.
        </p>
      </div>

      <div className="container">
        {/* Step 1 */}
        <div className="step">
          <div className="step-label">Step 1 — Upload Your Photo</div>
          <div
            className={`upload-area${preview ? ' has-photo' : ''}${dragOver ? ' drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !preview && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])}
            />

            {preview ? (
              <>
                <img src={preview} alt="Uploaded house" className="upload-preview" />
                <div className="upload-change-row">
                  <button
                    className="btn-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
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
              <div
                key={film.id}
                className={`film-card${filmId === film.id ? ' selected' : ''}`}
                onClick={() => setFilmId(film.id)}
              >
                <div
                  className="film-swatch"
                  style={{
                    background: film.swatch,
                    borderColor: film.swatchBorder,
                  }}
                />
                <div className="film-card-name">{film.name}</div>
                <div className="film-card-desc">{film.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Apply */}
        <button
          className="apply-btn"
          onClick={handleApply}
          disabled={!photo || !filmId || loading}
        >
          {loading
            ? 'Visualizing…'
            : `Apply Film${selectedFilm ? ` — ${selectedFilm.name}` : ''}`}
        </button>

        {error && (
          <div className="error-box">
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading && (
          <div className="loading">
            <div className="spinner" />
            <div className="loading-title">Visualizing your upgrade…</div>
            <div className="loading-sub">
              AI is applying {selectedFilm?.name} to your windows
            </div>
          </div>
        )}

        {result && (
          <div className="results">
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
              <button className="btn-download" onClick={handleDownload}>
                Download Result
              </button>
              <button
                className="btn-retry"
                onClick={() => {
                  setResult(null);
                  setFilmId(null);
                }}
              >
                Try Another Film
              </button>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="cta" id="consultation">
          <h2>Ready to Transform Your Home?</h2>
          <p>
            Get a free quote and professional installation from our certified team.
            Most installs completed same-day.
          </p>
          {/* Replace the href below with your actual booking URL */}
          <a href="#" className="btn-cta">
            Book a Free Consultation →
          </a>
        </div>
      </div>
    </>
  );
}
