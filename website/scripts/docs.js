// Weezy Documentation JavaScript

// Tab functionality
function showTab(tabId) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Activate button
    const selectedBtn = document.querySelector(`[onclick="showTab('${tabId}')"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
}

// Copy to clipboard functionality
function copyToClipboard(button) {
    const codeBlock = button.closest('.code-block');
    const code = codeBlock.querySelector('code');
    
    if (code) {
        // Get text content without HTML
        const text = code.textContent || code.innerText;
        
        // Copy to clipboard
        navigator.clipboard.writeText(text).then(() => {
            // Show success feedback
            const originalText = button.textContent;
            button.textContent = '✅ Copied!';
            button.style.background = '#10b981';
            button.style.color = 'white';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = 'none';
                button.style.color = 'var(--weezy-accent)';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            button.textContent = '✅ Copied!';
            setTimeout(() => {
                button.textContent = '📋 Copy';
            }, 2000);
        });
    }
}

// Smooth scrolling for anchor links
document.addEventListener('DOMContentLoaded', function() {
    // Handle anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                
                // Update URL without triggering scroll
                history.pushState(null, null, this.getAttribute('href'));
            }
        });
    });
    
    // Highlight current section in TOC
    const observerOptions = {
        threshold: 0.3,
        rootMargin: '-100px 0px -50% 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                if (id) {
                    // Remove active class from all TOC links
                    document.querySelectorAll('.toc a').forEach(link => {
                        link.classList.remove('active-section');
                    });
                    
                    // Add active class to current section
                    const tocLink = document.querySelector(`.toc a[href="#${id}"]`);
                    if (tocLink) {
                        tocLink.classList.add('active-section');
                    }
                }
            }
        });
    }, observerOptions);
    
    // Observe all sections with IDs
    document.querySelectorAll('section[id]').forEach(section => {
        observer.observe(section);
    });
    
    // Add syntax highlighting for code blocks
    highlightCodeBlocks();
    
    // Initialize platform-specific content
    showPlatformSpecificContent();
});

// Syntax highlighting (simple version)
function highlightCodeBlocks() {
    document.querySelectorAll('code').forEach(code => {
        let html = code.innerHTML;
        
        // Highlight comments
        html = html.replace(/(#.*$)/gm, '<span style="color: #64748b; font-style: italic;">$1</span>');
        
        // Highlight commands
        html = html.replace(/^(sudo|wget|curl|npm|yarn|git|docker|kubectl)\s/gm, '<span style="color: #10b981; font-weight: 600;">$1</span> ');
        
        // Highlight strings
        html = html.replace(/"([^"]*)"/g, '<span style="color: #fbbf24;">"$1"</span>');
        
        // Highlight URLs
        html = html.replace(/(https?:\/\/[^\s]+)/g, '<span style="color: #06b6d4; text-decoration: underline;">$1</span>');
        
        code.innerHTML = html;
    });
}

// Show platform-specific content
function showPlatformSpecificContent() {
    const platform = detectPlatform();
    
    // Highlight platform-specific sections
    const platformSections = document.querySelectorAll(`[data-platform="${platform}"]`);
    platformSections.forEach(section => {
        section.style.border = '2px solid var(--weezy-primary)';
        section.style.boxShadow = '0 0 20px rgba(99, 102, 241, 0.3)';
        
        // Add recommended badge
        const badge = document.createElement('div');
        badge.textContent = '✨ Recommended for your system';
        badge.style.cssText = `
            position: absolute;
            top: -10px;
            right: 20px;
            background: var(--weezy-gradient);
            color: white;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        `;
        section.style.position = 'relative';
        section.appendChild(badge);
    });
}

// Platform detection (same as main site)
function detectPlatform() {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();
    
    if (platform.includes('mac') || userAgent.includes('mac')) {
        return 'macos';
    }
    
    if (platform.includes('win') || userAgent.includes('win')) {
        return 'windows';
    }
    
    if (platform.includes('linux') || userAgent.includes('linux') || userAgent.includes('x11')) {
        return 'linux';
    }
    
    return 'linux';
}

// Search functionality
function initDocsSearch() {
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = '🔍 Search documentation...';
    searchInput.style.cssText = `
        width: 100%;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(99, 102, 241, 0.2);
        border-radius: 8px;
        color: white;
        font-family: var(--font-family);
        margin-bottom: 20px;
    `;
    
    searchInput.addEventListener('input', (e) => {
        searchDocumentation(e.target.value);
    });
    
    const sidebar = document.querySelector('.docs-sidebar');
    if (sidebar) {
        sidebar.insertBefore(searchInput, sidebar.querySelector('.sidebar-nav'));
    }
}

function searchDocumentation(query) {
    const sections = document.querySelectorAll('.docs-section');
    const searchResults = [];
    
    if (query.length < 2) {
        // Reset visibility
        sections.forEach(section => {
            section.style.display = 'block';
        });
        return;
    }
    
    sections.forEach(section => {
        const text = section.textContent.toLowerCase();
        const matches = text.includes(query.toLowerCase());
        
        if (matches) {
            section.style.display = 'block';
            searchResults.push(section);
        } else {
            section.style.display = 'none';
        }
    });
    
    // Show search results count
    showSearchResults(searchResults.length, query);
}

function showSearchResults(count, query) {
    let resultsDiv = document.querySelector('.search-results');
    
    if (!resultsDiv) {
        resultsDiv = document.createElement('div');
        resultsDiv.className = 'search-results';
        resultsDiv.style.cssText = `
            background: rgba(6, 182, 212, 0.1);
            border: 1px solid rgba(6, 182, 212, 0.2);
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 20px;
            color: var(--weezy-accent);
            font-size: 14px;
        `;
        
        const content = document.querySelector('.docs-content');
        content.insertBefore(resultsDiv, content.firstChild);
    }
    
    if (count === 0) {
        resultsDiv.innerHTML = `❌ No results found for "${query}"`;
    } else {
        resultsDiv.innerHTML = `✅ Found ${count} section${count !== 1 ? 's' : ''} matching "${query}"`;
    }
}

// Add CSS for active TOC sections
const docsStyles = document.createElement('style');
docsStyles.textContent = `
    .toc a.active-section {
        color: var(--weezy-accent) !important;
        font-weight: 600;
    }
    
    .toc a.active-section::before {
        content: '✨';
        color: var(--weezy-light);
    }
`;
document.head.appendChild(docsStyles);

// Initialize documentation features
document.addEventListener('DOMContentLoaded', () => {
    console.log('📖 Weezy Documentation loaded');
    initDocsSearch();
});