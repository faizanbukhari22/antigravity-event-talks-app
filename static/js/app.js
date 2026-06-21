// State Management
let notesState = [];
let activeCategory = 'all';
let searchQuery = '';

// DOM Elements
const feedGrid = document.getElementById('feed-grid');
const searchInput = document.getElementById('search-input');
const filterTags = document.querySelectorAll('.filter-tag');
const btnRefresh = document.getElementById('btn-refresh');
const btnExportCSV = document.getElementById('btn-export-csv');
const statsCount = document.getElementById('stats-count');
const emptyState = document.getElementById('empty-state');
const btnResetFilters = document.getElementById('btn-reset-filters');
const toastContainer = document.getElementById('toast-container');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnModalCancel = document.getElementById('btn-modal-cancel');
const btnModalTweet = document.getElementById('btn-modal-tweet');
const tweetTextarea = document.getElementById('tweet-textarea');
const tweetPreviewText = document.getElementById('tweet-preview-text');
const charCounter = document.getElementById('char-counter');

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // Initialize Theme (Dark/Light mode)
  initTheme();

  // Fetch notes on load
  fetchNotes(false);

  // Search Input listener
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderFeed();
  });

  // Filter tag click listeners
  filterTags.forEach(tag => {
    tag.addEventListener('click', (e) => {
      filterTags.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      activeCategory = e.target.dataset.category;
      renderFeed();
    });
  });

  // Refresh Button click
  btnRefresh.addEventListener('click', () => {
    fetchNotes(true);
  });

  // Export CSV click
  btnExportCSV.addEventListener('click', exportToCSV);

  // Reset Filters click
  btnResetFilters.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    filterTags.forEach(t => t.classList.remove('active'));
    document.querySelector('[data-category="all"]').classList.add('active');
    activeCategory = 'all';
    renderFeed();
  });

  // Modal event listeners
  btnCloseModal.addEventListener('click', () => tweetModal.close());
  btnModalCancel.addEventListener('click', () => tweetModal.close());
  btnModalTweet.addEventListener('click', submitTweet);

  // Real-time character count and preview update
  tweetTextarea.addEventListener('input', handleTweetTextareaInput);

  // Safari native dialog light-dismiss polyfill
  setupDialogPolyfill(tweetModal);
}

// Dialog polyfill for closing when clicking the backdrop (Safari support)
function setupDialogPolyfill(dialog) {
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isInside = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isInside) {
        dialog.close();
      }
    });
  }
}

// Character counter & link replacement preview
function getTwitterCharCount(text) {
  const urlRegex = /https?:\/\/[^\s]+/g;
  let count = text.length;
  let match;
  // Twitter treats any URL as exactly 23 characters
  while ((match = urlRegex.exec(text)) !== null) {
    count = count - match[0].length + 23;
  }
  return count;
}

function handleTweetTextareaInput() {
  const text = tweetTextarea.value;
  const count = getTwitterCharCount(text);
  
  charCounter.textContent = `${count} / 280`;
  
  // Visual warnings based on count
  charCounter.className = '';
  if (count > 280) {
    charCounter.classList.add('danger');
    btnModalTweet.disabled = true;
  } else if (count > 250) {
    charCounter.classList.add('warning');
    btnModalTweet.disabled = false;
  } else {
    btnModalTweet.disabled = false;
  }

  // Update preview rendering (highlight URLs)
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const previewHtml = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    
  tweetPreviewText.innerHTML = previewHtml;
}

// Fetch release notes from backend API
async function fetchNotes(forceRefresh = false) {
  toggleLoadingState(true);
  
  try {
    const url = forceRefresh ? '/api/notes?refresh=true' : '/api/notes';
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success && data.notes) {
      notesState = data.notes;
      renderFeed();
      if (forceRefresh) {
        showToast('Release notes successfully updated!', 'success');
      }
    } else {
      showToast(data.error || 'Failed to retrieve release notes.', 'error');
      renderEmptyState();
    }
  } catch (error) {
    console.error('Error fetching release notes:', error);
    showToast('Failed to connect to the backend server.', 'error');
    renderEmptyState();
  } finally {
    toggleLoadingState(false);
  }
}

// Toggle refresh spinner & display skeleton cards
function toggleLoadingState(loading) {
  if (loading) {
    btnRefresh.classList.add('btn-refresh-spin');
    btnRefresh.disabled = true;
    
    // Render loading skeletons
    feedGrid.innerHTML = `
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    `;
    emptyState.classList.add('hidden');
    statsCount.textContent = 'Fetching latest updates...';
  } else {
    btnRefresh.classList.remove('btn-refresh-spin');
    btnRefresh.disabled = false;
  }
}

// Filter and render updates grid
function renderFeed() {
  // Clear grid
  feedGrid.innerHTML = '';
  
  // Filter logic
  const filtered = notesState.filter(note => {
    // 1. Category Filter
    const catMatch = activeCategory === 'all' || 
                     note.category.toLowerCase() === activeCategory.toLowerCase();
                     
    // 2. Search Filter
    const searchMatch = !searchQuery || 
                        note.date.toLowerCase().includes(searchQuery) ||
                        note.category.toLowerCase().includes(searchQuery) ||
                        note.plain_text.toLowerCase().includes(searchQuery);
                        
    return catMatch && searchMatch;
  });

  // Update Stats
  statsCount.textContent = `${filtered.length} updates found`;

  if (filtered.length === 0) {
    renderEmptyState();
    return;
  }

  emptyState.classList.add('hidden');

  // Render cards
  filtered.forEach((note, index) => {
    const card = createCardElement(note, index);
    feedGrid.appendChild(card);
    
    // Check if we need to show "Read More" button due to truncation
    const body = card.querySelector('.card-body');
    const readMoreBtn = card.querySelector('.read-more-btn');
    if (body.scrollHeight > body.clientHeight) {
      readMoreBtn.style.display = 'block';
    }
  });
}

function renderEmptyState() {
  feedGrid.innerHTML = '';
  emptyState.classList.remove('hidden');
  statsCount.textContent = '0 updates found';
}

// Create a DOM card element
function createCardElement(note, index) {
  const card = document.createElement('article');
  card.className = 'feed-card';
  // Stagger entry animations
  card.style.animationDelay = `${Math.min(index * 0.05, 0.4)}s`;

  // Get lowercase class for badge
  const badgeClass = note.category.toLowerCase();
  
  card.innerHTML = `
    <header class="card-header">
      <span class="category-badge ${badgeClass}">${escapeHtml(note.category)}</span>
      <span class="card-date">
        <svg class="icon icon-calendar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        ${escapeHtml(note.date)}
      </span>
    </header>
    
    <div class="card-body">
      ${note.body}
    </div>
    <button class="read-more-btn">Read More</button>
    
    <footer class="card-footer">
      <a href="${escapeHtml(note.link)}" target="_blank" rel="noopener noreferrer" class="btn-card-link" title="View official release documentation">
        Official Docs
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </a>
      
      <div class="card-actions-right">
        <button class="btn-card-copy" title="Copy release note text to clipboard">
          <svg class="icon icon-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        </button>
        
        <button class="btn-card-tweet" title="Select and Tweet about this update">
          <svg class="icon-twitter" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          Tweet
        </button>
      </div>
    </footer>
  `;

  // Attach event listener for "Read More" button
  const body = card.querySelector('.card-body');
  const readMoreBtn = card.querySelector('.read-more-btn');
  readMoreBtn.addEventListener('click', () => {
    if (body.classList.contains('expanded')) {
      body.classList.remove('expanded');
      readMoreBtn.textContent = 'Read More';
    } else {
      body.classList.add('expanded');
      readMoreBtn.textContent = 'Show Less';
    }
  });

  // Attach event listener for "Copy" click
  const copyBtn = card.querySelector('.btn-card-copy');
  copyBtn.addEventListener('click', () => {
    copyToClipboard(note, copyBtn);
  });

  // Attach event listener for "Tweet" click
  const tweetBtn = card.querySelector('.btn-card-tweet');
  tweetBtn.addEventListener('click', () => {
    openTweetModal(note);
  });

  return card;
}

// Open tweet composer with pre-filled content
function openTweetModal(note) {
  // Budget characters: 
  // Max 280. Link is 23 chars. Space before link is 1.
  // Prefix "BigQuery [Category]: " varies by category.
  const prefix = `BigQuery [${note.category}]: `;
  const linkText = ` ${note.link}`;
  
  // Standard link consumes exactly 23 characters on Twitter/X
  const allowedBodyLen = 280 - 23 - 1 - prefix.length - 4; // 4 characters for ' ...'
  
  let mainBody = note.plain_text;
  if (mainBody.length > allowedBodyLen) {
    mainBody = mainBody.substring(0, allowedBodyLen).trim() + '...';
  }
  
  const draftText = `${prefix}${mainBody}${linkText}`;
  
  tweetTextarea.value = draftText;
  handleTweetTextareaInput();
  
  tweetModal.showModal();
}

// Open Twitter Web Intent link
function submitTweet() {
  const tweetText = tweetTextarea.value;
  const count = getTwitterCharCount(tweetText);
  
  if (count > 280) {
    showToast('Tweet content exceeds the 280-character limit!', 'error');
    return;
  }
  
  const encodedText = encodeURIComponent(tweetText);
  const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
  
  window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
  tweetModal.close();
  showToast('Opening Twitter / X share composer!', 'info');
}

// Helper to escape HTML tags
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Toast notification helper
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  toastContainer.appendChild(toast);
  
  // Remove toast after 4.5 seconds
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s forwards';
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 4200);
}

// Extra animation keyframes for toast exiting added to document stylesheet dynamically
const style = document.createElement('style');
style.textContent = `
@keyframes toastOut {
  to {
    opacity: 0;
    transform: translateX(120%);
  }
}
`;
document.head.appendChild(style);

// Copies plain-text release note information to clipboard
async function copyToClipboard(note, copyBtn) {
  const textToCopy = `BigQuery Release Note [${note.date}] (${note.category}):\n${note.plain_text}\nSource: ${note.link}`;
  try {
    await navigator.clipboard.writeText(textToCopy);
    copyBtn.classList.add('copied');
    const originalContent = copyBtn.innerHTML;
    copyBtn.innerHTML = `
      <svg class="icon icon-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Copied!
    `;
    showToast('Copied release note to clipboard!', 'success');
    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyBtn.innerHTML = originalContent;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy text: ', err);
    showToast('Failed to copy to clipboard.', 'error');
  }
}

// Exports currently filtered release notes to a CSV file
function exportToCSV() {
  const filtered = notesState.filter(note => {
    const catMatch = activeCategory === 'all' || 
                     note.category.toLowerCase() === activeCategory.toLowerCase();
    const searchMatch = !searchQuery || 
                        note.date.toLowerCase().includes(searchQuery) ||
                        note.category.toLowerCase().includes(searchQuery) ||
                        note.plain_text.toLowerCase().includes(searchQuery);
    return catMatch && searchMatch;
  });

  if (filtered.length === 0) {
    showToast('No updates found to export.', 'error');
    return;
  }

  const headers = ['ID', 'Date', 'Category', 'Plain Text', 'Link'];
  
  const escapeCSV = (text) => {
    if (text === null || text === undefined) return '';
    let stringVal = String(text);
    stringVal = stringVal.replace(/"/g, '""');
    if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n') || stringVal.includes('\r')) {
      return `"${stringVal}"`;
    }
    return stringVal;
  };

  const csvRows = [];
  csvRows.push(headers.join(','));

  for (const note of filtered) {
    const row = [
      note.id,
      note.date,
      note.category,
      note.plain_text,
      note.link
    ];
    csvRows.push(row.map(escapeCSV).join(','));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  
  const catFilename = activeCategory === 'all' ? 'all' : activeCategory.toLowerCase();
  const searchFilename = searchQuery ? `_search_${searchQuery.substring(0, 10).replace(/[^a-z0-9]/gi, '_')}` : '';
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `bigquery_release_notes_${catFilename}${searchFilename}_${dateStr}.csv`);
  
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast(`Successfully exported ${filtered.length} notes to CSV!`, 'success');
}

// Light / Dark Theme state management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);

  const themeToggleBtn = document.getElementById('theme-toggle');
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  });
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);

  const darkIcon = document.getElementById('theme-toggle-dark-icon');
  const lightIcon = document.getElementById('theme-toggle-light-icon');

  if (theme === 'light') {
    darkIcon.classList.add('hidden');
    lightIcon.classList.remove('hidden');
  } else {
    lightIcon.classList.add('hidden');
    darkIcon.classList.remove('hidden');
  }
}
