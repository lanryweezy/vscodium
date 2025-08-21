// Weezy Website JavaScript - "Let there be light"

// Platform Detection
function detectPlatform() {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('mac')) return 'macos';
    if (userAgent.includes('win')) return 'windows';
    if (userAgent.includes('linux')) return 'linux';
    
    return 'linux'; // Default to Linux
}

// Auto-highlight platform download
function highlightPlatformDownload() {
    const platform = detectPlatform();
    const platformCard = document.querySelector(`[data-platform="${platform}"]`);
    
    if (platformCard) {
        platformCard.style.border = '2px solid var(--weezy-primary)';
        platformCard.style.boxShadow = '0 0 30px rgba(99, 102, 241, 0.4)';
        
        // Add "Recommended" badge
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
        platformCard.style.position = 'relative';
        platformCard.appendChild(badge);
    }
}

// Smooth scrolling
function scrollToDownload() {
    document.getElementById('download').scrollIntoView({
        behavior: 'smooth'
    });
}

// Demo video player
function playDemo() {
    // Create modal for demo video
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(10px);
    `;
    
    const videoContainer = document.createElement('div');
    videoContainer.style.cssText = `
        background: var(--weezy-dark);
        border-radius: 16px;
        padding: 20px;
        max-width: 90vw;
        max-height: 90vh;
        border: 2px solid var(--weezy-primary);
    `;
    
    videoContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="color: white; margin: 0;">✨ Weezy in Action - Let there be light</h3>
            <button onclick="this.closest('.modal').remove()" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer;">×</button>
        </div>
        <video width="800" height="450" controls autoplay style="border-radius: 8px;">
            <source src="assets/weezy-demo.mp4" type="video/mp4">
            <p style="color: white;">Demo video coming soon! Watch 43 AI agents collaborate in real-time.</p>
        </video>
        <p style="color: rgba(255,255,255,0.7); margin-top: 16px; text-align: center;">
            See how Weezy's 43 AI agents work together to create enterprise-grade applications
        </p>
    `;
    
    modal.className = 'modal';
    modal.appendChild(videoContainer);
    document.body.appendChild(modal);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Download functionality
function downloadPlatform(platform, type) {
    const downloads = {
        windows: {
            installer: 'https://github.com/weezy-dev/weezy/releases/latest/download/Weezy-Setup.exe',
            portable: 'https://github.com/weezy-dev/weezy/releases/latest/download/Weezy-win32-x64.zip'
        },
        macos: {
            dmg: 'https://github.com/weezy-dev/weezy/releases/latest/download/Weezy-darwin-universal.dmg',
            zip: 'https://github.com/weezy-dev/weezy/releases/latest/download/Weezy-darwin-universal.zip'
        },
        linux: {
            deb: 'https://github.com/weezy-dev/weezy/releases/latest/download/weezy_amd64.deb',
            rpm: 'https://github.com/weezy-dev/weezy/releases/latest/download/weezy-x86_64.rpm',
            appimage: 'https://github.com/weezy-dev/weezy/releases/latest/download/Weezy-x86_64.AppImage'
        }
    };
    
    const downloadUrl = downloads[platform]?.[type];
    
    if (downloadUrl) {
        // Show download starting notification
        showNotification(`✨ Starting download for ${platform} (${type})...`, 'success');
        
        // Track download
        trackDownload(platform, type);
        
        // Start download
        window.open(downloadUrl, '_blank');
    } else {
        showNotification('❌ Download not available yet. Please check back soon!', 'error');
    }
}

// Download tracking
function trackDownload(platform, type) {
    // Analytics tracking (implement with your preferred analytics)
    console.log(`Download started: ${platform} - ${type}`);
    
    // Could integrate with Google Analytics, Plausible, etc.
    if (typeof gtag !== 'undefined') {
        gtag('event', 'download', {
            'platform': platform,
            'type': type,
            'value': 1
        });
    }
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === 'success' ? 'var(--weezy-gradient)' : '#ef4444'};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-weight: 600;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Scroll animations
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);
    
    // Observe all fade-in elements
    document.querySelectorAll('.fade-in').forEach(el => {
        observer.observe(el);
    });
}

// Terminal animation
function initTerminalAnimation() {
    const terminalLines = document.querySelectorAll('.terminal-line');
    
    terminalLines.forEach((line, index) => {
        if (line.classList.contains('agent-response')) {
            line.style.opacity = '0';
            
            setTimeout(() => {
                line.style.animation = 'typewriter 0.5s ease-in-out forwards';
                line.style.opacity = '1';
            }, (index - 1) * 800); // Stagger animations
        }
    });
}

// Light ray animation
function initLightRayAnimation() {
    const lightRays = document.querySelector('.light-rays');
    if (lightRays) {
        // Add additional animated light rays
        for (let i = 0; i < 6; i++) {
            const ray = document.createElement('div');
            ray.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                width: 2px;
                height: 200px;
                background: linear-gradient(to bottom, var(--weezy-light), transparent);
                transform-origin: center bottom;
                transform: translate(-50%, -100%) rotate(${i * 60}deg);
                opacity: 0.3;
                animation: rotateRay 20s linear infinite;
                animation-delay: ${i * 2}s;
            `;
            lightRays.appendChild(ray);
        }
    }
}

// CSS Animations (added via JavaScript)
function addDynamicStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        @keyframes rotateRay {
            from { transform: translate(-50%, -100%) rotate(0deg); }
            to { transform: translate(-50%, -100%) rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('✨ Weezy website loaded - Let there be light!');
    
    // Initialize features
    highlightPlatformDownload();
    initScrollAnimations();
    addDynamicStyles();
    
    // Delayed animations
    setTimeout(initTerminalAnimation, 1000);
    setTimeout(initLightRayAnimation, 500);
    
    // Add fade-in class to elements
    document.querySelectorAll('.feature-card, .agent-category, .testimonial-card').forEach(el => {
        el.classList.add('fade-in');
    });
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Press 'D' to go to download
    if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.metaKey) {
        scrollToDownload();
    }
    
    // Press 'Escape' to close modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => modal.remove());
    }
});

// Easter egg - Konami code for special animation
let konamiCode = [];
const konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

document.addEventListener('keydown', function(e) {
    konamiCode.push(e.code);
    konamiCode = konamiCode.slice(-10);
    
    if (JSON.stringify(konamiCode) === JSON.stringify(konamiSequence)) {
        // Special "divine light" animation
        showDivineLight();
        konamiCode = [];
    }
});

function showDivineLight() {
    const divineLight = document.createElement('div');
    divineLight.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: radial-gradient(circle, rgba(251, 191, 36, 0.8) 0%, transparent 70%);
        z-index: 10000;
        pointer-events: none;
        animation: divineFlash 3s ease-out forwards;
    `;
    
    document.body.appendChild(divineLight);
    
    // Show special message
    setTimeout(() => {
        showNotification('🌟 Divine light activated! You have found the secret of Weezy!', 'success');
    }, 1000);
    
    setTimeout(() => divineLight.remove(), 3000);
}

// Add divine flash animation
const divineStyle = document.createElement('style');
divineStyle.textContent = `
    @keyframes divineFlash {
        0% { opacity: 0; transform: scale(0); }
        50% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.5); }
    }
`;
document.head.appendChild(divineStyle);