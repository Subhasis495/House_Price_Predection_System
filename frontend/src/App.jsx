import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [fields, setFields] = useState({});
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch dynamic fields configuration from FastAPI
    fetch('https://house-price-predection-system.onrender.com/api/fields')
      .then(res => res.json())
      .then(data => {
        setFields(data.fields);
        // Initialize form data with default values
        const initialForm = {};
        Object.entries(data.fields).forEach(([key, config]) => {
          if (config[1] === 'select') {
            initialForm[key] = config[2][0];
          } else {
            initialForm[key] = '';
          }
        });
        setFormData(initialForm);
      })
      .catch(err => {
        console.error("Failed to load fields from API", err);
        setError("Error connecting to backend API.");
      });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePredict = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    // Format numbers
    const payload = { ...formData };
    Object.keys(payload).forEach(key => {
      payload[key] = String(payload[key]);
    });

    try {
      const resp = await fetch('https://house-price-predection-system.onrender.com/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      
      if (!resp.ok) {
        throw new Error(data.detail || 'Prediction failed');
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="blob-1"></div>
      <div className="blob-2"></div>

      <div className="main-content animate-fade-in">
        {/* Left Form Panel */}
        <div className="glass glass-panel form-section">
          <div className="header">
            <h1>House Price Prediction AI</h1>
            <p>Predict real estate prices using advanced machine learning model</p>
          </div>

          <form onSubmit={handlePredict}>
            <div className="form-grid">
              {Object.entries(fields).map(([key, config]) => {
                const label = config[0];
                const type = config[1];
                const optionsOrRange = config[2];

                return (
                  <div key={key} className="field-group">
                    <label htmlFor={key}>{label}</label>
                    {type === 'select' ? (
                      <select id={key} name={key} value={formData[key] || ''} onChange={handleChange} required>
                        {Array.isArray(optionsOrRange) && optionsOrRange.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="number" 
                        id={key} 
                        name={key}
                        value={formData[key] || ''} 
                        onChange={handleChange} 
                        min={optionsOrRange && optionsOrRange[0]}
                        max={optionsOrRange && optionsOrRange[1]}
                        placeholder={`e.g. 1500`}
                        required 
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <button type="submit" className="btn-primary" disabled={loading || Object.keys(fields).length === 0}>
              {loading ? <div className="spinner"></div> : "Analyze Property"}
            </button>
          </form>
        </div>

        {/* Right Result Panel */}
        <div className="glass glass-panel results-panel">
          {!result && !error && !loading && (
            <div className="placeholder-state animate-fade-in">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <h2>Provide details to get estimate</h2>
            </div>
          )}

          {loading && (
            <div className="placeholder-state animate-fade-in">
              <div className="spinner" style={{width: 48, height: 48, borderColor: 'var(--accent)', borderTopColor: 'transparent'}}></div>
              <h3>Analyzing patterns...</h3>
            </div>
          )}

          {error && (
            <div className="error-message animate-fade-in">
              <strong>Prediction Error:</strong>
              <p>{error}</p>
            </div>
          )}

          {result && !loading && (
            <div className="price-display animate-fade-in">
              <div className="price-label">Estimated Value</div>
              <div className="price-value">{result.price}</div>
              <div className="price-range">Range: {result.range_low} – {result.range_high}</div>
              <p style={{color: 'var(--text-muted)'}}>Confidence intervals generated via trained regression estimates</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
