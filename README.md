# 🏠 House Price Prediction System

An end-to-end Machine Learning project that predicts house sale prices, complete with an automated training pipeline, a **FastAPI** backend, and a stunning **React** (Vite) frontend.

---

## 📁 Project Structure

```
ML_Project/
├── app.py                             ← Unified FastAPI Application & Model Training Pipeline
├── Housing.csv                        ← Local Dataset
├── models/                            ← Automatically generated trained artifacts
│   ├── model.pkl
│   ├── scaler.pkl
│   ├── label_encoders.pkl
│   └── metrics.json
├── frontend/                          ← Vite React Web Application
│   ├── src/
│   │   ├── App.jsx                    ← Dynamic React Form communicating with API
│   │   ├── App.css                    ← Responsive layout styling
│   │   └── index.css                  ← Glassmorphism & dark-mode themes
│   └── package.json
├── requirements.txt                   ← Python backend dependencies
└── README.md
```

---

## 🚀 How to Run the Project

You must run both the **Backend API** and the **React Frontend** simultaneously in two separate terminal windows.

### Terminal 1: Start the FastAPI Backend & Train Model

The backend is configured to automatically parse `Housing.csv` and train an XGBoost model on startup.

1. **Activate the local virtual environment** (Windows):
   ```powershell
   .\venv\Scripts\activate
   ```
2. **Install Python dependencies**:
   ```powershell
   pip install -r requirements.txt
   ```
3. **Start the server**:
   ```powershell
   python app.py
   ```
   *The model will train instantly, and the API will be available at: **http://localhost:5000***  
   *(You can visit `http://localhost:5000/docs` to see the interactive API documentation).*

### Terminal 2: Start the React Frontend

The beautifully designed user interface connects directly to your backend predictions.

1. **Navigate into the frontend directory**:
   ```powershell
   cd frontend
   ```
2. **Install Node.js dependencies**:
   ```powershell
   npm install
   ```
3. **Start the Vite Development Server**:
   ```powershell
   npm run dev
   ```
   *The web application will open in your browser automatically, or you can visit: **http://localhost:5173***

---

## 🧠 ML Pipeline Summary

- **Auto-Training**: If `Housing.csv` is found in the project root, `app.py` trains the model automatically on startup.
- **Algorithm**: `XGBRegressor` with `GridSearchCV` style tuned hyperparameters.
- **Feature Engineering**: Calculates BedBathRatio, AreaPerBedroom, HasGarage, IsMultiStorey, and more.
- **Preprocessing**: `LabelEncoding` for categorical strings, median computational fill for missing values, and `StandardScaler` for numeric scaling.
