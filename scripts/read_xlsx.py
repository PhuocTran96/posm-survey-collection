#!/usr/bin/env python3
import sys
import json
import pandas as pd

def read_xlsx(file_path):
    try:
        df = pd.read_excel(file_path)
        df = df.fillna('')
        data = df.to_dict(orient='records')
        print(json.dumps(data))
    except Exception as e:
        print(json.dumps({'error': str(e)}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python read_xlsx.py <file_path>")
        sys.exit(1)
    
    read_xlsx(sys.argv[1])
