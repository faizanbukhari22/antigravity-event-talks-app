# BigQuery Release Notes Hub ⚡

A lightweight, responsive web dashboard built with Python (Flask) and Vanilla JavaScript to fetch, cache, index, and share the latest Google Cloud BigQuery release updates.

---

## 🚀 Features

* **Real-time Ingestion**: Fetches Google Cloud's official BigQuery release notes XML feed dynamically.
* **Smart Disk Caching**: Implements a persistent local caching mechanism (`cache_notes.json`) to minimize upstream API calls and guarantee offline compatibility.
* **Instant Filtering & Search**: Client-side filtering by categories (Features, Announcements, Issues, Deprecations, General) and reactive keyword search across updates.
* **Modern Aesthetic UI**: Premium design styling using custom CSS properties, background glows, staggered grid entry animations, and responsive skeleton loaders.
* **Twitter / X Sharing Integration**: Built-in modal dialog to compose tweets prefilled with release content and docs link, with character count logic respecting Twitter's URL-shortening policy.
* **Toast Notification System**: Dynamic, non-blocking alerts that confirm data updates or network errors.

---

## 🛠️ Tech Stack

* **Backend**: Python 3, Flask, Requests, XML ElementTree.
* **Frontend**: HTML5 (native `<dialog>` elements), Vanilla CSS3 (custom variables), ES6 Javascript.

---

## 📦 Directory Structure

```text
bq-releases-notes/
├── static/
│   ├── css/
│   │   └── style.css          # Modern, responsive layout stylesheet
│   └── js/
│       └── app.js             # State management, UI logic, search & share actions
├── templates/
│   └── index.html             # HTML layout template
├── app.py                     # Flask server with feed parser & caching engine
├── requirements.txt           # Python application dependencies
├── cache_notes.json           # Local cache persistence store (git-ignored)
└── .gitignore                 # Configured to exclude environments, caches, and IDE files
```

---

## ⚙️ Getting Started

Follow these steps to run the application locally.

### 1. Prerequisites
Ensure you have **Python 3.8+** installed on your machine.

### 2. Set Up a Virtual Environment (Optional but recommended)
Navigate to the project root and create a virtual environment:

```bash
# Create environment
python3 -m venv venv

# Activate on macOS/Linux:
source venv/bin/activate

# Activate on Windows (Command Prompt):
venv\Scripts\activate.bat

# Activate on Windows (PowerShell):
.\venv\Scripts\Activate.ps1
```

### 3. Install Dependencies
Install all required libraries using `pip`:

```bash
pip install -r requirements.txt
```

### 4. Run the Application
Execute the Flask server:

```bash
python app.py
```
The server will start on port `5001` (to avoid conflicts on macOS with AirPlay Receiver which binds on port 5000):
```text
 * Running on http://127.0.0.1:5001
```

Open [http://127.0.0.1:5001](http://127.0.0.1:5001) in your web browser.

---

## 🔄 How the Caching Works
1. When a user opens the app, the client requests `/api/notes`.
2. The server checks the local memory cache. If empty, it loads the parsed notes from [cache_notes.json](cache_notes.json).
3. If a user clicks **Refresh Feed**, the client queries `/api/notes?refresh=true`.
4. The server queries the live Google RSS feed, processes the data, rewrites `cache_notes.json`, updates the memory, and returns the latest data.
