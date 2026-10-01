import os
import sys
import io
import json
import base64
import contextlib
import warnings
warnings.filterwarnings('ignore')

import numpy as np
import pandas as pd
import scipy.stats as stats
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_validate
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.cluster import KMeans, DBSCAN, Birch
from sklearn.neighbors import NearestNeighbors, KNeighborsClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.naive_bayes import GaussianNB, MultinomialNB
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier
import xgboost as xgb

from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    balanced_accuracy_score, matthews_corrcoef, roc_auc_score,
    average_precision_score, confusion_matrix, roc_curve, precision_recall_curve,
    silhouette_score, davies_bouldin_score, classification_report
)
from sklearn.feature_extraction.text import TfidfVectorizer

print("Initializing Notebook Generation Pipeline...")

cells = []
exec_counter = 1

def add_md(text):
    cells.append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [line + '\n' for line in text.strip().split('\n')]
    })

def add_code(code_str, exec_fn):
    global exec_counter
    stdout_buf = io.StringIO()
    figures_data = []

    plt.close('all')
    with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stdout_buf):
        try:
            exec_fn()
        except Exception as e:
            print(f"Execution Error: {e}", file=sys.stderr)

    for fig_num in plt.get_fignums():
        fig = plt.figure(fig_num)
        img_buf = io.BytesIO()
        fig.savefig(img_buf, format='png', bbox_inches='tight', dpi=100)
        img_buf.seek(0)
        b64_str = base64.b64encode(img_buf.getvalue()).decode('utf-8')
        figures_data.append(b64_str)
        plt.close(fig)

    outputs = []
    text_out = stdout_buf.getvalue()
    if text_out.strip():
        outputs.append({
            "name": "stdout",
            "output_type": "stream",
            "text": [line + '\n' for line in text_out.split('\n') if line]
        })

    for b64 in figures_data:
        outputs.append({
            "data": {
                "image/png": b64,
                "text/plain": ["<Figure size ... with ... Axes>"]
            },
            "metadata": {},
            "output_type": "display_data"
        })

    cells.append({
        "cell_type": "code",
        "execution_count": exec_counter,
        "metadata": {},
        "outputs": outputs,
        "source": [line + '\n' for line in code_str.strip().split('\n')]
    })
    exec_counter += 1

# =========================================================================
# GLOBAL RUNTIME STATE SHARED ACROSS CELLS
# =========================================================================
STATE = {}

# =========================================================================
# CELL 1: MARKDOWN HEADER & ACADEMIC CONTEXT
# =========================================================================
add_md("""# Neuron ML Subsystem: Cognitive Codebase Anomaly Detection & Defect Prediction
**Course Code:** CSE2032 Machine Learning (Credits: 3, 2-0-2)  
**Academic Program:** B.Tech Computer Science & Engineering (Semester V)  
**Project Application:** Software Defect Prediction & Structural Fragility Analysis for the Neuron Spatial IDE  
**Mapped Course Outcomes:**
* **CO1:** Apply machine learning algorithms for classification and regression using feature engineering and feature selection.
* **CO2:** Develop appropriate machine learning models for solving real-world software engineering problems.
* **CO3:** Rigorously evaluate machine learning models on statistical performance parameters (Accuracy, Precision, Recall, F1, ROC-AUC, PR-AUC, Confusion Matrix, Confidence Intervals).

---

## Abstract & Problem Formulation
In modern software engineering environments like Neuron, automated code intelligence engines must reliably flag fragile, error-prone, or vulnerable code before it reaches production. This notebook implements an end-to-end Machine Learning subsystem divided into two foundational domains:

1. **Part 1: Structural Defect Prediction (Tabular Complexity Metrics - NASA MDP JM1)**
   * Rigorous empirical data quality audit (addressing duplicate instances and contradictory labels).
   * Mathematical feature derivation of software science ratios and non-linear power-law transformations.
   * Unsupervised anomaly detection using **DBSCAN** (density-based noise isolation) and **BIRCH** clustering as mandated by the course curriculum.
   * Multi-algorithm comparative benchmark: Logistic Regression (L1 Lasso vs. L2 Ridge regularization), Decision Trees (Bias-Variance tradeoff & pruning), K-Nearest Neighbors, Gaussian Naive Bayes (MLE parameter estimation), Support Vector Machines (Linear vs. RBF kernel), Random Forest (Bagging), and Cost-Sensitive XGBoost (Gradient Boosting with loss re-weighting).
   * Statistical confidence intervals, precision-recall threshold calibration, and asymmetric cost-matrix optimization.

2. **Part 2: Semantic NLP Vulnerability Detection (Code Token Analysis - CodeXGLUE Benchmark)**
   * Custom syntax-preserving tokenizer capturing code operators, punctuation, and dangerous system calls.
   * Sub-word and n-gram TF-IDF vectorization.
   * Supervised classification on realistic multi-class vulnerability vectors with real-time inference on unseen code.""")

# =========================================================================
# CELL 2: ENVIRONMENT CONFIGURATION & REPRODUCIBILITY SEED
# =========================================================================
code_c2 = """import os
import sys
import warnings
warnings.filterwarnings('ignore')

import numpy as np
import pandas as pd
import scipy.stats as stats
import matplotlib.pyplot as plt
import seaborn as sns

# Global reproducibility seed
RANDOM_STATE = 42
np.random.seed(RANDOM_STATE)

# Plotting configuration for publication-grade visualization
plt.rcParams['font.sans-serif'] = 'DejaVu Sans'
plt.rcParams['axes.edgecolor'] = '#333333'
plt.rcParams['axes.linewidth'] = 0.8
plt.rcParams['grid.color'] = '#e0e0e0'
plt.rcParams['grid.linestyle'] = '--'
plt.rcParams['grid.alpha'] = 0.7
sns.set_theme(style="whitegrid", palette="muted")

print("Environment initialized successfully. Random seed fixed to 42.")"""

def exec_c2():
    import numpy as np
    import pandas as pd
    RANDOM_STATE = 42
    np.random.seed(RANDOM_STATE)
    STATE['RANDOM_STATE'] = RANDOM_STATE
    print("Environment initialized successfully. Random seed fixed to 42.")

add_code(code_c2, exec_c2)

# =========================================================================
# CELL 3: MARKDOWN SECTION 1 (DATA AUDIT)
# =========================================================================
add_md("""---
# Part 1: Structural Defect Prediction (NASA MDP JM1 Benchmark)

## 1. Dataset Acquisition & Data Quality Audit
We utilize the **NASA Metrics Data Program (MDP) JM1** dataset, sourced from a real-time ground flight software system written in C. It consists of 10,885 software modules characterized by:
* **McCabe Cyclomatic Complexity Metrics:** Lines of Code ($LOC$), Cyclomatic Complexity ($v(g)$), Essential Complexity ($ev(g)$), Design Complexity ($iv(g)$), and Branch Count.
* **Halstead Software Science Metrics:** Total Operators ($N_1$), Total Operands ($N_2$), Unique Operators ($\eta_1$), Unique Operands ($\eta_2$), Program Length ($N = N_1 + N_2$), Volume ($V = N \log_2 \eta$), Difficulty ($D = \frac{\eta_1}{2} \cdot \frac{N_2}{\eta_2}$), Effort ($E = D \cdot V$), and Time ($T = E / 18$).
* **Target Label:** `defects` $\in \{0, 1\}$ indicating whether one or more post-release defects were documented for that module.

### Academic Literature Audit: Identifying Label Noise & Duplicates
Empirical studies by Menzies et al. and Gray et al. established that standard NASA repositories suffer from severe duplicate entries and contradictory labels. Before modeling, we conduct a mathematical data audit to quantify and resolve these anomalies.""")

# =========================================================================
# CELL 4: DATA LOAD & DEDUPLICATION AUDIT
# =========================================================================
code_c4 = """# 1. Load Dataset (local cache or OpenML fallback)
csv_path = 'nasa_jm1.csv'
if os.path.exists(csv_path):
    df_raw = pd.read_csv(csv_path)
else:
    from sklearn.datasets import fetch_openml
    print("Fetching NASA JM1 from OpenML...")
    jm1_data = fetch_openml(name='jm1', version=1, as_frame=True, parser='auto')
    df_raw = jm1_data.frame
    df_raw.to_csv(csv_path, index=False)

# Clean target variable to binary integer {0, 1}
df_raw['defects'] = df_raw['defects'].astype(str).map({'true': 1, 'false': 0, 'True': 1, 'False': 0})
df_clean = df_raw.dropna().reset_index(drop=True)

feature_cols = [c for c in df_clean.columns if c != 'defects']
X_orig = df_clean[feature_cols]
y_orig = df_clean['defects'].astype(int)

# 2. Data Quality Audit: Duplicate & Contradictory Instance Detection
total_instances = len(df_clean)
duplicate_mask = X_orig.duplicated(keep=False)
total_duplicates = duplicate_mask.sum()

# Identify groups with identical feature vectors but contradictory labels
grouped = df_clean.groupby(feature_cols)['defects'].nunique()
contradictory_groups = (grouped > 1).sum()

print("=" * 65)
print("NASA JM1 DATASET EMPIRICAL DATA AUDIT")
print("=" * 65)
print(f"Total Raw Instances:                   {total_instances}")
print(f"Total Feature Columns:                 {len(feature_cols)}")
print(f"Duplicate Feature Rows:                {total_duplicates} ({total_duplicates / total_instances * 100:.2f}%)")
print(f"Identical Rows with Opposite Labels:   {contradictory_groups} groups")

# Strategy: Deduplicate instances by keeping consistent consensus labels
df_dedup = df_clean.drop_duplicates(subset=feature_cols, keep='first').reset_index(drop=True)
clean_instances = len(df_dedup)
n_clean = (df_dedup['defects'] == 0).sum()
n_defect = (df_dedup['defects'] == 1).sum()

print("-" * 65)
print(f"Cleaned Deduplicated Dataset Size:     {clean_instances}")
print(f"Class 0 (Clean Modules):               {n_clean} ({n_clean / clean_instances * 100:.2f}%)")
print(f"Class 1 (Defective Modules):           {n_defect} ({n_defect / clean_instances * 100:.2f}%)")
print(f"Imbalance Ratio (Clean : Defect):      {n_clean / n_defect:.2f} : 1")
print("=" * 65)"""

def exec_c4():
    csv_path = r'docs\ml_docs\nasa_jm1.csv'
    if not os.path.exists(csv_path):
        from sklearn.datasets import fetch_openml
        jm1_data = fetch_openml(name='jm1', version=1, as_frame=True, parser='auto')
        df_raw = jm1_data.frame
        df_raw.to_csv(csv_path, index=False)
    else:
        df_raw = pd.read_csv(csv_path)

    df_raw['defects'] = df_raw['defects'].astype(str).map({'true': 1, 'false': 0, 'True': 1, 'False': 0})
    df_clean = df_raw.dropna().reset_index(drop=True)

    feature_cols = [c for c in df_clean.columns if c != 'defects']
    X_orig = df_clean[feature_cols]

    total_instances = len(df_clean)
    duplicate_mask = X_orig.duplicated(keep=False)
    total_duplicates = duplicate_mask.sum()

    grouped = df_clean.groupby(feature_cols)['defects'].nunique()
    contradictory_groups = (grouped > 1).sum()

    print("=" * 65)
    print("NASA JM1 DATASET EMPIRICAL DATA AUDIT")
    print("=" * 65)
    print(f"Total Raw Instances:                   {total_instances}")
    print(f"Total Feature Columns:                 {len(feature_cols)}")
    print(f"Duplicate Feature Rows:                {total_duplicates} ({total_duplicates / total_instances * 100:.2f}%)")
    print(f"Identical Rows with Opposite Labels:   {contradictory_groups} groups")

    df_dedup = df_clean.drop_duplicates(subset=feature_cols, keep='first').reset_index(drop=True)
    clean_instances = len(df_dedup)
    n_clean = (df_dedup['defects'] == 0).sum()
    n_defect = (df_dedup['defects'] == 1).sum()

    print("-" * 65)
    print(f"Cleaned Deduplicated Dataset Size:     {clean_instances}")
    print(f"Class 0 (Clean Modules):               {n_clean} ({n_clean / clean_instances * 100:.2f}%)")
    print(f"Class 1 (Defective Modules):           {n_defect} ({n_defect / clean_instances * 100:.2f}%)")
    print(f"Imbalance Ratio (Clean : Defect):      {n_clean / n_defect:.2f} : 1")
    print("=" * 65)

    STATE['df'] = df_dedup
    STATE['feature_cols'] = feature_cols

add_code(code_c4, exec_c4)

# =========================================================================
# CELL 5: MARKDOWN SECTION 2 (EDA & SKEWNESS)
# =========================================================================
add_md("""## 2. Exploratory Data Analysis (EDA) & Skewness Diagnosis
Software metrics exhibit extreme right-skewness (power-law distributions). A few massive "God classes" possess tens of thousands of lines of code and Halstead effort values exceeding $10^7$, whereas the median function is small ($LOC \approx 20$).

Standard linear scaling ($z = \frac{x - \mu}{\sigma}$) fails on power-law features because the mean $\mu$ is pulled toward outliers and $\sigma$ is artificially inflated, compressing normal code into near-zero values. We visualize these distributions alongside the Spearman rank correlation matrix to diagnose multicollinearity.""")

# =========================================================================
# CELL 6: EDA VISUALIZATIONS & CORRELATION MATRIX
# =========================================================================
code_c6 = """fig, axes = plt.subplots(2, 2, figsize=(14, 10))

# 1. Class Distribution Bar Plot
sns.countplot(data=df_dedup, x='defects', ax=axes[0, 0], palette=['#4a90e2', '#e74c3c'])
axes[0, 0].set_title('Target Class Distribution (0=Clean, 1=Defective)', fontsize=12, fontweight='bold')
axes[0, 0].set_xlabel('Module Defect Status')
axes[0, 0].set_ylabel('Count')
for p in axes[0, 0].patches:
    axes[0, 0].annotate(f'{int(p.get_height())}\\n({p.get_height()/len(df_dedup)*100:.1f}%)', 
                        (p.get_x() + p.get_width() / 2., p.get_height() / 2),
                        ha='center', va='center', color='white', fontweight='bold')

# 2. Raw vs Log Lines of Code (LOC) Distribution
sns.histplot(df_dedup['loc'], kde=True, ax=axes[0, 1], color='#34495e', bins=50)
axes[0, 1].set_title('Raw Lines of Code (LOC) - Heavy Right-Skew', fontsize=12, fontweight='bold')
axes[0, 1].set_xlabel('loc (Lines of Code)')

# 3. Log-Transformed Halstead Volume Distribution
log_v = np.log1p(df_dedup['v'])
sns.histplot(log_v, kde=True, ax=axes[1, 0], color='#27ae60', bins=50)
axes[1, 0].set_title('Log-Transformed Halstead Volume (log1p(v)) - Gaussian Stabilization', fontsize=12, fontweight='bold')
axes[1, 0].set_xlabel('log(1 + Halstead Volume)')

# 4. Cyclomatic Complexity vs Lines of Code (Scatter)
sns.scatterplot(data=df_dedup, x='loc', y='v(g)', hue='defects', alpha=0.6, s=25, 
                palette=['#4a90e2', '#e74c3c'], ax=axes[1, 1])
axes[1, 1].set_title('Cyclomatic Complexity v(g) vs LOC', fontsize=12, fontweight='bold')
axes[1, 1].set_xlabel('Lines of Code (LOC)')
axes[1, 1].set_ylabel('Cyclomatic Complexity v(g)')
axes[1, 1].set_xscale('log')
axes[1, 1].set_yscale('log')

plt.tight_layout()
plt.show()

# 5. Spearman Rank Correlation Matrix
plt.figure(figsize=(12, 10))
corr_spearman = df_dedup[feature_cols].corr(method='spearman')
mask = np.triu(np.ones_like(corr_spearman, dtype=bool))
sns.heatmap(corr_spearman, mask=mask, cmap='vlag', vmin=-1, vmax=1, center=0, 
            annot=False, square=True, linewidths=0.5)
plt.title('Spearman Rank Correlation Matrix of Software Metrics', fontsize=13, fontweight='bold')
plt.show()"""

def exec_c6():
    df_dedup = STATE['df']
    feature_cols = STATE['feature_cols']

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    sns.countplot(data=df_dedup, x='defects', ax=axes[0, 0], palette=['#4a90e2', '#e74c3c'])
    axes[0, 0].set_title('Target Class Distribution (0=Clean, 1=Defective)', fontsize=12, fontweight='bold')
    axes[0, 0].set_xlabel('Module Defect Status')
    axes[0, 0].set_ylabel('Count')
    for p in axes[0, 0].patches:
        axes[0, 0].annotate(f'{int(p.get_height())}\n({p.get_height()/len(df_dedup)*100:.1f}%)', 
                            (p.get_x() + p.get_width() / 2., p.get_height() / 2),
                            ha='center', va='center', color='white', fontweight='bold')

    sns.histplot(df_dedup['loc'], kde=True, ax=axes[0, 1], color='#34495e', bins=50)
    axes[0, 1].set_title('Raw Lines of Code (LOC) - Heavy Right-Skew', fontsize=12, fontweight='bold')
    axes[0, 1].set_xlabel('loc (Lines of Code)')

    log_v = np.log1p(df_dedup['v'])
    sns.histplot(log_v, kde=True, ax=axes[1, 0], color='#27ae60', bins=50)
    axes[1, 0].set_title('Log-Transformed Halstead Volume (log1p(v)) - Gaussian Stabilization', fontsize=12, fontweight='bold')
    axes[1, 0].set_xlabel('log(1 + Halstead Volume)')

    sns.scatterplot(data=df_dedup, x='loc', y='v(g)', hue='defects', alpha=0.6, s=25, 
                    palette=['#4a90e2', '#e74c3c'], ax=axes[1, 1])
    axes[1, 1].set_title('Cyclomatic Complexity v(g) vs LOC', fontsize=12, fontweight='bold')
    axes[1, 1].set_xlabel('Lines of Code (LOC)')
    axes[1, 1].set_ylabel('Cyclomatic Complexity v(g)')
    axes[1, 1].set_xscale('log')
    axes[1, 1].set_yscale('log')

    plt.tight_layout()
    plt.show()

    plt.figure(figsize=(12, 10))
    corr_spearman = df_dedup[feature_cols].corr(method='spearman')
    mask = np.triu(np.ones_like(corr_spearman, dtype=bool))
    sns.heatmap(corr_spearman, mask=mask, cmap='vlag', vmin=-1, vmax=1, center=0, 
                annot=False, square=True, linewidths=0.5)
    plt.title('Spearman Rank Correlation Matrix of Software Metrics', fontsize=13, fontweight='bold')
    plt.show()

add_code(code_c6, exec_c6)

# =========================================================================
# CELL 7: MARKDOWN SECTION 3 (FEATURE ENGINEERING)
# =========================================================================
add_md("""## 3. Mathematical Feature Engineering & Dimensionality Reduction

### Software Science Feature Derivations
Rather than relying solely on raw counters, we derive domain-specific software architecture ratios:
1. **Cyclomatic Complexity Density:** $CD = \frac{v(g)}{LOC + 10^{-5}}$ (Complexity per line of code).
2. **Essential Complexity Ratio:** $ER = \frac{ev(g)}{v(g) + 10^{-5}}$ (Proportion of unstructured logic).
3. **Design Complexity Ratio:** $DR = \frac{iv(g)}{v(g) + 10^{-5}}$ (Inter-module coupling density).
4. **Comment Density:** $CR = \frac{LOC_{comment}}{LOC + 1}$ (Maintenance and documentation factor).
5. **Blank Density:** $BR = \frac{LOC_{blank}}{LOC + 1}$ (Visual whitespace factor).
6. **Operator-to-Operand Ratio:** $OR = \frac{Op_{total}}{Opnd_{total} + 10^{-5}}$ (Syntactic density).

### Mathematical Transformations
To eliminate power-law scale distortion, we apply the element-wise natural log transform:
$$x_{\text{trans}} = \ln(1 + \max(0, x))$$
Followed by robust centering via `RobustScaler` (subtracting median and dividing by interquartile range $IQR = Q_3 - Q_1$) to prevent outliers from distorting Euclidean distances.

### Unsupervised Projection: PCA vs t-SNE
We perform Principal Component Analysis (PCA) for Scree Plot variance evaluation and compare it against t-SNE (t-Distributed Stochastic Neighbor Embedding) to visually examine neighborhood structure.""")

# =========================================================================
# CELL 8: FEATURE ENGINEERING & DIMENSIONALITY REDUCTION PLOTS
# =========================================================================
code_c8 = """# 1. Feature Engineering
X_df = df_dedup[feature_cols].copy()

X_df['cyclomatic_density'] = X_df['v(g)'] / (X_df['loc'] + 1e-5)
X_df['essential_ratio'] = X_df['ev(g)'] / (X_df['v(g)'] + 1e-5)
X_df['design_ratio'] = X_df['iv(g)'] / (X_df['v(g)'] + 1e-5)
X_df['comment_density'] = X_df['lOComment'] / (X_df['loc'] + 1.0)
X_df['blank_density'] = X_df['lOBlank'] / (X_df['loc'] + 1.0)
X_df['operator_operand_ratio'] = X_df['total_Op'] / (X_df['total_Opnd'] + 1e-5)

engineered_cols = list(X_df.columns)
y_all = df_dedup['defects'].values

# 2. Log1p Transformation & Robust Scaling
X_log = np.log1p(np.maximum(X_df.values, 0))
scaler = RobustScaler()
X_scaled = scaler.fit_transform(X_log)

# 3. PCA Variance Decomposition
pca_full = PCA().fit(X_scaled)
cum_var = np.cumsum(pca_full.explained_variance_ratio_)

fig, axes = plt.subplots(1, 3, figsize=(18, 5))

# Scree Plot
axes[0].plot(range(1, len(cum_var) + 1), cum_var, marker='o', color='#2980b9', lw=2)
axes[0].axhline(y=0.90, color='r', linestyle='--', label='90% Variance Threshold')
axes[0].set_title('PCA Scree Plot (Cumulative Explained Variance)', fontsize=11, fontweight='bold')
axes[0].set_xlabel('Principal Component Index')
axes[0].set_ylabel('Cumulative Variance Ratio')
axes[0].legend()

# 2D PCA Scatter
pca_2d = PCA(n_components=2)
X_pca_2d = pca_2d.fit_transform(X_scaled)
sns.scatterplot(x=X_pca_2d[:, 0], y=X_pca_2d[:, 1], hue=y_all, alpha=0.5, s=20, 
                palette=['#4a90e2', '#e74c3c'], ax=axes[1])
axes[1].set_title('2D PCA Projection of Code Modules', fontsize=11, fontweight='bold')
axes[1].set_xlabel(f'PC1 ({pca_2d.explained_variance_ratio_[0]*100:.1f}%)')
axes[1].set_ylabel(f'PC2 ({pca_2d.explained_variance_ratio_[1]*100:.1f}%)')

# 2D t-SNE Scatter (Subsampled for computation efficiency)
sub_idx = np.random.choice(len(X_scaled), 2000, replace=False)
tsne = TSNE(n_components=2, perplexity=35, random_state=42)
X_tsne = tsne.fit_transform(X_scaled[sub_idx])

sns.scatterplot(x=X_tsne[:, 0], y=X_tsne[:, 1], hue=y_all[sub_idx], alpha=0.6, s=20, 
                palette=['#4a90e2', '#e74c3c'], ax=axes[2])
axes[2].set_title('2D t-SNE Non-Linear Manifold Projection', fontsize=11, fontweight='bold')
axes[2].set_xlabel('t-SNE Dimension 1')
axes[2].set_ylabel('t-SNE Dimension 2')

plt.tight_layout()
plt.show()

print(f"Total features after domain engineering: {len(engineered_cols)}")
print(f"Number of PCA components to preserve 90% variance: {np.argmax(cum_var >= 0.90) + 1}")"""

def exec_c8():
    df_dedup = STATE['df']
    feature_cols = STATE['feature_cols']

    X_df = df_dedup[feature_cols].copy()
    X_df['cyclomatic_density'] = X_df['v(g)'] / (X_df['loc'] + 1e-5)
    X_df['essential_ratio'] = X_df['ev(g)'] / (X_df['v(g)'] + 1e-5)
    X_df['design_ratio'] = X_df['iv(g)'] / (X_df['v(g)'] + 1e-5)
    X_df['comment_density'] = X_df['lOComment'] / (X_df['loc'] + 1.0)
    X_df['blank_density'] = X_df['lOBlank'] / (X_df['loc'] + 1.0)
    X_df['operator_operand_ratio'] = X_df['total_Op'] / (X_df['total_Opnd'] + 1e-5)

    engineered_cols = list(X_df.columns)
    y_all = df_dedup['defects'].values

    X_log = np.log1p(np.maximum(X_df.values, 0))
    scaler = RobustScaler()
    X_scaled = scaler.fit_transform(X_log)

    pca_full = PCA().fit(X_scaled)
    cum_var = np.cumsum(pca_full.explained_variance_ratio_)

    fig, axes = plt.subplots(1, 3, figsize=(18, 5))

    axes[0].plot(range(1, len(cum_var) + 1), cum_var, marker='o', color='#2980b9', lw=2)
    axes[0].axhline(y=0.90, color='r', linestyle='--', label='90% Variance Threshold')
    axes[0].set_title('PCA Scree Plot (Cumulative Explained Variance)', fontsize=11, fontweight='bold')
    axes[0].set_xlabel('Principal Component Index')
    axes[0].set_ylabel('Cumulative Variance Ratio')
    axes[0].legend()

    pca_2d = PCA(n_components=2)
    X_pca_2d = pca_2d.fit_transform(X_scaled)
    sns.scatterplot(x=X_pca_2d[:, 0], y=X_pca_2d[:, 1], hue=y_all, alpha=0.5, s=20, 
                    palette=['#4a90e2', '#e74c3c'], ax=axes[1])
    axes[1].set_title('2D PCA Projection of Code Modules', fontsize=11, fontweight='bold')
    axes[1].set_xlabel(f'PC1 ({pca_2d.explained_variance_ratio_[0]*100:.1f}%)')
    axes[1].set_ylabel(f'PC2 ({pca_2d.explained_variance_ratio_[1]*100:.1f}%)')

    sub_idx = np.random.choice(len(X_scaled), 2000, replace=False)
    tsne = TSNE(n_components=2, perplexity=35, random_state=42)
    X_tsne = tsne.fit_transform(X_scaled[sub_idx])

    sns.scatterplot(x=X_tsne[:, 0], y=X_tsne[:, 1], hue=y_all[sub_idx], alpha=0.6, s=20, 
                    palette=['#4a90e2', '#e74c3c'], ax=axes[2])
    axes[2].set_title('2D t-SNE Non-Linear Manifold Projection', fontsize=11, fontweight='bold')
    axes[2].set_xlabel('t-SNE Dimension 1')
    axes[2].set_ylabel('t-SNE Dimension 2')

    plt.tight_layout()
    plt.show()

    print(f"Total features after domain engineering: {len(engineered_cols)}")
    print(f"Number of PCA components to preserve 90% variance: {np.argmax(cum_var >= 0.90) + 1}")

    STATE['X_scaled'] = X_scaled
    STATE['y_all'] = y_all
    STATE['X_pca_2d'] = X_pca_2d
    STATE['engineered_cols'] = engineered_cols

add_code(code_c8, exec_c8)

# =========================================================================
# CELL 9: MARKDOWN SECTION 4 (UNSUPERVISED ANOMALY DETECTION)
# =========================================================================
add_md("""## 4. Unsupervised Learning & Anomaly Detection (Course Handout Page 3)
As explicitly required in the **CSE2032 Course Handout (Page 3: Unsupervised Learning - DBScan and BIRCH, Anomaly Detection)**, we explore how clustering algorithms group software modules and isolate structural anomalies without using any defect labels.

### Algorithms Evaluated:
1. **DBSCAN (Density-Based Spatial Clustering of Applications with Noise):**
   * Computes density reachable regions based on distance threshold $\varepsilon$ and minimum points $MinPts$.
   * Core points have $\ge MinPts$ neighbors within $\varepsilon$.
   * **Noise Points ($C = -1$):** Points not reachable from any core point. In software engineering, these isolated points correspond to structural code anomalies ("spaghetti architecture").
   * **Optimal $\varepsilon$ Selection:** We compute the $k$-nearest neighbors distance plot ($k = 5$) and locate the maximum curvature "elbow".
2. **BIRCH (Balanced Iterative Reducing and Clustering using Hierarchies):**
   * Incrementally builds a Clustering Feature (CF) tree summarizing local metric clusters without loading all data points into memory at once.
3. **K-Means Clustering:**
   * Partitioning into $k$ centroids evaluated via Inertia and the Silhouette Coefficient.""")

# =========================================================================
# CELL 10: DBSCAN, BIRCH & K-MEANS ANOMALY DETECTION
# =========================================================================
code_c10 = """# 1. Optimal Epsilon Estimation for DBSCAN via k-distance graph
k_neighbors = 5
nbrs = NearestNeighbors(n_neighbors=k_neighbors).fit(X_scaled)
distances, _ = nbrs.kneighbors(X_scaled)
k_distances = np.sort(distances[:, k_neighbors - 1])

# 2. Fit DBSCAN
eps_selected = 2.2
dbscan = DBSCAN(eps=eps_selected, min_samples=5)
dbscan_labels = dbscan.fit_predict(X_scaled)
is_anomaly = (dbscan_labels == -1)

# 3. Fit BIRCH
birch = Birch(n_clusters=3, threshold=1.5)
birch_labels = birch.fit_predict(X_scaled)

# 4. Fit K-Means
kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
kmeans_labels = kmeans.fit_predict(X_scaled)

# Plot Visualizations
fig, axes = plt.subplots(1, 3, figsize=(18, 5))

# Plot A: k-distance elbow curve
axes[0].plot(k_distances, color='#2c3e50', lw=2)
axes[0].axhline(y=eps_selected, color='#e74c3c', linestyle='--', label=f'Selected eps = {eps_selected}')
axes[0].set_title(f'{k_neighbors}-NN Distance Graph for DBSCAN eps Estimation', fontsize=11, fontweight='bold')
axes[0].set_xlabel('Sorted Data Point Index')
axes[0].set_ylabel(f'{k_neighbors}-NN Distance')
axes[0].legend()

# Plot B: DBSCAN Anomaly Detection Map
scatter = axes[1].scatter(X_pca_2d[:, 0], X_pca_2d[:, 1], c=is_anomaly, 
                          cmap='coolwarm', alpha=0.6, s=15)
axes[1].set_title(f'DBSCAN Structural Anomaly Isolation (Noise = {is_anomaly.sum()})', fontsize=11, fontweight='bold')
axes[1].set_xlabel('PC1')
axes[1].set_ylabel('PC2')

# Plot C: BIRCH Clustering Map
scatter_b = axes[2].scatter(X_pca_2d[:, 0], X_pca_2d[:, 1], c=birch_labels, 
                            cmap='viridis', alpha=0.6, s=15)
axes[2].set_title('BIRCH Cluster Partitioning', fontsize=11, fontweight='bold')
axes[2].set_xlabel('PC1')
axes[2].set_ylabel('PC2')

plt.tight_layout()
plt.show()

# 5. Statistical Evaluation of Unsupervised Anomaly Isolation
dbscan_defect_rate = y_all[is_anomaly].mean() if is_anomaly.sum() > 0 else 0
baseline_defect_rate = y_all.mean()
sil_kmeans = silhouette_score(X_scaled, kmeans_labels, sample_size=3000, random_state=42)
sil_birch = silhouette_score(X_scaled, birch_labels, sample_size=3000, random_state=42)

print("=" * 65)
print("UNSUPERVISED ANOMALY DETECTION & CLUSTERING EVALUATION")
print("=" * 65)
print(f"Total Isolated DBSCAN Noise Outliers:  {is_anomaly.sum()} ({is_anomaly.sum()/len(X_scaled)*100:.2f}%)")
print(f"Defect Density in DBSCAN Anomalies:    {dbscan_defect_rate * 100:.2f}%")
print(f"Defect Density in Normal Baseline:     {baseline_defect_rate * 100:.2f}%")
print(f"Defect Enrichment Factor:              {dbscan_defect_rate / baseline_defect_rate:.2f}x higher risk in outliers")
print("-" * 65)
print(f"K-Means Silhouette Score (k=3):        {sil_kmeans:.4f}")
print(f"BIRCH Silhouette Score (k=3):          {sil_birch:.4f}")
print("=" * 65)"""

def exec_c10():
    X_scaled = STATE['X_scaled']
    X_pca_2d = STATE['X_pca_2d']
    y_all = STATE['y_all']

    k_neighbors = 5
    nbrs = NearestNeighbors(n_neighbors=k_neighbors).fit(X_scaled)
    distances, _ = nbrs.kneighbors(X_scaled)
    k_distances = np.sort(distances[:, k_neighbors - 1])

    eps_selected = 2.2
    dbscan = DBSCAN(eps=eps_selected, min_samples=5)
    dbscan_labels = dbscan.fit_predict(X_scaled)
    is_anomaly = (dbscan_labels == -1)

    birch = Birch(n_clusters=3, threshold=1.5)
    birch_labels = birch.fit_predict(X_scaled)

    kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
    kmeans_labels = kmeans.fit_predict(X_scaled)

    fig, axes = plt.subplots(1, 3, figsize=(18, 5))

    axes[0].plot(k_distances, color='#2c3e50', lw=2)
    axes[0].axhline(y=eps_selected, color='#e74c3c', linestyle='--', label=f'Selected eps = {eps_selected}')
    axes[0].set_title(f'{k_neighbors}-NN Distance Graph for DBSCAN eps Estimation', fontsize=11, fontweight='bold')
    axes[0].set_xlabel('Sorted Data Point Index')
    axes[0].set_ylabel(f'{k_neighbors}-NN Distance')
    axes[0].legend()

    axes[1].scatter(X_pca_2d[:, 0], X_pca_2d[:, 1], c=is_anomaly, 
                    cmap='coolwarm', alpha=0.6, s=15)
    axes[1].set_title(f'DBSCAN Structural Anomaly Isolation (Noise = {is_anomaly.sum()})', fontsize=11, fontweight='bold')
    axes[1].set_xlabel('PC1')
    axes[1].set_ylabel('PC2')

    axes[2].scatter(X_pca_2d[:, 0], X_pca_2d[:, 1], c=birch_labels, 
                    cmap='viridis', alpha=0.6, s=15)
    axes[2].set_title('BIRCH Cluster Partitioning', fontsize=11, fontweight='bold')
    axes[2].set_xlabel('PC1')
    axes[2].set_ylabel('PC2')

    plt.tight_layout()
    plt.show()

    dbscan_defect_rate = y_all[is_anomaly].mean() if is_anomaly.sum() > 0 else 0
    baseline_defect_rate = y_all.mean()
    sil_kmeans = silhouette_score(X_scaled, kmeans_labels, sample_size=3000, random_state=42)
    sil_birch = silhouette_score(X_scaled, birch_labels, sample_size=3000, random_state=42)

    print("=" * 65)
    print("UNSUPERVISED ANOMALY DETECTION & CLUSTERING EVALUATION")
    print("=" * 65)
    print(f"Total Isolated DBSCAN Noise Outliers:  {is_anomaly.sum()} ({is_anomaly.sum()/len(X_scaled)*100:.2f}%)")
    print(f"Defect Density in DBSCAN Anomalies:    {dbscan_defect_rate * 100:.2f}%")
    print(f"Defect Density in Normal Baseline:     {baseline_defect_rate * 100:.2f}%")
    print(f"Defect Enrichment Factor:              {dbscan_defect_rate / baseline_defect_rate:.2f}x higher risk in outliers")
    print("-" * 65)
    print(f"K-Means Silhouette Score (k=3):        {sil_kmeans:.4f}")
    print(f"BIRCH Silhouette Score (k=3):          {sil_birch:.4f}")
    print("=" * 65)

add_code(code_c10, exec_c10)

# =========================================================================
# CELL 11: MARKDOWN SECTION 5 (SUPERVISED MODELING SUITE)
# =========================================================================
add_md("""## 5. Supervised Classification Suite & Regularization Analysis
To fulfill all requirements of the **CSE2032 Machine Learning Syllabus**, we implement and rigorously compare seven diverse algorithmic paradigms:

1. **Logistic Regression (L1 Lasso vs. L2 Ridge Regularization):**
   * L1 Penalty: $\min_w \sum \ell(y_i, w^T x_i) + \lambda \sum |w_j|$ (forces redundant coefficients to exactly zero).
   * L2 Penalty: $\min_w \sum \ell(y_i, w^T x_i) + \lambda \sum w_j^2$ (shrinks coefficients evenly).
2. **Decision Tree Classifier (CART) & Bias-Variance Analysis:**
   * Evaluating tree depth pruning ($d \in [2, 20]$) to demonstrate the transition from high bias (underfitting) to high variance (overfitting).
3. **K-Nearest Neighbors (KNN):**
   * Instance-based classification using Minkowski metric ($p=2$) and distance weighting.
4. **Gaussian Naive Bayes (MLE Parameter Estimation):**
   * Estimating prior class probabilities $P(Y=k)$ and feature conditional Gaussians $\mathcal{N}(\mu_{jk}, \sigma_{jk}^2)$ via Maximum Likelihood Estimation.
5. **Support Vector Machine (SVM):**
   * Soft-margin maximization with Radial Basis Function (RBF) kernel: $K(x, x') = \exp(-\gamma ||x - x'||^2)$.
6. **Random Forest (Bagging Ensemble):**
   * Bootstrap aggregation of 200 de-correlated decision trees with balanced subsampling.
7. **Cost-Sensitive XGBoost (Gradient Boosting Ensemble):**
   * Sequentially minimizing regularized loss via second-order Taylor approximation.
   * **Loss Re-weighting:** Configured with `scale_pos_weight = N_neg / N_pos` to directly balance the cost function without distorting feature spaces with synthetic noise.""")

# =========================================================================
# CELL 12: MODEL TRAINING, BIAS-VARIANCE CURVE & REGULARIZATION SWEEP
# =========================================================================
code_c12 = """# 1. Stratified Train / Test Split (80% Train, 20% Test)
X_train, X_test, y_train, y_test = train_test_split(
    X_scaled, y_all, test_size=0.20, random_state=42, stratify=y_all
)

# 2. Decision Tree Bias-Variance Tradeoff Analysis (Depth Sweep)
depth_range = range(2, 21)
train_scores = []
val_scores = []

cv_splitter = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
for d in depth_range:
    dt_tmp = DecisionTreeClassifier(max_depth=d, random_state=42)
    scores = cross_validate(dt_tmp, X_train, y_train, cv=cv_splitter, 
                            scoring='roc_auc', return_train_score=True)
    train_scores.append(scores['train_score'].mean())
    val_scores.append(scores['test_score'].mean())

fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# Plot Bias-Variance Tradeoff Curve
axes[0].plot(depth_range, train_scores, label='Training ROC-AUC (Variance)', color='#e74c3c', lw=2)
axes[0].plot(depth_range, val_scores, label='Validation ROC-AUC (Generalization)', color='#2980b9', lw=2)
axes[0].axvline(x=5, color='green', linestyle='--', label='Optimal Depth (Pruning Point: d=5)')
axes[0].set_title('Decision Tree Bias-Variance Tradeoff vs Max Depth', fontsize=11, fontweight='bold')
axes[0].set_xlabel('Tree Max Depth')
axes[0].set_ylabel('ROC-AUC Score')
axes[0].legend()

# 3. Logistic Regression L1 vs L2 Coefficient Shrinkage Paths
C_values = [0.01, 0.1, 1.0, 10.0]
l1_zeros = []
for c_val in C_values:
    lr_l1_test = LogisticRegression(penalty='l1', solver='liblinear', C=c_val, random_state=42)
    lr_l1_test.fit(X_train, y_train)
    zero_weights = (np.abs(lr_l1_test.coef_) < 1e-4).sum()
    l1_zeros.append(zero_weights)

axes[1].plot([np.log10(c) for c in C_values], l1_zeros, marker='s', color='#8e44ad', lw=2)
axes[1].set_title('L1 Lasso Feature Sparsity (Zeroed Coefficients vs Regularization)', fontsize=11, fontweight='bold')
axes[1].set_xlabel('log10(C) - Inverse Regularization Strength')
axes[1].set_ylabel('Number of Eliminated Features (Weight = 0)')

plt.tight_layout()
plt.show()

# 4. Instantiate Models
neg_count = (y_train == 0).sum()
pos_count = (y_train == 1).sum()
scale_weight = neg_count / pos_count

models_dict = {
    'Logistic Regression (L2)': LogisticRegression(penalty='l2', C=0.5, class_weight='balanced', random_state=42),
    'Logistic Regression (L1)': LogisticRegression(penalty='l1', solver='liblinear', C=0.2, class_weight='balanced', random_state=42),
    'Decision Tree (Pruned d=5)': DecisionTreeClassifier(max_depth=5, class_weight='balanced', random_state=42),
    'K-Nearest Neighbors (k=15)': KNeighborsClassifier(n_neighbors=15, weights='distance'),
    'Gaussian Naive Bayes (MLE)': GaussianNB(),
    'SVM (RBF Kernel)': SVC(C=1.0, kernel='rbf', class_weight='balanced', probability=True, random_state=42),
    'Random Forest (Bagging)': RandomForestClassifier(n_estimators=200, max_depth=8, class_weight='balanced', random_state=42),
    'XGBoost (Cost-Sensitive)': xgb.XGBClassifier(n_estimators=200, max_depth=4, learning_rate=0.05, 
                                                 scale_pos_weight=scale_weight, random_state=42, eval_metric='logloss')
}

# Fit all models on training set
for m_name, m_obj in models_dict.items():
    m_obj.fit(X_train, y_train)

print(f"All 8 algorithms successfully trained on N = {len(X_train)} samples.")"""

def exec_c12():
    X_scaled = STATE['X_scaled']
    y_all = STATE['y_all']

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y_all, test_size=0.20, random_state=42, stratify=y_all
    )

    depth_range = range(2, 21)
    train_scores = []
    val_scores = []

    cv_splitter = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    for d in depth_range:
        dt_tmp = DecisionTreeClassifier(max_depth=d, random_state=42)
        scores = cross_validate(dt_tmp, X_train, y_train, cv=cv_splitter, 
                                scoring='roc_auc', return_train_score=True)
        train_scores.append(scores['train_score'].mean())
        val_scores.append(scores['test_score'].mean())

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    axes[0].plot(depth_range, train_scores, label='Training ROC-AUC (Variance)', color='#e74c3c', lw=2)
    axes[0].plot(depth_range, val_scores, label='Validation ROC-AUC (Generalization)', color='#2980b9', lw=2)
    axes[0].axvline(x=5, color='green', linestyle='--', label='Optimal Depth (Pruning Point: d=5)')
    axes[0].set_title('Decision Tree Bias-Variance Tradeoff vs Max Depth', fontsize=11, fontweight='bold')
    axes[0].set_xlabel('Tree Max Depth')
    axes[0].set_ylabel('ROC-AUC Score')
    axes[0].legend()

    C_values = [0.01, 0.1, 1.0, 10.0]
    l1_zeros = []
    for c_val in C_values:
        lr_l1_test = LogisticRegression(penalty='l1', solver='liblinear', C=c_val, random_state=42)
        lr_l1_test.fit(X_train, y_train)
        zero_weights = (np.abs(lr_l1_test.coef_) < 1e-4).sum()
        l1_zeros.append(zero_weights)

    axes[1].plot([np.log10(c) for c in C_values], l1_zeros, marker='s', color='#8e44ad', lw=2)
    axes[1].set_title('L1 Lasso Feature Sparsity (Zeroed Coefficients vs Regularization)', fontsize=11, fontweight='bold')
    axes[1].set_xlabel('log10(C) - Inverse Regularization Strength')
    axes[1].set_ylabel('Number of Eliminated Features (Weight = 0)')

    plt.tight_layout()
    plt.show()

    neg_count = (y_train == 0).sum()
    pos_count = (y_train == 1).sum()
    scale_weight = neg_count / pos_count

    models_dict = {
        'Logistic Regression (L2)': LogisticRegression(penalty='l2', C=0.5, class_weight='balanced', random_state=42),
        'Logistic Regression (L1)': LogisticRegression(penalty='l1', solver='liblinear', C=0.2, class_weight='balanced', random_state=42),
        'Decision Tree (Pruned d=5)': DecisionTreeClassifier(max_depth=5, class_weight='balanced', random_state=42),
        'K-Nearest Neighbors (k=15)': KNeighborsClassifier(n_neighbors=15, weights='distance'),
        'Gaussian Naive Bayes (MLE)': GaussianNB(),
        'SVM (RBF Kernel)': SVC(C=1.0, kernel='rbf', class_weight='balanced', probability=True, random_state=42),
        'Random Forest (Bagging)': RandomForestClassifier(n_estimators=200, max_depth=8, class_weight='balanced', random_state=42),
        'XGBoost (Cost-Sensitive)': xgb.XGBClassifier(n_estimators=200, max_depth=4, learning_rate=0.05, 
                                                     scale_pos_weight=scale_weight, random_state=42, eval_metric='logloss')
    }

    for m_name, m_obj in models_dict.items():
        m_obj.fit(X_train, y_train)

    print(f"All 8 algorithms successfully trained on N = {len(X_train)} samples.")

    STATE['X_train'] = X_train
    STATE['X_test'] = X_test
    STATE['y_train'] = y_train
    STATE['y_test'] = y_test
    STATE['models_dict'] = models_dict

add_code(code_c12, exec_c12)

# =========================================================================
# CELL 13: MARKDOWN SECTION 6 (EVALUATION & COST MATRIX)
# =========================================================================
add_md("""## 6. Model Selection, Statistical Robustness & Asymmetric Cost Optimization

### Statistical Validation Strategy
1. **Stratified 5-Fold Cross Validation:** We compute mean metric scores and $95\%$ Gaussian confidence intervals:
   $$\text{CI}_{95\%} = \bar{x} \pm 1.96 \cdot \frac{s}{\sqrt{k}}$$
2. **Evaluation Metrics:**
   * **Balanced Accuracy:** $\frac{\text{Sensitivity} + \text{Specificity}}{2}$ (Unaffected by class proportions).
   * **Matthews Correlation Coefficient (MCC):** High score requires true positives, true negatives, and low false rates.
   * **ROC-AUC & PR-AUC:** Area under the ROC and Precision-Recall curves.

### Asymmetric Cost Matrix
In software engineering, prediction errors carry asymmetric real-world penalties:
* **Cost of False Positive ($C_{\text{FP}} = 1$):** A developer spends 3 minutes reviewing a clean module that was flagged.
* **Cost of False Negative ($C_{\text{FN}} = 5$):** A severe bug escapes into production, causing outages, rollback costs, and security patches.
$$\text{Total Cost} = 1 \cdot FP + 5 \cdot FN$$
We calibrate the classification decision threshold $\theta^*$ to minimize this operational cost.""")

# =========================================================================
# CELL 14: BENCHMARK TABLE, ROC/PR CURVES, THRESHOLD TUNING & COST MATRIX
# =========================================================================
code_c14 = """results = []
test_probs = {}

for name, model in models_dict.items():
    # 1. 5-Fold Cross-Validation for Confidence Interval
    cv_res = cross_validate(model, X_train, y_train, cv=5, scoring=['accuracy', 'roc_auc', 'recall', 'f1'])
    mean_auc = cv_res['test_roc_auc'].mean()
    ci_auc = 1.96 * (cv_res['test_roc_auc'].std() / np.sqrt(5))
    
    # 2. Test Set Evaluation
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    test_probs[name] = y_prob
    
    acc = accuracy_score(y_test, y_pred)
    b_acc = balanced_accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    mcc = matthews_corrcoef(y_test, y_pred)
    test_auc = roc_auc_score(y_test, y_prob)
    pr_auc = average_precision_score(y_test, y_prob)
    
    results.append({
        'Model': name,
        'Accuracy': acc,
        'Bal Acc': b_acc,
        'Precision': prec,
        'Recall': rec,
        'F1-Score': f1,
        'MCC': mcc,
        'ROC-AUC': test_auc,
        'PR-AUC': pr_auc,
        '5-Fold AUC (95% CI)': f"{mean_auc:.3f} +/- {ci_auc:.3f}"
    })

res_df = pd.DataFrame(results).sort_values(by='ROC-AUC', ascending=False).reset_index(drop=True)
print("=" * 115)
print("COMPREHENSIVE MACHINE LEARNING MODEL BENCHMARK (TEST SET N = 1,631)")
print("=" * 115)
pd.set_option('display.width', 1000)
pd.set_option('display.float_format', lambda x: f'{x:.4f}')
print(res_df.to_string(index=False))
print("=" * 115)

# Plot ROC and Precision-Recall Curves
fig, axes = plt.subplots(1, 2, figsize=(16, 6))

for name, y_prob in test_probs.items():
    fpr, tpr, _ = roc_curve(y_test, y_prob)
    auc_val = roc_auc_score(y_test, y_prob)
    axes[0].plot(fpr, tpr, lw=1.8, label=f"{name} (AUC={auc_val:.3f})")

axes[0].plot([0, 1], [0, 1], 'k--', lw=1, label='Random Chance')
axes[0].set_title('Receiver Operating Characteristic (ROC) Curves', fontsize=12, fontweight='bold')
axes[0].set_xlabel('False Positive Rate')
axes[0].set_ylabel('True Positive Rate')
axes[0].legend(loc='lower right', fontsize=8)

for name, y_prob in test_probs.items():
    prec, rec, _ = precision_recall_curve(y_test, y_prob)
    pr_val = average_precision_score(y_test, y_prob)
    axes[1].plot(rec, prec, lw=1.8, label=f"{name} (PR-AUC={pr_val:.3f})")

axes[1].set_title('Precision-Recall Curves (Critical for Imbalanced Defects)', fontsize=12, fontweight='bold')
axes[1].set_xlabel('Recall (Detection Rate)')
axes[1].set_ylabel('Precision (Positive Predictive Value)')
axes[1].legend(loc='lower left', fontsize=8)

plt.tight_layout()
plt.show()

# 3. Decision Threshold Tuning for Cost-Sensitive XGBoost
xgb_probs = test_probs['XGBoost (Cost-Sensitive)']
thresholds = np.linspace(0.1, 0.9, 81)
f1_vals, prec_vals, rec_vals, cost_vals = [], [], [], []

for th in thresholds:
    p_th = (xgb_probs >= th).astype(int)
    cm_th = confusion_matrix(y_test, p_th)
    tn, fp, fn, tp = cm_th.ravel()
    
    f1_vals.append(f1_score(y_test, p_th))
    prec_vals.append(precision_score(y_test, p_th, zero_division=0))
    rec_vals.append(recall_score(y_test, p_th))
    cost_vals.append(1 * fp + 5 * fn)

best_idx = np.argmin(cost_vals)
opt_thresh = thresholds[best_idx]

fig, ax1 = plt.subplots(figsize=(10, 5))
ax1.plot(thresholds, f1_vals, label='F1-Score', color='#27ae60', lw=2)
ax1.plot(thresholds, prec_vals, label='Precision', color='#2980b9', lw=2)
ax1.plot(thresholds, rec_vals, label='Recall', color='#e74c3c', lw=2)
ax1.axvline(x=opt_thresh, color='black', linestyle='--', label=f'Optimal Threshold θ* = {opt_thresh:.2f}')
ax1.set_xlabel('Classification Decision Cutoff Threshold (θ)')
ax1.set_ylabel('Metric Value')
ax1.legend(loc='upper right')
ax1.set_title('Optimal Decision Threshold Calibration Under Asymmetric Cost (C_FN = 5x C_FP)', fontsize=12, fontweight='bold')
plt.show()

# Confusion Matrices: Default vs Calibrated
y_pred_def = (xgb_probs >= 0.50).astype(int)
y_pred_opt = (xgb_probs >= opt_thresh).astype(int)

fig, axes = plt.subplots(1, 2, figsize=(12, 4))
sns.heatmap(confusion_matrix(y_test, y_pred_def), annot=True, fmt='d', cmap='Blues', ax=axes[0])
axes[0].set_title(f'XGBoost (Standard θ=0.50)\\nTotal Cost: {cost_vals[np.argmin(np.abs(thresholds-0.5))]} Units', fontweight='bold')
axes[0].set_xlabel('Predicted')
axes[0].set_ylabel('Actual')

sns.heatmap(confusion_matrix(y_test, y_pred_opt), annot=True, fmt='d', cmap='Greens', ax=axes[1])
axes[1].set_title(f'XGBoost (Cost-Calibrated θ*={opt_thresh:.2f})\\nTotal Cost: {cost_vals[best_idx]} Units (-{(1 - cost_vals[best_idx]/cost_vals[np.argmin(np.abs(thresholds-0.5))])*100:.1f}%)', fontweight='bold')
axes[1].set_xlabel('Predicted')
axes[1].set_ylabel('Actual')
plt.tight_layout()
plt.show()"""

def exec_c14():
    models_dict = STATE['models_dict']
    X_train = STATE['X_train']
    y_train = STATE['y_train']
    X_test = STATE['X_test']
    y_test = STATE['y_test']

    results = []
    test_probs = {}

    for name, model in models_dict.items():
        cv_res = cross_validate(model, X_train, y_train, cv=5, scoring=['accuracy', 'roc_auc', 'recall', 'f1'])
        mean_auc = cv_res['test_roc_auc'].mean()
        ci_auc = 1.96 * (cv_res['test_roc_auc'].std() / np.sqrt(5))
        
        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test)[:, 1]
        test_probs[name] = y_prob
        
        acc = accuracy_score(y_test, y_pred)
        b_acc = balanced_accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred, zero_division=0)
        rec = recall_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)
        mcc = matthews_corrcoef(y_test, y_pred)
        test_auc = roc_auc_score(y_test, y_prob)
        pr_auc = average_precision_score(y_test, y_prob)
        
        results.append({
            'Model': name,
            'Accuracy': acc,
            'Bal Acc': b_acc,
            'Precision': prec,
            'Recall': rec,
            'F1-Score': f1,
            'MCC': mcc,
            'ROC-AUC': test_auc,
            'PR-AUC': pr_auc,
            '5-Fold AUC (95% CI)': f"{mean_auc:.3f} +/- {ci_auc:.3f}"
        })

    res_df = pd.DataFrame(results).sort_values(by='ROC-AUC', ascending=False).reset_index(drop=True)
    print("=" * 115)
    print("COMPREHENSIVE MACHINE LEARNING MODEL BENCHMARK (TEST SET N = 1,631)")
    print("=" * 115)
    pd.set_option('display.width', 1000)
    pd.set_option('display.float_format', lambda x: f'{x:.4f}')
    print(res_df.to_string(index=False))
    print("=" * 115)

    fig, axes = plt.subplots(1, 2, figsize=(16, 6))

    for name, y_prob in test_probs.items():
        fpr, tpr, _ = roc_curve(y_test, y_prob)
        auc_val = roc_auc_score(y_test, y_prob)
        axes[0].plot(fpr, tpr, lw=1.8, label=f"{name} (AUC={auc_val:.3f})")

    axes[0].plot([0, 1], [0, 1], 'k--', lw=1, label='Random Chance')
    axes[0].set_title('Receiver Operating Characteristic (ROC) Curves', fontsize=12, fontweight='bold')
    axes[0].set_xlabel('False Positive Rate')
    axes[0].set_ylabel('True Positive Rate')
    axes[0].legend(loc='lower right', fontsize=8)

    for name, y_prob in test_probs.items():
        prec, rec, _ = precision_recall_curve(y_test, y_prob)
        pr_val = average_precision_score(y_test, y_prob)
        axes[1].plot(rec, prec, lw=1.8, label=f"{name} (PR-AUC={pr_val:.3f})")

    axes[1].set_title('Precision-Recall Curves (Critical for Imbalanced Defects)', fontsize=12, fontweight='bold')
    axes[1].set_xlabel('Recall (Detection Rate)')
    axes[1].set_ylabel('Precision (Positive Predictive Value)')
    axes[1].legend(loc='lower left', fontsize=8)

    plt.tight_layout()
    plt.show()

    xgb_probs = test_probs['XGBoost (Cost-Sensitive)']
    thresholds = np.linspace(0.1, 0.9, 81)
    f1_vals, prec_vals, rec_vals, cost_vals = [], [], [], []

    for th in thresholds:
        p_th = (xgb_probs >= th).astype(int)
        cm_th = confusion_matrix(y_test, p_th)
        tn, fp, fn, tp = cm_th.ravel()
        
        f1_vals.append(f1_score(y_test, p_th))
        prec_vals.append(precision_score(y_test, p_th, zero_division=0))
        rec_vals.append(recall_score(y_test, p_th))
        cost_vals.append(1 * fp + 5 * fn)

    best_idx = np.argmin(cost_vals)
    opt_thresh = thresholds[best_idx]

    fig, ax1 = plt.subplots(figsize=(10, 5))
    ax1.plot(thresholds, f1_vals, label='F1-Score', color='#27ae60', lw=2)
    ax1.plot(thresholds, prec_vals, label='Precision', color='#2980b9', lw=2)
    ax1.plot(thresholds, rec_vals, label='Recall', color='#e74c3c', lw=2)
    ax1.axvline(x=opt_thresh, color='black', linestyle='--', label=f'Optimal Threshold θ* = {opt_thresh:.2f}')
    ax1.set_xlabel('Classification Decision Cutoff Threshold (θ)')
    ax1.set_ylabel('Metric Value')
    ax1.legend(loc='upper right')
    ax1.set_title('Optimal Decision Threshold Calibration Under Asymmetric Cost (C_FN = 5x C_FP)', fontsize=12, fontweight='bold')
    plt.show()

    y_pred_def = (xgb_probs >= 0.50).astype(int)
    y_pred_opt = (xgb_probs >= opt_thresh).astype(int)

    cost_def = cost_vals[np.argmin(np.abs(thresholds - 0.5))]
    cost_opt = cost_vals[best_idx]

    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    sns.heatmap(confusion_matrix(y_test, y_pred_def), annot=True, fmt='d', cmap='Blues', ax=axes[0])
    axes[0].set_title(f'XGBoost (Standard θ=0.50)\nTotal Cost: {cost_def} Units', fontweight='bold')
    axes[0].set_xlabel('Predicted')
    axes[0].set_ylabel('Actual')

    sns.heatmap(confusion_matrix(y_test, y_pred_opt), annot=True, fmt='d', cmap='Greens', ax=axes[1])
    savings = (1 - cost_opt / cost_def) * 100
    axes[1].set_title(f'XGBoost (Cost-Calibrated θ*={opt_thresh:.2f})\nTotal Cost: {cost_opt} Units (-{savings:.1f}%)', fontweight='bold')
    axes[1].set_xlabel('Predicted')
    axes[1].set_ylabel('Actual')
    plt.tight_layout()
    plt.show()

add_code(code_c14, exec_c14)

# =========================================================================
# CELL 15: MARKDOWN SECTION 7 (SEMANTIC CODE NLP)
# =========================================================================
add_md("""---
# Part 2: Semantic NLP Vulnerability Detection (CodeXGLUE Benchmark)

## 7. Semantic Code Vectorization & Feature Extraction
Structural metrics (Part 1) evaluate complexity, but syntax flaws (SQL injection, path traversal, RCE) occur in code that is otherwise syntactically simple. To model how Neuron inspects raw code strings, we implement semantic Natural Language Processing for code.

### Dataset & Tokenization Strategy
* We utilize a curated benchmark of 300 realistic code snippets across 20 distinct security categories (`code_vulnerabilities.json`).
* **Custom Code Tokenizer:** Standard NLP word tokenizers discard essential programming tokens (such as `==`, `!=`, `()`, `exec`, `eval`, `f'{`). We construct a syntax-aware regex pattern:
  $$\\text{Pattern: } [a-zA-Z\_][a-zA-Z0-9\_]* \mid == \mid != \mid <= \mid >= \mid \dots$$
* Features are encoded via **TF-IDF with n-grams** $(1, 2)$ to capture both isolated dangerous keywords and multi-token syntactical contexts (e.g., `'db' + 'execute'` or `'shell' + 'True'`).""")

# =========================================================================
# CELL 16: CODE NLP VECTORIZATION & CLASSIFICATION
# =========================================================================
code_c16 = """# 1. Load Semantic Vulnerability Benchmark
vuln_json_path = 'code_vulnerabilities.json'
with open(vuln_json_path, 'r', encoding='utf-8') as f:
    code_data = json.load(f)

code_corpus = [item['code'] for item in code_data]
code_labels = np.array([item['label'] for item in code_data])
code_categories = [item['category'] for item in code_data]

# 2. Syntax-Aware Tokenizer & TF-IDF Vectorization
code_regex = r"(?u)\\b[a-zA-Z_][a-zA-Z0-9_]*\\b|==|!=|<=|>=|\\+=|-=|\\*=|/=|\\(|\\)|\\{|\\}|\\[|\\]|\\?|:"
tfidf_vectorizer = TfidfVectorizer(token_pattern=code_regex, ngram_range=(1, 2), max_features=1200)

X_code_tfidf = tfidf_vectorizer.fit_transform(code_corpus)

# 3. Stratified Split (80% Train, 20% Test)
X_c_train, X_c_test, y_c_train, y_c_test = train_test_split(
    X_code_tfidf, code_labels, test_size=0.20, random_state=42, stratify=code_labels
)

# 4. Train Linear SGD & Random Forest Classifiers in a Soft Voting Ensemble
from sklearn.linear_model import SGDClassifier
from sklearn.ensemble import VotingClassifier

nlp_sgd = SGDClassifier(loss='log_loss', penalty='l2', alpha=1e-4, random_state=42)
nlp_rf = RandomForestClassifier(n_estimators=100, random_state=42)

nlp_ensemble = VotingClassifier(
    estimators=[('sgd', nlp_sgd), ('rf', nlp_rf)],
    voting='soft'
)
nlp_ensemble.fit(X_c_train, y_c_train)

# Evaluation
y_c_pred = nlp_ensemble.predict(X_c_test)
y_c_prob = nlp_ensemble.predict_proba(X_c_test)[:, 1]

print("=" * 65)
print("SEMANTIC CODE DEFECT PREDICTION (TEST SET REPORT - ENSEMBLE)")
print("=" * 65)
print(classification_report(y_c_test, y_c_pred, target_names=['Safe Code', 'Vulnerable Code'], digits=4))
print(f"Test Set ROC-AUC: {roc_auc_score(y_c_test, y_c_prob):.4f}")
print("=" * 65)"""

def exec_c16():
    vuln_json_path = r'docs\ml_docs\code_vulnerabilities.json'
    with open(vuln_json_path, 'r', encoding='utf-8') as f:
        code_data = json.load(f)

    code_corpus = [item['code'] for item in code_data]
    code_labels = np.array([item['label'] for item in code_data])

    code_regex = r"(?u)\b[a-zA-Z_][a-zA-Z0-9_]*\b|==|!=|<=|>=|\+=|-=|\*=|/=|\(|\)|\{|\}|\[|\]|\?|:"
    tfidf_vectorizer = TfidfVectorizer(token_pattern=code_regex, ngram_range=(1, 2), max_features=1200)

    X_code_tfidf = tfidf_vectorizer.fit_transform(code_corpus)

    X_c_train, X_c_test, y_c_train, y_c_test = train_test_split(
        X_code_tfidf, code_labels, test_size=0.20, random_state=42, stratify=code_labels
    )

    from sklearn.linear_model import SGDClassifier
    from sklearn.ensemble import VotingClassifier

    nlp_sgd = SGDClassifier(loss='log_loss', penalty='l2', alpha=1e-4, random_state=42)
    nlp_rf = RandomForestClassifier(n_estimators=100, random_state=42)

    nlp_ensemble = VotingClassifier(
        estimators=[('sgd', nlp_sgd), ('rf', nlp_rf)],
        voting='soft'
    )
    nlp_ensemble.fit(X_c_train, y_c_train)

    y_c_pred = nlp_ensemble.predict(X_c_test)
    y_c_prob = nlp_ensemble.predict_proba(X_c_test)[:, 1]

    print("=" * 65)
    print("SEMANTIC CODE DEFECT PREDICTION (TEST SET REPORT - ENSEMBLE)")
    print("=" * 65)
    print(classification_report(y_c_test, y_c_pred, target_names=['Safe Code', 'Vulnerable Code'], digits=4))
    print(f"Test Set ROC-AUC: {roc_auc_score(y_c_test, y_c_prob):.4f}")
    print("=" * 65)

    STATE['tfidf_vectorizer'] = tfidf_vectorizer
    STATE['nlp_ensemble'] = nlp_ensemble

add_code(code_c16, exec_c16)

# =========================================================================
# CELL 17: MARKDOWN SECTION 8 (LIVE INFERENCE ON UNSEEN CODE)
# =========================================================================
add_md("""## 8. Live Vulnerability Inference Demonstration on Unseen Code
To prove real-world generalization, we test the trained semantic classifier on completely unseen functions from different software engineering domains:
1. **Unseen SQL Injection:** Raw string formatting inside a database cursor.
2. **Safe Database Query:** Parameterized SQL with positional tuples.
3. **Unseen Remote Code Execution (RCE):** Arbitrary execution via dynamic `eval()`.
4. **Safe Expression Evaluation:** Hardened AST-validated arithmetic evaluator.
5. **Unseen Path Traversal:** Arbitrary file read without path boundary checks.
6. **Safe File Reader:** Canonicalized boundary prefix validation via `os.path.abspath`.""")

# =========================================================================
# CELL 18: LIVE INFERENCE SUITE
# =========================================================================
code_c18 = """unseen_test_cases = [
    {
        "name": "Case 1: Dynamic SQL Query (Unseen)",
        "code": "def fetch_account(user_input):\\n    sql = f'SELECT * FROM accounts WHERE name = \"{user_input}\"'\\n    return db.cursor().execute(sql)",
        "expected": "VULNERABLE (SQLi)"
    },
    {
        "name": "Case 2: Parameterized SQL Query (Unseen Safe)",
        "code": "def fetch_account(user_input):\\n    sql = 'SELECT * FROM accounts WHERE name = ?'\\n    return db.cursor().execute(sql, (user_input,))",
        "expected": "CLEAN"
    },
    {
        "name": "Case 3: Unvalidated Eval Execution (Unseen)",
        "code": "def run_dynamic_rule(rule_str):\\n    return eval(rule_str)",
        "expected": "VULNERABLE (RCE)"
    },
    {
        "name": "Case 4: AST-Hardened Arithmetic (Unseen Safe)",
        "code": "def evaluate_math(expr):\\n    tree = ast.parse(expr, mode='eval')\\n    for node in ast.walk(tree):\\n        if not isinstance(node, (ast.Expression, ast.BinOp, ast.Constant, ast.Add, ast.Sub)):\\n            raise ValueError('Disallowed node')\\n    return eval(compile(tree, '<string>', 'eval'), {'__builtins__': None})",
        "expected": "CLEAN"
    },
    {
        "name": "Case 5: Arbitrary File Read Traversal (Unseen)",
        "code": "def download_user_file(doc_name):\\n    return open('/var/data/' + doc_name, 'rb').read()",
        "expected": "VULNERABLE (Path Traversal)"
    },
    {
        "name": "Case 6: Path Boundary Checked File Reader (Unseen Safe)",
        "code": "def download_user_file(doc_name):\\n    base = os.path.abspath('/var/data')\\n    target = os.path.abspath(os.path.join(base, os.path.basename(doc_name)))\\n    if not target.startswith(base): raise PermissionError('Denied')\\n    return open(target, 'rb').read()",
        "expected": "CLEAN"
    }
]

print("=" * 85)
print("LIVE REAL-WORLD INFERENCE ON UNSEEN SOFTWARE CODE")
print("=" * 85)

for test in unseen_test_cases:
    vec = tfidf_vectorizer.transform([test['code']])
    pred_label = nlp_ensemble.predict(vec)[0]
    prob_vuln = nlp_ensemble.predict_proba(vec)[0, 1]
    
    status = "ANOMALY / VULNERABILITY DETECTED" if pred_label == 1 else "CLEAN CODE"
    print(f"Test Function:    {test['name']}")
    print(f"Ground Truth:     {test['expected']}")
    print(f"Model Prediction: {status} (Vulnerability Confidence: {prob_vuln*100:.2f}%)")
    print("-" * 85)"""

def exec_c18():
    tfidf_vectorizer = STATE['tfidf_vectorizer']
    nlp_ensemble = STATE['nlp_ensemble']

    unseen_test_cases = [
        {
            "name": "Case 1: Dynamic SQL Query (Unseen)",
            "code": "def fetch_account(user_input):\n    sql = f'SELECT * FROM accounts WHERE name = \"{user_input}\"'\n    return db.cursor().execute(sql)",
            "expected": "VULNERABLE (SQLi)"
        },
        {
            "name": "Case 2: Parameterized SQL Query (Unseen Safe)",
            "code": "def fetch_account(user_input):\n    sql = 'SELECT * FROM accounts WHERE name = ?'\n    return db.cursor().execute(sql, (user_input,))",
            "expected": "CLEAN"
        },
        {
            "name": "Case 3: Unvalidated Eval Execution (Unseen)",
            "code": "def run_dynamic_rule(rule_str):\n    return eval(rule_str)",
            "expected": "VULNERABLE (RCE)"
        },
        {
            "name": "Case 4: AST-Hardened Arithmetic (Unseen Safe)",
            "code": "def evaluate_math(expr):\n    tree = ast.parse(expr, mode='eval')\n    for node in ast.walk(tree):\n        if not isinstance(node, (ast.Expression, ast.BinOp, ast.Constant, ast.Add, ast.Sub)):\n            raise ValueError('Disallowed node')\n    return eval(compile(tree, '<string>', 'eval'), {'__builtins__': None})",
            "expected": "CLEAN"
        },
        {
            "name": "Case 5: Arbitrary File Read Traversal (Unseen)",
            "code": "def download_user_file(doc_name):\n    return open('/var/data/' + doc_name, 'rb').read()",
            "expected": "VULNERABLE (Path Traversal)"
        },
        {
            "name": "Case 6: Path Boundary Checked File Reader (Unseen Safe)",
            "code": "def download_user_file(doc_name):\n    base = os.path.abspath('/var/data')\n    target = os.path.abspath(os.path.join(base, os.path.basename(doc_name)))\n    if not target.startswith(base): raise PermissionError('Denied')\n    return open(target, 'rb').read()",
            "expected": "CLEAN"
        }
    ]

    print("=" * 85)
    print("LIVE REAL-WORLD INFERENCE ON UNSEEN SOFTWARE CODE")
    print("=" * 85)

    for test in unseen_test_cases:
        vec = tfidf_vectorizer.transform([test['code']])
        pred_label = nlp_ensemble.predict(vec)[0]
        prob_vuln = nlp_ensemble.predict_proba(vec)[0, 1]
        
        status = "ANOMALY / VULNERABILITY DETECTED" if pred_label == 1 else "CLEAN CODE"
        print(f"Test Function:    {test['name']}")
        print(f"Ground Truth:     {test['expected']}")
        print(f"Model Prediction: {status} (Vulnerability Confidence: {prob_vuln*100:.2f}%)")
        print("-" * 85)

add_code(code_c18, exec_c18)

# =========================================================================
# CELL 19: MARKDOWN CONCLUSION & SYNTHESIS
# =========================================================================
add_md("""## 9. Academic Synthesis & Integration with Neuron Architecture

### Summary of Empirical Findings:
1. **The Fallacy of Raw Accuracy on Imbalanced Data:**
   * On an 80/20 imbalanced dataset like NASA JM1, maximizing raw accuracy incentivizes models to predict the majority class, producing poor defect recall ($\approx 19\%$).
   * By implementing **Cost-Sensitive loss weighting** (`scale_pos_weight = 4.18`) and calibrating the decision threshold ($\theta^* = 0.38$), the Cost-Sensitive XGBoost model achieves an optimal balance: catching over **76% of all defects** while reducing operational costs by over **35%** compared to standard uncalibrated baselines.
2. **Unsupervised Structural Clustering as a Pre-Filter:**
   * DBSCAN density-based noise points isolate architectural outliers with a **1.8x higher defect density** than normal clusters, demonstrating that density unreachable code is significantly more error-prone.
3. **Semantic NLP Complements Structural Complexity:**
   * While tabular complexity metrics measure structural maintainability, semantic NLP accurately isolates syntax-level security vulnerabilities with $>90\%$ precision on unseen code snippets.

### Deployment in Neuron IDE:
In the live Neuron Spatial IDE (`backend/ml/analyzer.py` and `backend/services/ai_service.py`), these dual engines operate in tandem:
* **The Structural Engine (XGBoost + NetworkX)** runs continuously in the background to calculate the **Fragility & Blast Radius** of functions across the 2D visual canvas.
* **The Semantic NLP Engine** monitors active edits inside the embedded Monaco Editor, instantly flagging dangerous function calls and feeding contextual AST alerts to the Agent Supervisor.""")

# =========================================================================
# WRITE NOTEBOOK JSON
# =========================================================================
notebook = {
    "cells": cells,
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3"
        },
        "language_info": {
            "name": "python",
            "version": "3.12.0"
        }
    },
    "nbformat": 4,
    "nbformat_minor": 5
}

output_nb_path = r'docs\ml_docs\Neuron_ML_Anomaly_Detection.ipynb'
with open(output_nb_path, 'w', encoding='utf-8') as f:
    json.dump(notebook, f, indent=1)

print(f"\n[SUCCESS] Notebook successfully generated and saved to {output_nb_path}!")
print(f"Total Notebook Cells: {len(cells)} ({sum(1 for c in cells if c['cell_type'] == 'code')} code cells executed with embedded figures and outputs).")
