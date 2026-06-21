import os
import re
import html
import json
import requests
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = "cache_notes.json"

def strip_html_tags(html_string):
    if not html_string:
        return ""
    # Strip HTML tags
    clean = re.sub(r'<[^>]+>', '', html_string)
    # Normalize whitespaces
    clean = ' '.join(clean.split())
    return html.unescape(clean)

def parse_feed():
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        xml_data = response.content
    except Exception as e:
        print(f"Error fetching feed: {e}")
        return None

    try:
        root = ET.fromstring(xml_data)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        updates = []
        for entry in root.findall('atom:entry', ns):
            title_elem = entry.find('atom:title', ns)
            date_str = title_elem.text.strip() if title_elem is not None and title_elem.text else ""
            
            link_elem = entry.find('atom:link', ns)
            link_href = link_elem.attrib.get('href', '') if link_elem is not None else ''
            
            content_elem = entry.find('atom:content', ns)
            content_html = content_elem.text if content_elem is not None else ''
            
            entry_id_elem = entry.find('atom:id', ns)
            entry_id = entry_id_elem.text if entry_id_elem is not None else 'no-id'
            
            if not content_html:
                continue
                
            # Split the HTML content by <h3> tags
            parts = re.split(r'<h3>(.*?)</h3>', content_html)
            
            # If there's content before the first <h3> (unlikely, but safe backup)
            first_part = parts[0].strip()
            if first_part:
                plain = strip_html_tags(first_part)
                updates.append({
                    'id': f"{entry_id}_pre",
                    'date': date_str,
                    'category': 'General',
                    'body': first_part,
                    'plain_text': plain,
                    'link': link_href
                })
                
            idx = 0
            for i in range(1, len(parts), 2):
                category = parts[i].strip()
                body = parts[i+1].strip() if i+1 < len(parts) else ""
                if body:
                    plain = strip_html_tags(body)
                    updates.append({
                        'id': f"{entry_id}_{idx}",
                        'date': date_str,
                        'category': category,
                        'body': body,
                        'plain_text': plain,
                        'link': link_href
                    })
                    idx += 1
                    
        return updates
    except Exception as e:
        print(f"Error parsing feed: {e}")
        return None

def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading cache file: {e}")
    return []

def save_cache(data):
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving cache file: {e}")

# In-memory cache loaded from file at startup
_cached_updates = load_cache()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes')
def get_notes():
    global _cached_updates
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    if force_refresh or not _cached_updates:
        parsed = parse_feed()
        if parsed:
            _cached_updates = parsed
            save_cache(_cached_updates)
        elif not _cached_updates:
            # If fetch failed and we have absolutely no cache, return error
            return jsonify({
                'success': False,
                'error': 'Failed to fetch release notes from Google Cloud and no local cache was found. Please try again.',
                'notes': []
            }), 503
            
    return jsonify({
        'success': True,
        'notes': _cached_updates
    })

if __name__ == '__main__':
    # Using 5001 to avoid conflicts on macOS where port 5000 is occupied by AirPlay Receiver
    app.run(debug=True, port=5001)
