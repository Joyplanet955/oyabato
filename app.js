document.addEventListener('DOMContentLoaded', () => {
  // --- State Variables ---
  let issuesData = [];
  let activeYear = 'all';
  let activeIssue = null;
  let activePageIndex = 0;
  
  // --- DOM Elements ---
  const themeToggleBtn = document.getElementById('theme-toggle');
  const yearFiltersContainer = document.getElementById('year-filters');
  const issuesGrid = document.getElementById('issues-grid');
  const issueCountLabel = document.getElementById('issue-count');
  const gridTitle = document.getElementById('grid-title');
  const latestIssueLabel = document.getElementById('latest-issue-label');
  
  // Reader Elements
  const readerModal = document.getElementById('reader-modal');
  const closeReaderBtn = document.getElementById('close-reader');
  const readerIssueTitle = document.getElementById('reader-issue-title');
  const readerCurrentPage = document.getElementById('reader-current-page');
  const externalLinkBtn = document.getElementById('external-link-btn');
  const downloadBtn = document.getElementById('download-btn');
  const readerPageList = document.getElementById('reader-page-list');
  const pdfViewer = document.getElementById('pdf-viewer');
  const pdfContainer = document.getElementById('pdf-container');
  const pdfFallback = document.getElementById('pdf-fallback');
  const fallbackOpenBtn = document.getElementById('fallback-open-btn');
  const fallbackDlBtn = document.getElementById('fallback-dl-btn');

  // --- Theme Management ---
  const initTheme = () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
      themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
  };

  themeToggleBtn.addEventListener('click', () => {
    if (document.body.classList.contains('dark-theme')) {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
      themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
      localStorage.setItem('theme', 'dark');
    }
  });

  // --- Fetch Data ---
  const loadData = async () => {
    try {
      const response = await fetch('data.json');
      if (!response.ok) {
        throw new Error('Failed to fetch data.json');
      }
      issuesData = await response.json();
      
      // Initialize view
      updateSyncBadge();
      renderYearFilters();
      renderIssuesGrid();
      setupGlobalEventListeners();
    } catch (error) {
      console.error('Error loading data:', error);
      issuesGrid.innerHTML = `
        <div class="loading-spinner" style="color: #dc2626;">
          <i class="fa-solid fa-circle-exclamation" style="font-size: 2.5rem; color: #dc2626;"></i>
          <p>データの読み込みに失敗しました。</p>
          <p style="font-size: 0.8rem; color: var(--text-muted);">${error.message}</p>
        </div>
      `;
      if (latestIssueLabel) {
        latestIssueLabel.textContent = '取得失敗';
      }
    }
  };

  // --- Determine & Display the Latest Issue in the Header Badge ---
  // "Latest" = the issue with the greatest westernYear, and among those
  // the greatest month. This runs automatically every time data.json is
  // (re)loaded, so the badge always reflects whatever the scraper most
  // recently fetched — no manual editing of index.html needed.
  const updateSyncBadge = () => {
    if (!latestIssueLabel) return;
    
    if (!issuesData || issuesData.length === 0) {
      latestIssueLabel.textContent = '号を検出できませんでした';
      return;
    }
    
    const latestIssue = issuesData.reduce((latest, current) => {
      const latestKey = latest.westernYear * 100 + latest.month;
      const currentKey = current.westernYear * 100 + current.month;
      return currentKey > latestKey ? current : latest;
    });
    
    latestIssueLabel.textContent = `${latestIssue.eraYear}${latestIssue.monthLabel}号`;
  };

  // --- Render Year Filters ---
  const renderYearFilters = () => {
    // Extract unique westernYears
    const yearsMap = new Map(); // westernYear -> eraYear
    issuesData.forEach(issue => {
      yearsMap.set(issue.westernYear, issue.eraYear);
    });
    
    // Sort years descending
    const sortedYears = Array.from(yearsMap.keys()).sort((a, b) => b - a);
    
    let filterHTML = '<button class="filter-tab active" data-year="all">すべて</button>';
    
    sortedYears.forEach(year => {
      const era = yearsMap.get(year);
      filterHTML += `<button class="filter-tab" data-year="${year}">${year}年 (${era})</button>`;
    });
    
    yearFiltersContainer.innerHTML = filterHTML;
    
    // Add Click Listeners
    const tabs = yearFiltersContainer.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        tabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        activeYear = e.target.getAttribute('data-year');
        renderIssuesGrid();
      });
    });
  };

  // --- Render Issues Grid ---
  const renderIssuesGrid = () => {
    // Filter issues based on active year
    const filteredIssues = activeYear === 'all' 
      ? issuesData 
      : issuesData.filter(issue => issue.westernYear.toString() === activeYear);
      
    // Update labels
    if (activeYear === 'all') {
      gridTitle.textContent = 'すべての発行紙';
    } else {
      const firstIssue = filteredIssues[0];
      gridTitle.textContent = `${firstIssue.westernYear}年 (${firstIssue.eraYear}) の発行紙`;
    }
    issueCountLabel.textContent = `${filteredIssues.length}個の号を検出`;
    
    if (filteredIssues.length === 0) {
      issuesGrid.innerHTML = `
        <div class="loading-spinner">
          <i class="fa-solid fa-folder-open"></i>
          <p>該当する発行紙が見つかりませんでした。</p>
        </div>
      `;
      return;
    }
    
    issuesGrid.innerHTML = '';
    
    filteredIssues.forEach((issue, index) => {
      const card = document.createElement('article');
      card.className = 'issue-card';
      
      // Cover layout variables
      const displayEra = issue.eraYear;
      const displayMonth = issue.monthLabel;
      
      // Page chips html
      let chipsHTML = '';
      issue.pages.forEach((page, pageIdx) => {
        chipsHTML += `<button class="page-chip" data-page-idx="${pageIdx}">${page.label}</button>`;
      });
      
      card.innerHTML = `
        <div class="issue-cover">
          <div class="cover-header">
            <span>防衛情報紙「おやばと」</span>
            <span>第${12 - (index % 12)}号相当</span>
          </div>
          <div class="cover-body">
            <div class="cover-title">おやばと</div>
            <div class="cover-subtitle">${displayEra} ${displayMonth}号</div>
          </div>
          <div class="cover-deco-lines">
            <div class="cover-deco-line"></div>
            <div class="cover-deco-line"></div>
            <div class="cover-deco-line"></div>
          </div>
        </div>
        <div class="issue-details">
          <div class="issue-meta">
            <h3 class="issue-name-title">${displayEra} ${displayMonth}号</h3>
            <p class="issue-sub-date">西暦 ${issue.westernYear}年 ${issue.month}月発行 / 全${issue.pages.length}面収録</p>
          </div>
          
          <div class="issue-pages-section">
            <h4>掲載紙面 (面を選択して開く)</h4>
            <div class="pages-chip-container">
              ${chipsHTML}
            </div>
          </div>
          
          <button class="read-issue-btn">
            <i class="fa-solid fa-book-open"></i> この号を読む
          </button>
        </div>
      `;
      
      // Event Listeners for Page Chips
      const chips = card.querySelectorAll('.page-chip');
      chips.forEach(chip => {
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          const pageIdx = parseInt(e.target.getAttribute('data-page-idx'));
          openReader(issue, pageIdx);
        });
      });
      
      // Event Listener for the main button
      const readBtn = card.querySelector('.read-issue-btn');
      readBtn.addEventListener('click', () => {
        openReader(issue, 0);
      });
      
      issuesGrid.appendChild(card);
    });
  };

  // --- Open Reader Modal ---
  const openReader = (issue, pageIndex = 0) => {
    activeIssue = issue;
    activePageIndex = pageIndex;
    
    // Show Modal
    readerModal.classList.add('open');
    readerModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // prevent background scrolling
    
    // Set Header Info
    readerIssueTitle.textContent = `${activeIssue.eraYear} ${activeIssue.monthLabel}号`;
    
    // Render Page List Sidebar
    renderSidebarPageList();
    
    // Load PDF
    loadPDF();
  };

  // --- Close Reader Modal ---
  const closeReader = () => {
    readerModal.classList.remove('open');
    readerModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = ''; // restore scrolling
    
    // Reset iframe to avoid network requests running in background
    pdfViewer.src = '';
    
    activeIssue = null;
    activePageIndex = 0;
  };

  // --- Render Sidebar Page List ---
  const renderSidebarPageList = () => {
    readerPageList.innerHTML = '';
    
    activeIssue.pages.forEach((page, idx) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = `page-item-btn ${idx === activePageIndex ? 'active' : ''}`;
      btn.setAttribute('data-idx', idx);
      
      btn.innerHTML = `
        <span>${page.label}</span>
        <span class="page-indicator">${idx + 1} / ${activeIssue.pages.length}</span>
      `;
      
      btn.addEventListener('click', () => {
        // Change page
        const itemButtons = readerPageList.querySelectorAll('.page-item-btn');
        itemButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        activePageIndex = idx;
        loadPDF();
      });
      
      li.appendChild(btn);
      readerPageList.appendChild(li);
    });
  };

  // --- Load PDF into Viewer ---
  const loadPDF = () => {
    if (!activeIssue || !activeIssue.pages[activePageIndex]) return;
    
    const page = activeIssue.pages[activePageIndex];
    
    // Update UI headers
    readerCurrentPage.textContent = `第 ${page.label}`;
    
    // Update external links and downloads
    externalLinkBtn.href = page.url;
    downloadBtn.href = page.url;
    
    fallbackOpenBtn.href = page.url;
    fallbackDlBtn.href = page.url;
    
    // Show loading state / hide fallback
    pdfContainer.style.display = 'block';
    pdfFallback.style.display = 'none';
    
    // Use Google Docs Viewer to bypass Mixed Content blocks (HTTPS parent with HTTP PDF)
    // and resolve inconsistent browser PDF plugin behavior inside iframes.
    pdfViewer.src = `https://docs.google.com/gview?url=${encodeURIComponent(page.url)}&embedded=true`;
  };

  // --- Setup Event Listeners ---
  const setupGlobalEventListeners = () => {
    closeReaderBtn.addEventListener('click', closeReader);
    
    // Close modal on click outside container
    readerModal.addEventListener('click', (e) => {
      if (e.target === readerModal) {
        closeReader();
      }
    });
    
    // Keyboard Esc support
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && readerModal.classList.contains('open')) {
        closeReader();
      }
    });
  };

  // --- Init ---
  initTheme();
  loadData();
});
