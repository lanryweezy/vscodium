// Weezy Download System - Advanced download management

class WeezyDownloadManager {
    constructor() {
        this.baseUrl = 'https://github.com/weezy-dev/weezy/releases/latest/download/';
        this.fallbackUrl = 'https://weezy.dev/downloads/';
        this.downloadStats = this.loadDownloadStats();
        
        this.initDownloadSystem();
    }

    initDownloadSystem() {
        // Auto-detect platform and highlight
        this.highlightRecommendedPlatform();
        
        // Setup download event listeners
        this.setupDownloadTracking();
        
        // Check for latest version
        this.checkLatestVersion();
        
        // Setup download progress tracking
        this.setupProgressTracking();
    }

    highlightRecommendedPlatform() {
        const platform = this.detectPlatform();
        const platformCard = document.querySelector(`[data-platform="${platform}"]`);
        
        if (platformCard) {
            platformCard.classList.add('recommended-platform');
            
            // Add recommendation badge
            const badge = document.createElement('div');
            badge.className = 'recommendation-badge';
            badge.innerHTML = '✨ Recommended for your system';
            platformCard.appendChild(badge);
            
            // Scroll into view if not visible
            setTimeout(() => {
                if (!this.isElementInViewport(platformCard)) {
                    platformCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 1000);
        }
    }

    detectPlatform() {
        const userAgent = navigator.userAgent.toLowerCase();
        const platform = navigator.platform.toLowerCase();
        
        // More detailed platform detection
        if (platform.includes('mac') || userAgent.includes('mac')) {
            return 'macos';
        }
        
        if (platform.includes('win') || userAgent.includes('win')) {
            return 'windows';
        }
        
        if (platform.includes('linux') || userAgent.includes('linux') || userAgent.includes('x11')) {
            return 'linux';
        }
        
        // Mobile detection
        if (userAgent.includes('android')) {
            this.showMobileMessage('Android');
            return 'linux'; // Fallback to Linux
        }
        
        if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
            this.showMobileMessage('iOS');
            return 'macos'; // Fallback to macOS
        }
        
        return 'linux'; // Default fallback
    }

    showMobileMessage(mobileOS) {
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--weezy-gradient);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            text-align: center;
            max-width: 300px;
        `;
        
        message.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">📱 Mobile Detected</div>
            <div style="font-size: 14px; opacity: 0.9;">
                Weezy is designed for desktop development. 
                Please visit on a ${mobileOS === 'iOS' ? 'Mac' : 'PC'} to download.
            </div>
        `;
        
        document.body.appendChild(message);
        
        setTimeout(() => message.remove(), 5000);
    }

    async checkLatestVersion() {
        try {
            const response = await fetch('https://api.github.com/repos/weezy-dev/weezy/releases/latest');
            const release = await response.json();
            
            this.updateVersionInfo(release);
            this.updateDownloadLinks(release);
            
        } catch (error) {
            console.warn('Could not fetch latest version info:', error);
            this.showFallbackDownloads();
        }
    }

    updateVersionInfo(release) {
        const versionElements = document.querySelectorAll('.version-info');
        versionElements.forEach(el => {
            el.textContent = `Latest: ${release.tag_name}`;
        });
        
        // Update footer version
        const footerVersion = document.querySelector('.footer-version');
        if (footerVersion) {
            footerVersion.textContent = `Version ${release.tag_name} • Built with ❤️ and 43 AI agents`;
        }
        
        // Show release notes link
        this.showReleaseNotes(release);
    }

    updateDownloadLinks(release) {
        // Update download URLs with actual release assets
        const assets = release.assets;
        
        assets.forEach(asset => {
            const button = document.querySelector(`[data-asset="${asset.name}"]`);
            if (button) {
                button.onclick = () => this.downloadAsset(asset);
            }
        });
    }

    showReleaseNotes(release) {
        const releaseNotes = document.createElement('div');
        releaseNotes.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid var(--weezy-primary);
            border-radius: 12px;
            padding: 16px;
            max-width: 300px;
            backdrop-filter: blur(10px);
            z-index: 1000;
        `;
        
        releaseNotes.innerHTML = `
            <div style="color: var(--weezy-primary-light); font-weight: 600; margin-bottom: 8px;">
                🚀 ${release.tag_name} Available
            </div>
            <div style="color: rgba(255,255,255,0.8); font-size: 14px; margin-bottom: 12px;">
                ${release.name || 'Latest version with enhanced AI agents'}
            </div>
            <button onclick="window.open('${release.html_url}', '_blank')" 
                    style="background: var(--weezy-gradient); border: none; color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                View Release Notes
            </button>
            <button onclick="this.parentElement.remove()" 
                    style="background: none; border: none; color: rgba(255,255,255,0.5); float: right; cursor: pointer; font-size: 16px;">
                ×
            </button>
        `;
        
        document.body.appendChild(releaseNotes);
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (releaseNotes.parentElement) {
                releaseNotes.remove();
            }
        }, 10000);
    }

    showFallbackDownloads() {
        // Show message about building from source
        const fallbackMessage = document.createElement('div');
        fallbackMessage.style.cssText = `
            background: rgba(245, 158, 11, 0.1);
            border: 1px solid var(--weezy-light);
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
        `;
        
        fallbackMessage.innerHTML = `
            <div style="color: var(--weezy-light); font-weight: 600; margin-bottom: 8px;">
                🔧 Pre-built binaries coming soon!
            </div>
            <div style="color: rgba(255,255,255,0.8); margin-bottom: 16px;">
                For now, you can build Weezy from source using our automated build system.
            </div>
            <button onclick="window.open('https://github.com/weezy-dev/weezy#building-from-source', '_blank')" 
                    class="btn btn-secondary">
                📖 Build Instructions
            </button>
        `;
        
        const downloadSection = document.querySelector('.download-cards');
        downloadSection.appendChild(fallbackMessage);
    }

    async downloadAsset(asset) {
        // Show download progress
        this.showDownloadProgress(asset.name);
        
        // Track download
        this.trackDownload(asset.name, asset.size);
        
        // Start download
        window.open(asset.browser_download_url, '_blank');
    }

    showDownloadProgress(filename) {
        const progress = document.createElement('div');
        progress.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid var(--weezy-primary);
            border-radius: 12px;
            padding: 20px;
            backdrop-filter: blur(10px);
            z-index: 1000;
            min-width: 300px;
            text-align: center;
        `;
        
        progress.innerHTML = `
            <div style="color: var(--weezy-primary-light); font-weight: 600; margin-bottom: 12px;">
                ⬇️ Downloading ${filename}
            </div>
            <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                <div style="width: 0%; height: 100%; background: var(--weezy-gradient); border-radius: 2px; animation: downloadProgress 3s ease-in-out forwards;"></div>
            </div>
            <div style="color: rgba(255,255,255,0.6); font-size: 12px; margin-top: 8px;">
                Thank you for choosing Weezy! ✨
            </div>
        `;
        
        document.body.appendChild(progress);
        
        // Remove after download simulation
        setTimeout(() => progress.remove(), 4000);
    }

    setupDownloadTracking() {
        // Track download button clicks
        document.querySelectorAll('[onclick*="downloadPlatform"]').forEach(button => {
            button.addEventListener('click', (e) => {
                const platform = e.target.closest('[data-platform]')?.dataset.platform;
                if (platform) {
                    this.incrementDownloadCount(platform);
                }
            });
        });
    }

    setupProgressTracking() {
        // Add download progress animation CSS
        const progressStyle = document.createElement('style');
        progressStyle.textContent = `
            @keyframes downloadProgress {
                0% { width: 0%; }
                20% { width: 30%; }
                60% { width: 80%; }
                100% { width: 100%; }
            }
        `;
        document.head.appendChild(progressStyle);
    }

    trackDownload(filename, size) {
        // Analytics tracking
        console.log(`Download tracked: ${filename} (${size} bytes)`);
        
        // Update local stats
        this.downloadStats.total++;
        this.downloadStats.lastDownload = new Date().toISOString();
        this.saveDownloadStats();
        
        // Send to analytics if available
        if (typeof gtag !== 'undefined') {
            gtag('event', 'file_download', {
                'file_name': filename,
                'file_size': size
            });
        }
    }

    incrementDownloadCount(platform) {
        if (!this.downloadStats.platforms[platform]) {
            this.downloadStats.platforms[platform] = 0;
        }
        this.downloadStats.platforms[platform]++;
        this.saveDownloadStats();
    }

    loadDownloadStats() {
        const stored = localStorage.getItem('weezy-download-stats');
        return stored ? JSON.parse(stored) : {
            total: 0,
            platforms: {},
            lastDownload: null
        };
    }

    saveDownloadStats() {
        localStorage.setItem('weezy-download-stats', JSON.stringify(this.downloadStats));
    }

    isElementInViewport(el) {
        const rect = el.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }
}

// Initialize download manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.weezyDownloadManager = new WeezyDownloadManager();
    console.log('✨ Weezy Download Manager initialized');
});

// Global download function for onclick handlers
function downloadPlatform(platform, type) {
    if (window.weezyDownloadManager) {
        window.weezyDownloadManager.downloadPlatform(platform, type);
    } else {
        // Fallback download
        const fallbackUrls = {
            'windows-installer': 'https://github.com/weezy-dev/weezy/releases/latest',
            'macos-dmg': 'https://github.com/weezy-dev/weezy/releases/latest',
            'linux-deb': 'https://github.com/weezy-dev/weezy/releases/latest'
        };
        
        const url = fallbackUrls[`${platform}-${type}`] || 'https://github.com/weezy-dev/weezy/releases/latest';
        window.open(url, '_blank');
    }
}

// Enhanced download with progress simulation
WeezyDownloadManager.prototype.downloadPlatform = function(platform, type) {
    const downloadUrls = {
        windows: {
            installer: `${this.baseUrl}Weezy-Setup-${this.getLatestVersion()}.exe`,
            portable: `${this.baseUrl}Weezy-win32-x64-${this.getLatestVersion()}.zip`
        },
        macos: {
            dmg: `${this.baseUrl}Weezy-${this.getLatestVersion()}-darwin-universal.dmg`,
            zip: `${this.baseUrl}Weezy-${this.getLatestVersion()}-darwin-universal.zip`
        },
        linux: {
            deb: `${this.baseUrl}weezy_${this.getLatestVersion()}_amd64.deb`,
            rpm: `${this.baseUrl}weezy-${this.getLatestVersion()}.x86_64.rpm`,
            appimage: `${this.baseUrl}Weezy-${this.getLatestVersion()}-x86_64.AppImage`
        }
    };
    
    const downloadUrl = downloadUrls[platform]?.[type];
    
    if (downloadUrl) {
        this.startDownload(downloadUrl, platform, type);
    } else {
        this.showBuildInstructions(platform, type);
    }
};

WeezyDownloadManager.prototype.startDownload = function(url, platform, type) {
    // Show download starting notification
    this.showDownloadNotification(`Starting download for ${platform} (${type})...`, 'info');
    
    // Create download progress modal
    this.showDownloadModal(platform, type);
    
    // Track download
    this.trackDownload(`${platform}-${type}`, 0);
    
    // Start actual download
    setTimeout(() => {
        window.open(url, '_blank');
        this.showDownloadNotification('✨ Download started! Check your downloads folder.', 'success');
    }, 1000);
};

WeezyDownloadManager.prototype.showDownloadModal = function(platform, type) {
    const modal = document.createElement('div');
    modal.className = 'download-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(10px);
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: var(--weezy-dark);
        border: 2px solid var(--weezy-primary);
        border-radius: 16px;
        padding: 40px;
        text-align: center;
        max-width: 500px;
        position: relative;
    `;
    
    content.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 20px;">✨</div>
        <h3 style="color: white; margin-bottom: 16px; font-size: 24px;">
            Downloading Weezy for ${platform}
        </h3>
        <p style="color: rgba(255,255,255,0.7); margin-bottom: 24px;">
            Your journey to enlightened development begins now!
        </p>
        
        <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; margin-bottom: 20px;">
            <div style="width: 0%; height: 100%; background: var(--weezy-light-gradient); border-radius: 3px; animation: downloadProgress 3s ease-in-out forwards;"></div>
        </div>
        
        <div style="color: rgba(255,255,255,0.6); font-size: 14px; margin-bottom: 24px;">
            Preparing your AI-powered development environment...
        </div>
        
        <div style="display: flex; gap: 16px; justify-content: center;">
            <button onclick="this.closest('.download-modal').remove()" class="btn btn-secondary">
                Continue Browsing
            </button>
            <button onclick="window.open('docs/getting-started.html', '_blank')" class="btn btn-primary">
                📖 Setup Guide
            </button>
        </div>
        
        <button onclick="this.closest('.download-modal').remove()" 
                style="position: absolute; top: 16px; right: 16px; background: none; border: none; color: rgba(255,255,255,0.5); font-size: 24px; cursor: pointer;">
            ×
        </button>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Auto-close after download completes
    setTimeout(() => {
        if (modal.parentElement) {
            modal.remove();
        }
    }, 5000);
};

WeezyDownloadManager.prototype.showBuildInstructions = function(platform, type) {
    const instructions = document.createElement('div');
    instructions.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--weezy-dark);
        border: 2px solid var(--weezy-accent);
        border-radius: 16px;
        padding: 32px;
        max-width: 600px;
        z-index: 10000;
        backdrop-filter: blur(20px);
    `;
    
    instructions.innerHTML = `
        <h3 style="color: white; margin-bottom: 20px; font-size: 24px;">
            🔧 Build Weezy from Source
        </h3>
        <p style="color: rgba(255,255,255,0.8); margin-bottom: 20px;">
            Pre-built binaries for ${platform} (${type}) are coming soon! 
            For now, you can build Weezy yourself with our automated build system.
        </p>
        
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <code style="color: var(--weezy-accent-light); font-family: var(--font-mono); font-size: 13px; line-height: 1.6;">
                # Clone the repository<br>
                git clone https://github.com/weezy-dev/weezy<br>
                cd weezy<br><br>
                # Build for your platform<br>
                ./build.sh<br><br>
                # Package the application<br>
                cd vscode<br>
                npm run package
            </code>
        </div>
        
        <div style="display: flex; gap: 16px; justify-content: center;">
            <button onclick="this.parentElement.remove()" class="btn btn-secondary">
                Close
            </button>
            <button onclick="window.open('https://github.com/weezy-dev/weezy', '_blank')" class="btn btn-primary">
                🚀 Go to GitHub
            </button>
        </div>
    `;
    
    document.body.appendChild(instructions);
};

WeezyDownloadManager.prototype.showDownloadNotification = function(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === 'success' ? 'var(--weezy-gradient)' : type === 'error' ? '#ef4444' : 'var(--weezy-accent)'};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-weight: 600;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
};

WeezyDownloadManager.prototype.getLatestVersion = function() {
    return this.latestVersion || '1.0.0';
};

// Add animation styles
const downloadAnimationStyles = document.createElement('style');
downloadAnimationStyles.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .recommended-platform {
        border: 2px solid var(--weezy-primary) !important;
        box-shadow: 0 0 30px rgba(99, 102, 241, 0.4) !important;
        position: relative;
    }
    
    .recommendation-badge {
        position: absolute;
        top: -12px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--weezy-gradient);
        color: white;
        padding: 6px 16px;
        border-radius: 16px;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        animation: badgePulse 2s ease-in-out infinite;
    }
    
    @keyframes badgePulse {
        0%, 100% { transform: translateX(-50%) scale(1); }
        50% { transform: translateX(-50%) scale(1.05); }
    }
`;
document.head.appendChild(downloadAnimationStyles);