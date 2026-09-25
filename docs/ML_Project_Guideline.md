# Neuron: Comprehensive ML Subsystem Representation Guideline

This document outlines the roadmap for developing the `.ipynb` Jupyter Notebook that represents the Machine Learning core of the **Neuron** project. Our goal is to demonstrate a holistic understanding of Machine Learning by walking through a complete lifecycle using the provided datasets.

While **Software Defect Prediction (Classification)** is a core feature, a truly comprehensive ML representation of Neuron encompasses multiple branches of Machine Learning. We will explore Unsupervised Learning (Clustering) and NLP techniques (for code) alongside Supervised Classification.

---

## 1. Project Objective & Context
Neuron is designed to interact with and understand codebases. This ML representation models how Neuron analyzes both structural metrics and raw code semantics.

### The Datasets
1. **NASA MDP Repository (JM1 / KC1)**: Traditional software metrics (McCabe, Halstead). Represents Neuron analyzing structural code complexity (tabular data).
2. **CodeXGLUE Defect Benchmark**: Source code snippets and vulnerability labels. Represents Neuron analyzing unstructured text/code semantics.

---

## 2. Comprehensive ML Scope

To demonstrate a deep understanding of ML beyond just basic classification, our project will be divided into three major ML domains:

*   **Domain A: Unsupervised Learning (Clustering & Dimensionality Reduction)**: Discovering hidden patterns in code without relying on labels.
*   **Domain B: NLP & Unstructured Data (Feature Extraction)**: Processing raw source code into machine-readable mathematical vectors.
*   **Domain C: Supervised Learning (Classification & Regularization)**: Predicting actual code anomalies and defects.

---

## 3. Step-by-Step Implementation Plan (Mapping to Teacher Requirements)

Here is exactly how our three domains map to your teacher's 7 requirements:

### Step 1: Exploratory Data Analysis (EDA)
*   **What we will do**: Analyze statistical properties and visual patterns of the datasets.
*   **Techniques**: 
    *   **Distribution & Correlation**: Plot correlation heatmaps and histograms for NASA MDP metrics.
    *   **Dimensionality Reduction Visualization**: Use **PCA (Principal Component Analysis)** or **t-SNE** to reduce 21+ code metrics into 2D space. *Concept:* Can we visually separate defective code from clean code on a scatter plot before training any model?

### Step 2: Feature Derivation & Unsupervised Clustering
*   **What we will do**: Engineer features and use unsupervised ML to find natural groupings.
*   **Techniques**:
    *   **Code NLP Processing (CodeXGLUE)**: Use **TF-IDF (Term Frequency-Inverse Document Frequency)** or token count vectorization to convert raw source code text into numerical features. *Concept:* Teaching the model that certain keywords (like `malloc` or `eval`) carry heavy mathematical weight.
    *   **K-Means Clustering**: Apply K-Means to the NASA MDP metrics. *Concept:* Even without knowing which files have bugs, can K-Means automatically group files into "Simple Code", "Complex Code", and "Spaghetti Code" clusters?

### Step 3: Classification Models (Supervised Anomaly Detection)
*   **What we will do**: Train algorithms to detect software defects.
*   **Techniques**:
    *   **Logistic Regression**: A simple, interpretable probabilistic model providing a baseline.
    *   **Support Vector Machines (SVM)**: *Concept:* Excellent at finding hyperplanes in high-dimensional spaces (useful for our TF-IDF features).

### Step 4: Regularization
*   **What we will do**: Prevent our models from memorizing the training data (overfitting).
*   **Techniques**:
    *   **L1 (Lasso) / L2 (Ridge) Regularization** in Logistic Regression. 
    *   *Concept / Justification:* Code metrics have high multicollinearity (e.g., lines of code correlates with complexity). Regularization shrinks the coefficients of redundant features to zero, ensuring the model generalizes well to *unseen* codebases.

### Step 5: Hyperparameter Tuning
*   **What we will do**: Optimize the models for peak performance.
*   **Techniques**:
    *   **GridSearchCV / RandomizedSearchCV**: Systematically testing combinations of parameters.
    *   *Concept:* Tuning the `C` parameter (regularization strength) in SVM and the `n_clusters` (using the Elbow Method) in K-Means.

### Step 6: Ensemble Techniques
*   **What we will do**: Combine multiple models to create a highly accurate "super-model".
*   **Techniques**:
    *   **Random Forest (Bagging)**: Combines multiple decision trees trained on random subsets. *Concept:* Reduces variance and is highly resistant to noisy software metrics.
    *   **XGBoost / Gradient Boosting (Boosting)**: Trains trees sequentially, where each new tree corrects the errors of the previous one. *Concept:* Represents the state-of-the-art for tabular predictive modeling.

### Step 7: Performance Analysis & Justification
*   **What we will do**: Evaluate models and justify the final selection for the Neuron engine.
*   **Techniques & Metrics**:
    *   **Accuracy, Precision, Recall, F1-Score, and ROC-AUC curves**.
    *   *Crucial Conceptual Justification:* In software anomaly detection, **Recall** is critical. Missing a vulnerability (False Negative) is usually much more expensive than flagging clean code for review (False Positive). We will analyze our thresholds based on this business logic.

---

## 4. Tech Stack & Libraries Required

*   **Pandas & NumPy**: Data manipulation and numerical operations.
*   **Matplotlib & Seaborn**: Professional EDA visualizations.
*   **Scikit-Learn (sklearn)**: PCA, K-Means, TF-IDF Vectorizer, Logistic Regression, SVM, Random Forest, GridSearchCV, and evaluation metrics.
*   **XGBoost**: Advanced gradient boosting ensemble techniques.

## 5. Next Steps

This document serves as the master blueprint. All implementations in the upcoming `Neuron_ML.ipynb` notebook will directly reference the methodologies and conceptual justifications outlined here.
