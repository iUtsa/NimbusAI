import pandas as pd
import json

# List of CSV files
csv_files = ["backend/data1.csv", "backend/data2.csv", "backend/data3.csv"]  
output_jsonl = "backend/training_data.jsonl"

def csv_to_jsonl(csv_files, output_jsonl):
    with open(output_jsonl, "w", encoding="utf-8") as jsonl_file:
        for csv_file in csv_files:
            df = pd.read_csv(csv_file)

            # Ensure correct column names
            if "question" not in df.columns or "answer" not in df.columns:
                print(f"❌ Skipping {csv_file} (Missing 'question' or 'answer' column)")
                continue

            for _, row in df.iterrows():
                conversation = {
                    "messages": [
                        {"role": "user", "content": row["question"]},
                        {"role": "assistant", "content": row["answer"]}
                    ]
                }
                jsonl_file.write(json.dumps(conversation) + "\n")

    print(f"✅ Conversion complete! Data saved to `{output_jsonl}`")

# Convert CSV to JSONL
csv_to_jsonl(csv_files, output_jsonl)
