import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.datasets import fetch_openml

print('Fetching JM1 dataset from OpenML...')
# Fetch the NASA JM1 software defect dataset
jm1 = fetch_openml(name='jm1', version=1, as_frame=True, parser='auto')
df = jm1.frame

print('Dataset shape:', df.shape)
print('Target distribution:')
print(df['defects'].value_counts())

# Save dataset to CSV for offline usage in the notebook
df.to_csv('nasa_jm1.csv', index=False)
print('Saved nasa_jm1.csv')
