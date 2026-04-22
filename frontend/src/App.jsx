import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [fields, setFields] = useState({});
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // New states for Currency, Asking Price, and EMI
  const [currency, setCurrency] = useState('USD');
  const [askingPrice, setAskingPrice] = useState('');
  const [loanTerm, setLoanTerm] = useState(20);
  const [interestRate, setInterestRate] = useState(7.0);

  const exchangeRate = 83.5; // Fixed exchange rate for demo

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

  const formatCurrency = (value) => {
    if (currency === 'INR') {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
      }).format(value * exchangeRate);
    } else {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(value);
    }
  };

  const getDealBadge = () => {
    if (!result || !askingPrice || isNaN(askingPrice)) return null;
    
    // Value relative to target display currency
    const targetVal = currency === 'INR' ? result.raw * exchangeRate : result.raw;
    const askingVal = parseFloat(askingPrice);
    
    if (askingVal < targetVal * 0.95) return { text: "🎉 Great Deal", className: "badge-success" };
    if (askingVal > targetVal * 1.05) return { text: "⚠️ Overpriced", className: "badge-danger" };
    return { text: "🤝 Fair Price", className: "badge-warning" };
  };

  const calculateEMI = () => {
    if (!result) return 0;
    const principal = currency === 'INR' ? result.raw * exchangeRate : result.raw;
    const r = (parseFloat(interestRate) / 100) / 12;
    const n = parseFloat(loanTerm) * 12;
    
    if (!principal || !r || !n || n <= 0) return 0;
    
    const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return emi;
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
          
          {/* Top Bar for settings (Currency toggle) */}
          <div className="settings-bar">
             <div className="currency-toggle">
               <span className={currency === 'USD' ? 'active' : ''} onClick={() => setCurrency('USD')}>USD $</span>
               <div className={`switch-track ${currency}`} onClick={() => setCurrency(currency === 'USD' ? 'INR' : 'USD')}>
                  <div className="switch-thumb"></div>
               </div>
               <span className={currency === 'INR' ? 'active' : ''} onClick={() => setCurrency('INR')}>INR ₹</span>
             </div>
          </div>

          {!result && !error && !loading && (
            <div className="placeholder-state animate-fade-in" style={{marginTop: 'auto', marginBottom: 'auto'}}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <h2>Provide details to get estimate</h2>
            </div>
          )}

          {loading && (
            <div className="placeholder-state animate-fade-in" style={{marginTop: 'auto', marginBottom: 'auto'}}>
              <div className="spinner" style={{width: 48, height: 48, borderColor: 'var(--accent)', borderTopColor: 'transparent'}}></div>
              <h3>Analyzing patterns...</h3>
            </div>
          )}

          {error && (
            <div className="error-message animate-fade-in" style={{marginTop: 'auto', marginBottom: 'auto'}}>
              <strong>Prediction Error:</strong>
              <p>{error}</p>
            </div>
          )}

          {result && !loading && (
            <div className="result-content-container animate-fade-in">
              <div className="price-display">
                <div className="price-label">Estimated Value</div>
                <div className="price-value">{formatCurrency(result.raw)}</div>
                <div className="price-range">Range: {formatCurrency(result.raw * 0.90)} – {formatCurrency(result.raw * 1.10)}</div>
              </div>

              {/* Extras Container */}
              <div className="analysis-extras">
                 {/* Deal Analyzer */}
                 <div className="extra-box deal-analyzer">
                    <label>Compare Asking Price</label>
                    <div className="input-with-badge">
                      <div className="currency-input-wrapper">
                         <span>{currency === 'USD' ? '$' : '₹'}</span>
                         <input 
                           type="number" 
                           value={askingPrice} 
                           onChange={(e) => setAskingPrice(e.target.value)}
                           placeholder="0" 
                         />
                      </div>
                      {getDealBadge() && (
                        <div className={`deal-badge ${getDealBadge().className}`}>
                          {getDealBadge().text}
                        </div>
                      )}
                    </div>
                 </div>

                 {/* EMI Calculator */}
                 <div className="extra-box emi-calculator">
                    <div className="emi-header">
                       <label>Mortgage / EMI Calculator</label>
                       <div className="emi-result">{formatCurrency(calculateEMI())} <span>/ mo</span></div>
                    </div>
                    <div className="emi-controls">
                       <div className="emi-input">
                         <label>Term (Years)</label>
                         <input type="number" min="1" max="40" value={loanTerm} onChange={(e) => setLoanTerm(e.target.value)} />
                       </div>
                       <div className="emi-input">
                         <label>Rate (%)</label>
                         <input type="number" step="0.1" min="0" max="25" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
