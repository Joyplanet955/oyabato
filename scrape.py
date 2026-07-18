import urllib.request
import json
import re
import unicodedata
import os
from html.parser import HTMLParser

class OyabatoHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_table = False
        self.in_tbody = False
        self.in_tr = False
        self.in_td = False
        self.in_a = False
        
        self.current_row = []
        self.current_cell = {"text": "", "href": None}
        self.data = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        attrs_dict = dict(attrs)
        
        if tag == "table" and "width" in attrs_dict and attrs_dict["width"] == "700":
            self.in_table = True
        elif tag == "tbody" and self.in_table:
            self.in_tbody = True
        elif tag == "tr" and self.in_tbody:
            self.in_tr = True
            self.current_row = []
        elif tag == "td" and self.in_tr:
            self.in_td = True
            self.current_cell = {"text": "", "href": None}
        elif tag == "a" and self.in_td:
            self.in_a = True
            if "href" in attrs_dict:
                self.current_cell["href"] = attrs_dict["href"]

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "table":
            self.in_table = False
        elif tag == "tbody":
            self.in_tbody = False
        elif tag == "tr" and self.in_tr:
            self.in_tr = False
            if self.current_row:
                self.data.append(self.current_row)
        elif tag == "td" and self.in_td:
            self.in_td = False
            self.current_row.append(self.current_cell)
        elif tag == "a" and self.in_a:
            self.in_a = False

    def handle_data(self, data):
        if self.in_td:
            self.current_cell["text"] += data

def parse_era_year(era_str):
    # Normalize full-width characters to half-width
    normalized = unicodedata.normalize('NFKC', era_str).strip()
    # Match R<digits> or H<digits>
    m = re.match(r'([RH])(\d+)', normalized)
    if m:
        era_type = m.group(1)
        year_num = int(m.group(2))
        if era_type == 'R':
            return 2018 + year_num, f"令和{year_num}年", f"R{year_num}年"
        elif era_type == 'H':
            return 1988 + year_num, f"平成{year_num}年", f"H{year_num}年"
    return None, normalized, normalized

def parse_month(month_str):
    normalized = unicodedata.normalize('NFKC', month_str).strip()
    m = re.match(r'(\d+)\s*月', normalized)
    if m:
        return int(m.group(1)), f"{m.group(1)}月"
    return None, normalized

def main():
    url = "http://www.jkazokukai.or.jp/500-Oyabato/mokuji.html"
    base_url = "http://www.jkazokukai.or.jp/500-Oyabato/"
    
    print(f"Fetching {url}...")
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching URL: {e}")
        # Try local backup if running inside sandbox
        backup_path = "/Users/pptir/.gemini/antigravity/brain/5afdd068-40d9-427d-aea1-e9b1e8b634ba/.system_generated/steps/3/content.md"
        if os.path.exists(backup_path):
            print("Reading from local backup...")
            with open(backup_path, 'r', encoding='utf-8') as f:
                content = f.read()
                # strip out metadata at the beginning if present
                if "---" in content:
                    html = content.split("---", 1)[1]
                else:
                    html = content
        else:
            raise e

    parser = OyabatoHTMLParser()
    parser.feed(html)
    
    output_data = []
    
    for row in parser.data:
        if not row:
            continue
            
        # First cell is the year and month label
        label_cell = row[0]
        label_text = label_cell["text"].strip()
        if not label_text or "年" not in label_text:
            continue
            
        # Split into year and month, e.g. "R8年 6月"
        parts = re.split(r'年', label_text)
        if len(parts) < 2:
            continue
            
        year_part = parts[0] + "年"
        month_part = parts[1]
        
        western_year, era_name, era_short = parse_era_year(year_part)
        month_num, month_name = parse_month(month_part)
        
        pages = []
        for cell in row[1:]:
            cell_text = cell["text"].strip()
            href = cell["href"]
            if href and cell_text:
                full_url = href if href.startswith("http") else base_url + href
                pages.append({
                    "label": cell_text,
                    "url": full_url
                })
        
        if western_year and month_num:
            output_data.append({
                "label": label_text.replace('\u3000', ' '),
                "yearLabel": era_short,
                "eraYear": era_name,
                "westernYear": western_year,
                "monthLabel": month_name,
                "month": month_num,
                "pages": pages
            })
            
    # Sort data chronologically (descending)
    output_data.sort(key=lambda x: (x["westernYear"], x["month"]), reverse=True)
    
    output_file = "data.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
        
    print(f"Scraping complete. Saved {len(output_data)} entries to {output_file}.")

if __name__ == "__main__":
    main()
