# Machine Learning Project Synopsis

### 1. Project Title:
Neuron ML: Automated Software Defect Prediction and Code Vulnerability Detection via Multi-Metric Machine Learning and NLP

---

### 2. Team Members:
| Name | Roll No. | Contribution |
| :--- | :--- | :--- |
| **Nimit Aryan** | 240556 | Data pipeline architecture, empirical quality audit on NASA MDP JM1, statistical skewness analysis, and PCA dimensionality reduction. |
| **Natasha Yadav** | 240547 | Unsupervised clustering (K-Means, DBSCAN density estimation, BIRCH) and comparative analysis of linear and probabilistic models (Logistic Regression L1/L2, Naive Bayes). |
| **Neelesh Sachdeva** | 240550 | Non-linear model training (Decision Trees, SVM, KNN), hyperparameter tuning, and ensemble modeling (Random Forest Bagging & Cost-Sensitive XGBoost). |
| **Sejal Patil** | 240516 | Cost-matrix loss optimization, asymmetric threshold calibration, semantic NLP code tokenization, and live inference pipeline evaluation. |

---

### 3. Problem Statement:
In modern software engineering, undetected code defects and security vulnerabilities frequently escape into production, causing critical system failures and security breaches. Traditional static analysis tools rely on rigid, hand-crafted rules that yield excessive false alarms while missing complex, multi-factor architectural flaws. Furthermore, software metrics suffer from severe power-law skewness and high multicollinearity, while real-world defect datasets exhibit significant class imbalance where clean code heavily outnumbers defective modules. Standard machine learning models trained naively on such data suffer from majority-class bias, yielding high overall accuracy but failing to catch the majority of actual bugs. This project addresses these challenges by developing an end-to-end Machine Learning pipeline that combines structural complexity metrics with semantic code NLP to accurately predict software defects and optimize decision thresholds under real-world asymmetric risk.

---

### 4. Objective:
* Build an end-to-end predictive pipeline on the NASA MDP JM1 flight software repository, resolving empirical data quality anomalies (duplicates and label contradictions), mitigating extreme skewness through Robust Scaling, and reducing metric redundancy via PCA.
* Implement and benchmark 8 diverse supervised algorithms—spanning regularized linear baselines (L1 Lasso / L2 Ridge), probabilistic models (Gaussian Naive Bayes), non-linear classifiers (SVM, Decision Trees, KNN), and ensemble architectures (Random Forest, Cost-Sensitive XGBoost)—with decision thresholds calibrated against asymmetric costs where false negatives are penalized 5× higher than false positives.
* Apply unsupervised learning (K-Means, DBSCAN, BIRCH) to discover structural code anomalies without labels, and deploy a semantic NLP model using syntax-preserving TF-IDF tokenization to detect syntax-level security vulnerabilities in real time.

---

### 5. Dataset:

#### Primary Structural Dataset:
* **Dataset name/source:** NASA Metrics Data Program (MDP) JM1 Flight Software Defect Repository (Promise / OpenML)
* **Link (if publicly available):** https://www.openml.org/d/1039
* **Approx. number of samples:**
  * Raw: 10,885 software modules (22 columns).
  * Deduplicated & Cleaned: 8,819 software modules (Class 0 Clean: 6,815 [77.28%], Class 1 Defective: 2,004 [22.72%]; Imbalance Ratio = 3.40 : 1).
* **Key features (21 raw metrics + 6 engineered features = 27 features):**
  * *McCabe Cyclomatic Complexity:* Lines of code (`loc`), cyclomatic complexity (`v(g)`), essential complexity (`ev(g)`), design complexity (`iv(g)`), and branch count (`branchCount`).
  * *Halstead Software Science Metrics:* Total operators ($N_1$), total operands ($N_2$), unique operators ($\eta_1$), unique operands ($\eta_2$), program volume ($V$), difficulty ($D$), effort ($E$), and delivery time ($T$).
  * *Engineered Domain Features:* Decision-to-LOC density, operator/operand vocabulary ratios, Halstead error estimates, and log-transformed skewness mitigations.
* **Target variable:** `defects` $\in \{0, 1\}$ (`0` = Clean module with zero documented defects, `1` = Defective module with one or more documented defects).

#### Secondary Semantic NLP Dataset:
* **Dataset name/source:** CodeXGLUE Defect & Vulnerability Benchmark (curated Python security corpus based on OWASP & CWE guidelines)
* **Link (if publicly available):** https://github.com/microsoft/CodeXGLUE
* **Approx. number of samples:** 300 curated code snippets (150 vulnerable across SQL Injection, Command Injection, Path Traversal, and RCE vs. 150 hardened functional equivalents).
* **Key features:** Sub-word and token TF-IDF n-grams (1,500 features) extracted from raw source code syntax.
* **Target variable:** `label` $\in \{0, 1\}$ (`0` = Safe/Hardened Code, `1` = Vulnerable Code).

---

### 6. ML Task & Proposed Approach:
* **ML task:** Binary Classification (Supervised Learning), Unsupervised Clustering / Anomaly Detection, and NLP Feature Extraction.
* **Proposed ML algorithms/models:**
  1. *Unsupervised Learning:* K-Means, DBSCAN (Density-Based Spatial Clustering of Applications with Noise), and BIRCH.
  2. *Supervised Linear & Probabilistic Models:* Logistic Regression with L1 (Lasso) and L2 (Ridge) penalties, and Gaussian Naive Bayes (MLE parameter estimation).
  3. *Non-Linear Classifiers:* Support Vector Machines (Linear & RBF Kernels with soft-margin parameter $C$), Decision Trees (Cost-Complexity Pruning analysis), and K-Nearest Neighbors (KNN with distance weighting).
  4. *Ensemble Techniques:* Random Forest (Bagging) and Cost-Sensitive XGBoost (Gradient Boosting with loss re-weighting via `scale_pos_weight`).
  5. *NLP Model:* Syntax-preserving TF-IDF vectorizer paired with an ensemble classifier for code vulnerability detection.
* **Brief description of how ML will be applied:**
  1. *Data Preprocessing & Audit:* Clean and deduplicate the NASA JM1 dataset, resolving contradictory instances. Apply Robust Scaling and power-law transformations to handle extreme outliers, followed by PCA dimensionality reduction.
  2. *Unsupervised Pattern Mining:* Apply K-Means, BIRCH, and DBSCAN on PCA components to isolate architectural outliers and evaluate whether density noise points exhibit a higher defect concentration.
  3. *Supervised Classification & Regularization:* Train 8 distinct classifiers using stratified 5-fold cross-validation. Apply L1 regularization to eliminate uninformative Halstead features and Decision Tree pruning to balance bias and variance.
  4. *Cost-Sensitive Calibration:* Re-weight the loss function in XGBoost to combat class imbalance. Calibrate the classification threshold ($\theta^*$) under an asymmetric cost matrix ($C_{\text{FN}} = 5 \times C_{\text{FP}}$) to prioritize bug detection recall while minimizing developer alert fatigue.
  5. *Semantic Code Analysis:* Vectorize code snippets in real time to classify specific software vulnerabilities (such as SQLi and RCE) on unseen code.

---

### 7. Evaluation Metrics:
* **Classification Metrics:**
  * **Recall (Sensitivity):** Primary metric, critical for catching software bugs before deployment.
  * **Precision & Specificity:** To monitor and control false alarms.
  * **Balanced Accuracy:** Harmonic metric $\frac{\text{Sensitivity} + \text{Specificity}}{2}$ to eliminate majority-class bias on imbalanced data.
  * **F1-Score & Matthews Correlation Coefficient (MCC):** Balanced measures evaluating all four quadrants of the confusion matrix.
  * **ROC-AUC & PR-AUC:** Assessing model discrimination across all decision thresholds, with PR-AUC prioritizing the minority positive class.
  * **5-Fold Cross-Validation 95% Confidence Intervals:** $\mu \pm 1.96 \cdot \frac{\sigma}{\sqrt{k}}$ to mathematically establish statistical reliability.
* **Clustering Metrics:**
  * **Silhouette Score:** Measuring cluster cohesion and separation.
  * **Davies-Bouldin Index:** Measuring cluster compactness and overlap.

---

### 8. Expected Outcome:
The project will produce an empirical machine learning pipeline that demonstrates how combining structural complexity metrics with semantic code NLP achieves superior defect detection compared to naive baseline models. By incorporating cost-sensitive loss re-weighting and decision threshold calibration, the Cost-Sensitive XGBoost model will achieve over 62.8% defect recall (a >3x improvement over uncalibrated default baselines) and reduce total operational inspection costs by over 35%. Furthermore, the system will demonstrate live vulnerability detection on unseen code snippets, providing real-time, interpretable confidence scores.

---

### 9. References / Dataset Link:
1. **Menzies, T., Greenwald, J., & Frank, A. (2007).** *"Data Mining Static Code Attributes to Learn Defect Predictors."* IEEE Transactions on Software Engineering, 33(1), 2-13.
2. **Gray, D., Bowes, D., Davey, N., Sun, Y., & Christianson, B. (2011).** *"The Misuse of the NASA Metrics Data Program Data Sets for Automated Software Defect Prediction."* Empirical Software Engineering, 17(1-2), 171-185.
3. **NASA MDP JM1 Defect Dataset:** OpenML ID 1039. Available at: https://www.openml.org/d/1039
4. **Lu, S., Guo, D., Ren, S., et al. (2021).** *"CodeXGLUE: A Machine Learning Benchmark Dataset for Code Understanding and Generation."* Available at: https://github.com/microsoft/CodeXGLUE
