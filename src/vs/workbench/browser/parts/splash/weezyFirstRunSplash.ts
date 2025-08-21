/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { ILogService } from 'vs/platform/log/common/log';
import { Disposable } from 'vs/base/common/lifecycle';

export class WeezyFirstRunSplash extends Disposable {
    private static readonly FIRST_RUN_KEY = 'weezy.firstRun.shown';
    
    private splashContainer: HTMLElement | null = null;
    private isFirstRun: boolean = false;

    constructor(
        @IStorageService private readonly storageService: IStorageService,
        @ILogService private readonly logService: ILogService
    ) {
        super();
        this.checkFirstRun();
    }

    private checkFirstRun(): void {
        const hasShownFirstRun = this.storageService.getBoolean(WeezyFirstRunSplash.FIRST_RUN_KEY, StorageScope.APPLICATION, false);
        this.isFirstRun = !hasShownFirstRun;
        
        if (this.isFirstRun) {
            this.logService.info('[WeezyFirstRunSplash] First run detected - showing welcome experience');
            this.showFirstRunExperience();
        }
    }

    private async showFirstRunExperience(): Promise<void> {
        // Create full-screen splash overlay
        this.createSplashContainer();
        
        // Start the light sequence
        await this.startLightSequence();
        
        // Mark first run as completed
        this.storageService.store(WeezyFirstRunSplash.FIRST_RUN_KEY, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
    }

    private createSplashContainer(): void {
        this.splashContainer = document.createElement('div');
        this.splashContainer.className = 'weezy-first-run-splash';
        
        // Full-screen overlay styles
        Object.assign(this.splashContainer.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '10000',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
        });

        // Add to body
        document.body.appendChild(this.splashContainer);
        
        // Create splash content
        this.createSplashContent();
    }

    private createSplashContent(): void {
        if (!this.splashContainer) return;

        // Central light source
        const lightSource = document.createElement('div');
        lightSource.className = 'weezy-light-source';
        Object.assign(lightSource.style, {
            position: 'absolute',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(251,191,36,0.6) 30%, rgba(245,158,11,0.4) 60%, transparent 100%)',
            filter: 'blur(20px)',
            opacity: '0',
            transform: 'scale(0.5)',
            transition: 'all 2s cubic-bezier(0.4, 0, 0.2, 1)'
        });

        // Weezy logo text
        const logoText = document.createElement('div');
        logoText.className = 'weezy-logo-text';
        logoText.textContent = 'WEEZY';
        Object.assign(logoText.style, {
            fontSize: '72px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '20px',
            opacity: '0',
            transform: 'translateY(30px)',
            transition: 'all 2s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: 'drop-shadow(0 0 20px rgba(99, 102, 241, 0.5))'
        });

        // Tagline
        const tagline = document.createElement('div');
        tagline.className = 'weezy-tagline';
        tagline.textContent = 'Let there be light';
        Object.assign(tagline.style, {
            fontSize: '28px',
            fontWeight: '300',
            fontStyle: 'italic',
            background: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textAlign: 'center',
            opacity: '0',
            transform: 'translateY(20px)',
            transition: 'all 2s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: 'drop-shadow(0 0 10px rgba(251, 191, 36, 0.3))'
        });

        // Loading container
        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'weezy-loading-container';
        Object.assign(loadingContainer.style, {
            position: 'absolute',
            bottom: '100px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            opacity: '0',
            transition: 'opacity 1s ease-in-out'
        });

        // Loading bar
        const loadingBar = document.createElement('div');
        Object.assign(loadingBar.style, {
            width: '200px',
            height: '4px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '2px',
            overflow: 'hidden'
        });

        const loadingProgress = document.createElement('div');
        Object.assign(loadingProgress.style, {
            height: '100%',
            background: 'linear-gradient(90deg, #fbbf24, #f59e0b, #d97706)',
            borderRadius: '2px',
            width: '0%',
            transition: 'width 3s ease-in-out'
        });

        // Loading text
        const loadingText = document.createElement('div');
        loadingText.textContent = 'Initializing 43 AI Agents...';
        Object.assign(loadingText.style, {
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.7)',
            animation: 'weezyPulse 2s ease-in-out infinite'
        });

        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes weezyPulse {
                0%, 100% { opacity: 0.7; }
                50% { opacity: 1; }
            }
            
            @keyframes weezyLightPulse {
                0%, 100% { 
                    transform: scale(1);
                    opacity: 0.6;
                }
                50% { 
                    transform: scale(1.2);
                    opacity: 0.9;
                }
            }
        `;
        document.head.appendChild(style);

        // Assemble elements
        loadingBar.appendChild(loadingProgress);
        loadingContainer.appendChild(loadingBar);
        loadingContainer.appendChild(loadingText);

        this.splashContainer.appendChild(lightSource);
        this.splashContainer.appendChild(logoText);
        this.splashContainer.appendChild(tagline);
        this.splashContainer.appendChild(loadingContainer);

        // Store references
        this.lightSource = lightSource;
        this.logo = logoText;
        this.tagline = tagline;
        this.loadingIndicator = loadingContainer;
        this.loadingProgress = loadingProgress;
    }

    private async startLightSequence(): Promise<void> {
        // Phase 1: Darkness (1 second)
        await this.delay(1000);
        
        // Phase 2: Light emerges (2 seconds)
        if (this.lightSource) {
            this.lightSource.style.opacity = '0.8';
            this.lightSource.style.transform = 'scale(1)';
            this.lightSource.style.animation = 'weezyLightPulse 4s ease-in-out infinite';
        }
        await this.delay(2000);
        
        // Phase 3: Logo revelation (2 seconds)
        if (this.logo) {
            this.logo.style.opacity = '1';
            this.logo.style.transform = 'translateY(0)';
        }
        await this.delay(2000);
        
        // Phase 4: Tagline appears (2 seconds)
        if (this.tagline) {
            this.tagline.style.opacity = '1';
            this.tagline.style.transform = 'translateY(0)';
        }
        await this.delay(2000);
        
        // Phase 5: Loading (3 seconds)
        if (this.loadingIndicator) {
            this.loadingIndicator.style.opacity = '1';
        }
        if (this.loadingProgress) {
            this.loadingProgress.style.width = '100%';
        }
        await this.delay(3000);
        
        // Fade out and remove
        this.fadeOutSplash();
    }

    private fadeOutSplash(): void {
        if (this.splashContainer) {
            this.splashContainer.style.transition = 'opacity 1s ease-out';
            this.splashContainer.style.opacity = '0';
            
            setTimeout(() => {
                if (this.splashContainer && this.splashContainer.parentNode) {
                    this.splashContainer.parentNode.removeChild(this.splashContainer);
                }
            }, 1000);
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private lightSource: HTMLElement | null = null;
    private logo: HTMLElement | null = null;
    private tagline: HTMLElement | null = null;
    private loadingIndicator: HTMLElement | null = null;
    private loadingProgress: HTMLElement | null = null;
}