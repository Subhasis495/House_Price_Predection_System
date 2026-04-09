import os
import json
import warnings
import numpy as np
import pandas as pd
import joblib

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, create_model
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor
import uvicorn

warnings.filterwarnings("ignore")

app = FastAPI(title="House Price Prediction API", description="Unified Backend & Training")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
CSV_PATH = os.path.join(os.path.dirname(__file__), "Housing.csv")

# Global Artifacts
model = None
scaler = None
label_encoders = {}
metrics = {}
FEATURE_NAMES = []
LOG_TRANSFORM = True

FIELD_CONFIG = {
    "area"          : ("Area (sq ft)",         "number", (500, 10000)),
    "bedrooms"      : ("Bedrooms",              "select", [1, 2, 3, 4, 5, 6]),
    "bathrooms"     : ("Bathrooms",             "select", [1, 2, 3, 4, 5]),
    "stories"       : ("Stories / Floors",      "select", [1, 2, 3, 4]),
    "parking"       : ("Parking Spaces",        "select", [0, 1, 2, 3, 4]),
    "mainroad"      : ("Main Road Access",      "select", ["yes", "no"]),
    "guestroom"     : ("Guest Room",            "select", ["yes", "no"]),
    "basement"      : ("Basement",              "select", ["yes", "no"]),
    "hotwaterheating": ("Hot Water Heating",    "select", ["yes", "no"]),
    "airconditioning": ("Air Conditioning",     "select", ["yes", "no"]),
    "prefarea"      : ("Preferred Area",        "select", ["yes", "no"]),
    "furnishingstatus": ("Furnishing Status",   "select", ["furnished", "semi-furnished", "unfurnished"]),
}

# Dynamic Pydantic validation
fields = {k: (str, "0") if v[1] == "select" else (float, 0.0) for k, v in FIELD_CONFIG.items()}
HouseFeatures = create_model("HouseFeatures", **fields)

def train_and_save_model():
    global model, scaler, label_encoders, metrics, FEATURE_NAMES
    print(f"🧠 Starting Model Training Pipeline using '{CSV_PATH}'...")
    if not os.path.exists(CSV_PATH):
        print("❌ Dataset not found! Will try to load existing models.")
        return False
        
    df = pd.read_csv(CSV_PATH)
    target_col = 'price'
    
    df_clean = df.copy()
    cat_cols = df_clean.select_dtypes(include=['object', 'category']).columns.tolist()
    
    for col in cat_cols:
        le = LabelEncoder()
        df_clean[col] = le.fit_transform(df_clean[col].astype(str))
        label_encoders[col] = le
        
    for col in df_clean.columns:
        if df_clean[col].isnull().sum() > 0:
            df_clean[col].fillna(df_clean[col].median(), inplace=True)

    df_feat = df_clean.copy()
    col_lower = {c.lower(): c for c in df_feat.columns}
    area_col  = col_lower.get('area')
    bed_col   = col_lower.get('bedrooms')
    bath_col  = col_lower.get('bathrooms')
    stories_col = col_lower.get('stories')
    parking_col = col_lower.get('parking')

    if area_col:
        df_feat['PricePerSqft_proxy'] = df_feat[area_col] / df_feat[area_col].mean()
    if bed_col and bath_col:
        df_feat['BedBathRatio'] = df_feat[bed_col] / (df_feat[bath_col] + 1)
    if area_col and bed_col:
        df_feat['AreaPerBedroom'] = df_feat[area_col] / (df_feat[bed_col] + 1)
    if parking_col:
        df_feat['HasGarage'] = (df_feat[parking_col] > 0).astype(int)
    if stories_col:
        df_feat['IsMultiStorey'] = (df_feat[stories_col] > 1).astype(int)

    X = df_feat.drop(target_col, axis=1)
    y = df_feat[target_col]
    
    FEATURE_NAMES = X.columns.tolist()
    y_log = np.log1p(y)
    
    X_train, X_test, y_train, y_test = train_test_split(X, y_log, test_size=0.2, random_state=42)
    
    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc = scaler.transform(X_test)
    
    print("⏳ Tuning XGBoost...")
    # Base configuration, enough to improve standard regressions quickly
    xgb = XGBRegressor(random_state=42, n_estimators=200, max_depth=4, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8)
    xgb.fit(X_train_sc, y_train)
    model = xgb
    
    yp_log = model.predict(X_test_sc)
    yp = np.expm1(yp_log)
    ytr_orig = np.expm1(y_test)
    
    mae = mean_absolute_error(ytr_orig, yp)
    rmse = np.sqrt(mean_squared_error(ytr_orig, yp))
    r2 = r2_score(y_test, yp_log)
    
    print(f"✅ Training Complete (R²={r2:.4f}, MAE=${mae:,.0f})")
    
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(model, os.path.join(MODEL_DIR, "model.pkl"))
    joblib.dump(scaler, os.path.join(MODEL_DIR, "scaler.pkl"))
    joblib.dump(label_encoders, os.path.join(MODEL_DIR, "label_encoders.pkl"))
    
    metrics = {
        'model_type': "Tuned XGBoost",
        'r2': round(r2, 4),
        'mae': round(mae, 2),
        'rmse': round(rmse, 2),
        'feature_names': FEATURE_NAMES,
        'log_transform': True,
    }
    with open(os.path.join(MODEL_DIR, "metrics.json"), 'w') as f:
        json.dump(metrics, f, indent=2)
    return True

def load_model_from_disk():
    global model, scaler, label_encoders, metrics, FEATURE_NAMES
    try:
        model = joblib.load(os.path.join(MODEL_DIR, "model.pkl"))
        scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))
        label_encoders = joblib.load(os.path.join(MODEL_DIR, "label_encoders.pkl"))
        with open(os.path.join(MODEL_DIR, "metrics.json")) as f:
            metrics = json.load(f)
        FEATURE_NAMES = metrics.get("feature_names", [])
        print("✅ Models loaded successfully from disk.")
        return True
    except FileNotFoundError:
        return False

@app.on_event("startup")
def startup_event():
    success = load_model_from_disk()
    if not success:
        train_and_save_model()
    else:
        # Fallback to loading existing local artifacts 
        success = load_model_from_disk()
        if not success:
            print("⚠️ No datasets and no trained models found.")

def build_feature_vector(form_data: dict) -> np.ndarray:
    row = {}
    for col in FIELD_CONFIG:
        val = form_data.get(col, 0)
        if col in label_encoders:
            try:
                val = label_encoders[col].transform([str(val)])[0]
            except ValueError:
                val = 0
        else:
            try:
                val = float(val)
            except (ValueError, TypeError):
                val = 0.0
        row[col] = val

    area      = float(row.get("area", 0))
    bedrooms  = float(row.get("bedrooms", 1))
    bathrooms = float(row.get("bathrooms", 1))
    stories   = float(row.get("stories", 1))
    parking   = float(row.get("parking", 0))

    row["BedBathRatio"]    = bedrooms / (bathrooms + 1)
    row["AreaPerBedroom"]  = area / (bedrooms + 1)
    row["HasGarage"]       = int(parking > 0)
    row["IsMultiStorey"]   = int(stories > 1)
    row["PricePerSqft_proxy"] = area / 2000.0

    x = np.array([row.get(f, 0) for f in FEATURE_NAMES], dtype=float).reshape(1, -1)
    if scaler is not None:
        x = scaler.transform(x)
    return x

@app.get("/")
def read_root():
    return {"message": "House Price Prediction Backend is Online."}

@app.get("/api/fields")
def get_fields():
    return {"fields": FIELD_CONFIG}

@app.get("/api/metrics")
def get_metrics():
    return metrics

@app.post("/predict")
def predict_price(features: HouseFeatures):
    if model is None:
        raise HTTPException(status_code=500, detail="Model artifacts not generated.")
    try:
        form_data = features.dict()
        x = build_feature_vector(form_data)
        y_log = model.predict(x)[0]
        price = float(np.expm1(y_log)) if LOG_TRANSFORM else float(y_log)
        price = round(price, 2)
        return {
            "success": True,
            "price": f"${price:,.0f}",
            "range_low": f"${price * 0.90:,.0f}",
            "range_high": f"${price * 1.10:,.0f}",
            "raw": price
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)
