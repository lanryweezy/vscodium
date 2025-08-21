// Weezy Pricing Page JavaScript

class WeezyPricingManager {
    constructor() {
        this.isAnnualBilling = false;
        this.plans = {
            light: { monthly: 0, annual: 0 },
            divine: { monthly: 29, annual: 23 },
            enterprise: { monthly: 99, annual: 79 }
        };
        
        this.initPricingFeatures();
    }

    initPricingFeatures() {
        this.setupROICalculator();
        this.setupPlanSelection();
        this.setupBillingToggle();
        this.addPricingAnimations();
        this.trackPricingInteractions();
    }

    setupROICalculator() {
        const hourlyRateInput = document.getElementById('hourlyRate');
        if (hourlyRateInput) {
            hourlyRateInput.addEventListener('input', () => this.calculateROI());
            this.calculateROI(); // Initial calculation
        }
    }

    calculateROI() {
        const hourlyRate = parseFloat(document.getElementById('hourlyRate')?.value) || 75;
        const hoursPerWeek = 0.5; // 30 minutes saved per week (conservative)
        const weeksPerMonth = 4.33;
        
        const weeklySavings = hourlyRate * hoursPerWeek;
        const monthlySavings = weeklySavings * weeksPerMonth;
        const weezyDivineCost = this.plans.divine.monthly;
        const netSavings = monthlySavings - weezyDivineCost;
        const roiPercentage = Math.round((netSavings / weezyDivineCost) * 100);
        
        // Update display
        const weeklySavingsEl = document.getElementById('weeklySavings');
        const monthlySavingsEl = document.getElementById('monthlySavings');
        const roiPercentageEl = document.getElementById('roiPercentage');
        
        if (weeklySavingsEl) weeklySavingsEl.textContent = `$${weeklySavings.toFixed(2)}`;
        if (monthlySavingsEl) monthlySavingsEl.textContent = `$${monthlySavings.toFixed(0)}`;
        if (roiPercentageEl) roiPercentageEl.textContent = `${roiPercentage}%`;
        
        // Add visual feedback for great ROI
        if (roiPercentage > 300) {
            const roiHighlight = document.querySelector('.roi-highlight');
            if (roiHighlight) {
                roiHighlight.style.background = 'rgba(16, 185, 129, 0.2)';
                roiHighlight.style.borderColor = '#10b981';
            }
        }
    }

    setupBillingToggle() {
        const billingToggle = document.getElementById('billingToggle');
        if (billingToggle) {
            billingToggle.addEventListener('change', () => this.toggleBilling());
        }
    }

    toggleBilling() {
        this.isAnnualBilling = !this.isAnnualBilling;
        
        // Update price displays
        document.querySelectorAll('.monthly-price').forEach(el => {
            el.style.display = this.isAnnualBilling ? 'none' : 'inline';
        });
        
        document.querySelectorAll('.annual-price').forEach(el => {
            el.style.display = this.isAnnualBilling ? 'inline' : 'none';
        });
        
        document.querySelectorAll('.annual-savings').forEach(el => {
            el.style.display = this.isAnnualBilling ? 'block' : 'none';
        });
        
        // Add animation to price changes
        document.querySelectorAll('.price-amount').forEach(el => {
            el.classList.add('price-change');
            setTimeout(() => el.classList.remove('price-change'), 500);
        });
        
        // Track billing preference
        this.trackEvent('billing_toggle', { 
            billing_type: this.isAnnualBilling ? 'annual' : 'monthly' 
        });
    }

    setupPlanSelection() {
        // Add click handlers to plan cards
        document.querySelectorAll('.plan-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.btn')) {
                    const planType = this.getPlanTypeFromCard(card);
                    this.highlightPlan(card, planType);
                }
            });
        });
    }

    getPlanTypeFromCard(card) {
        if (card.classList.contains('plan-free')) return 'light';
        if (card.classList.contains('plan-pro')) return 'divine';
        if (card.classList.contains('plan-enterprise')) return 'enterprise';
        return 'divine';
    }

    highlightPlan(card, planType) {
        // Remove highlight from other cards
        document.querySelectorAll('.plan-card').forEach(c => {
            c.classList.remove('selected');
        });
        
        // Highlight selected card
        card.classList.add('selected');
        
        // Track plan interest
        this.trackEvent('plan_interest', { plan: planType });
        
        // Show plan benefits
        this.showPlanBenefits(planType);
    }

    showPlanBenefits(planType) {
        const benefits = {
            light: [
                '🆓 Perfect for learning and small projects',
                '🤖 5 essential AI agents to get started',
                '🔧 Basic workflows and automation',
                '💻 Local AI support with Ollama'
            ],
            divine: [
                '✨ 43 specialized AI agents at your service',
                '🚀 10x faster development with multi-agent collaboration',
                '💎 Enterprise-grade features for professional development',
                '☁️ Access to all premium AI providers',
                '📈 ROI: Saves 10+ hours per week'
            ],
            enterprise: [
                '🏢 Everything in Divine plus team features',
                '🔒 Enterprise security and compliance',
                '👥 Team collaboration and project sharing',
                '🛠️ Custom AI agents and workflows',
                '📞 Dedicated support and SLA guarantees'
            ]
        };
        
        this.showBenefitsModal(planType, benefits[planType]);
    }

    showBenefitsModal(planType, benefits) {
        const modal = document.createElement('div');
        modal.className = 'benefits-modal';
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
            padding: 32px;
            max-width: 500px;
            text-align: center;
            position: relative;
        `;
        
        content.innerHTML = `
            <h3 style="color: white; margin-bottom: 20px; font-size: 24px;">
                ${planType === 'light' ? '✨ Weezy Light' : planType === 'divine' ? '💫 Weezy Divine' : '🌟 Weezy Enterprise'} Benefits
            </h3>
            
            <div style="text-align: left; margin-bottom: 24px;">
                ${benefits.map(benefit => `
                    <div style="color: rgba(255,255,255,0.8); margin-bottom: 12px; font-size: 16px; line-height: 1.5;">
                        ${benefit}
                    </div>
                `).join('')}
            </div>
            
            <div style="display: flex; gap: 16px; justify-content: center;">
                <button onclick="this.closest('.benefits-modal').remove()" class="btn btn-secondary">
                    Close
                </button>
                <button onclick="selectPlan('${planType}')" class="btn btn-primary">
                    ${planType === 'light' ? 'Start Free' : planType === 'divine' ? 'Start Trial' : 'Contact Sales'}
                </button>
            </div>
            
            <button onclick="this.closest('.benefits-modal').remove()" 
                    style="position: absolute; top: 12px; right: 16px; background: none; border: none; color: rgba(255,255,255,0.5); font-size: 24px; cursor: pointer;">
                ×
            </button>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    addPricingAnimations() {
        // Add hover effects to plan cards
        document.querySelectorAll('.plan-card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-12px) scale(1.02)';
            });
            
            card.addEventListener('mouseleave', () => {
                const isRecommended = card.classList.contains('plan-pro');
                card.style.transform = isRecommended ? 'translateY(-8px) scale(1.05)' : 'translateY(0) scale(1)';
            });
        });
        
        // Add sparkle effects to recommended plan
        const recommendedPlan = document.querySelector('.plan-pro');
        if (recommendedPlan) {
            this.addSparkleEffect(recommendedPlan);
        }
    }

    addSparkleEffect(element) {
        setInterval(() => {
            const sparkle = document.createElement('div');
            sparkle.style.cssText = `
                position: absolute;
                width: 4px;
                height: 4px;
                background: var(--weezy-light);
                border-radius: 50%;
                pointer-events: none;
                animation: sparkle 2s ease-out forwards;
                top: ${Math.random() * 100}%;
                left: ${Math.random() * 100}%;
            `;
            
            element.appendChild(sparkle);
            
            setTimeout(() => sparkle.remove(), 2000);
        }, 3000);
    }

    trackPricingInteractions() {
        // Track plan card clicks
        document.querySelectorAll('.plan-card').forEach(card => {
            card.addEventListener('click', () => {
                const planType = this.getPlanTypeFromCard(card);
                this.trackEvent('plan_card_click', { plan: planType });
            });
        });
        
        // Track FAQ interactions
        document.querySelectorAll('.faq-item').forEach(item => {
            item.addEventListener('click', () => {
                const question = item.querySelector('.faq-question').textContent;
                this.trackEvent('faq_click', { question: question.substring(0, 50) });
            });
        });
        
        // Track ROI calculator usage
        const hourlyRateInput = document.getElementById('hourlyRate');
        if (hourlyRateInput) {
            hourlyRateInput.addEventListener('change', () => {
                this.trackEvent('roi_calculation', { 
                    hourly_rate: hourlyRateInput.value 
                });
            });
        }
    }

    trackEvent(eventName, properties) {
        console.log(`📊 Pricing Event: ${eventName}`, properties);
        
        // Send to analytics if available
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, properties);
        }
        
        // Store in local storage for analysis
        const events = JSON.parse(localStorage.getItem('weezy-pricing-events') || '[]');
        events.push({
            event: eventName,
            properties: properties,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('weezy-pricing-events', JSON.stringify(events.slice(-100))); // Keep last 100 events
    }
}

// Plan selection functions
function selectPlan(planType) {
    console.log(`✨ Plan selected: ${planType}`);
    
    // Track plan selection
    if (window.weezyPricingManager) {
        window.weezyPricingManager.trackEvent('plan_selected', { plan: planType });
    }
    
    if (planType === 'light') {
        // Redirect to download page
        window.location.href = 'index.html#download';
    } else if (planType === 'divine') {
        // Start trial process
        showTrialModal();
    } else if (planType === 'enterprise') {
        // Contact sales
        contactSales();
    }
}

function showTrialModal() {
    const modal = document.createElement('div');
    modal.className = 'trial-modal';
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
        backdrop-filter: blur(15px);
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: var(--weezy-dark);
        border: 2px solid var(--weezy-primary);
        border-radius: 20px;
        padding: 40px;
        max-width: 500px;
        text-align: center;
        position: relative;
        box-shadow: 0 0 50px rgba(99, 102, 241, 0.5);
    `;
    
    content.innerHTML = `
        <div style="font-size: 64px; margin-bottom: 20px;">✨</div>
        <h3 style="color: white; margin-bottom: 16px; font-size: 28px;">
            Start Your Divine Trial
        </h3>
        <p style="color: rgba(255,255,255,0.8); margin-bottom: 24px; font-size: 16px; line-height: 1.6;">
            Experience the power of 43 AI agents working together. 
            14 days free, then $29/month. Cancel anytime.
        </p>
        
        <div style="background: rgba(99, 102, 241, 0.1); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <h4 style="color: var(--weezy-primary-light); margin-bottom: 12px;">What you get immediately:</h4>
            <div style="text-align: left; color: rgba(255,255,255,0.8); font-size: 14px;">
                ✨ All 43 specialized AI agents<br>
                🚀 Multi-agent orchestration<br>
                ☁️ Premium AI providers (OpenAI, Claude)<br>
                🔧 Advanced workflows and automation<br>
                📊 Performance analytics and insights<br>
                🎯 Priority support
            </div>
        </div>
        
        <form onsubmit="startTrial(event)" style="margin-bottom: 20px;">
            <input type="email" placeholder="Enter your email" required
                   style="width: 100%; padding: 12px 16px; margin-bottom: 16px; background: rgba(255,255,255,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 8px; color: white; font-size: 16px;">
            
            <button type="submit" class="btn btn-primary btn-full" style="font-size: 16px; padding: 14px;">
                🌟 Start 14-Day Free Trial
            </button>
        </form>
        
        <div style="color: rgba(255,255,255,0.5); font-size: 12px; line-height: 1.4;">
            No credit card required • Cancel anytime<br>
            By starting the trial, you agree to our Terms of Service
        </div>
        
        <button onclick="this.closest('.trial-modal').remove()" 
                style="position: absolute; top: 16px; right: 16px; background: none; border: none; color: rgba(255,255,255,0.5); font-size: 24px; cursor: pointer;">
            ×
        </button>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
}

function startTrial(event) {
    event.preventDefault();
    
    const email = event.target.querySelector('input[type="email"]').value;
    
    // Show success message
    const successModal = document.createElement('div');
    successModal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--weezy-dark);
        border: 2px solid #10b981;
        border-radius: 16px;
        padding: 32px;
        text-align: center;
        z-index: 10001;
        box-shadow: 0 0 40px rgba(16, 185, 129, 0.3);
    `;
    
    successModal.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
        <h3 style="color: white; margin-bottom: 12px;">Welcome to Divine Development!</h3>
        <p style="color: rgba(255,255,255,0.8); margin-bottom: 20px;">
            Check your email for download instructions and your trial activation key.
        </p>
        <button onclick="window.location.href='index.html#download'" class="btn btn-primary">
            ⬇️ Download Weezy Now
        </button>
    `;
    
    // Close trial modal and show success
    document.querySelector('.trial-modal').remove();
    document.body.appendChild(successModal);
    
    // Track trial start
    if (window.weezyPricingManager) {
        window.weezyPricingManager.trackEvent('trial_started', { 
            email: email,
            plan: 'divine'
        });
    }
    
    // Auto-close success modal
    setTimeout(() => {
        if (successModal.parentElement) {
            successModal.remove();
        }
    }, 5000);
}

function contactSales() {
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
        backdrop-filter: blur(15px);
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: var(--weezy-dark);
        border: 2px solid var(--weezy-light);
        border-radius: 20px;
        padding: 40px;
        max-width: 600px;
        text-align: center;
        position: relative;
    `;
    
    content.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 20px;">🏢</div>
        <h3 style="color: white; margin-bottom: 16px; font-size: 28px;">
            Enterprise Sales Contact
        </h3>
        <p style="color: rgba(255,255,255,0.8); margin-bottom: 24px;">
            Get custom pricing and dedicated support for your organization.
        </p>
        
        <form onsubmit="submitSalesContact(event)" style="text-align: left;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <input type="text" placeholder="First Name" required
                       style="padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 8px; color: white;">
                <input type="text" placeholder="Last Name" required
                       style="padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 8px; color: white;">
            </div>
            
            <input type="email" placeholder="Work Email" required
                   style="width: 100%; padding: 12px; margin-bottom: 16px; background: rgba(255,255,255,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 8px; color: white;">
            
            <input type="text" placeholder="Company Name" required
                   style="width: 100%; padding: 12px; margin-bottom: 16px; background: rgba(255,255,255,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 8px; color: white;">
            
            <select required style="width: 100%; padding: 12px; margin-bottom: 16px; background: rgba(255,255,255,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 8px; color: white;">
                <option value="">Team Size</option>
                <option value="5-10">5-10 developers</option>
                <option value="11-25">11-25 developers</option>
                <option value="26-50">26-50 developers</option>
                <option value="51-100">51-100 developers</option>
                <option value="100+">100+ developers</option>
            </select>
            
            <textarea placeholder="Tell us about your development needs..." rows="3"
                      style="width: 100%; padding: 12px; margin-bottom: 20px; background: rgba(255,255,255,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 8px; color: white; resize: vertical;"></textarea>
            
            <button type="submit" class="btn btn-primary btn-full">
                🚀 Request Enterprise Quote
            </button>
        </form>
        
        <button onclick="this.closest('div').remove()" 
                style="position: absolute; top: 16px; right: 16px; background: none; border: none; color: rgba(255,255,255,0.5); font-size: 24px; cursor: pointer;">
            ×
        </button>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
}

function submitSalesContact(event) {
    event.preventDefault();
    
    // Show success message
    const form = event.target;
    const formData = new FormData(form);
    
    form.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
            <h3 style="color: #10b981; margin-bottom: 12px;">Thank you!</h3>
            <p style="color: rgba(255,255,255,0.8);">
                Our enterprise team will contact you within 24 hours with a custom quote 
                and demo of Weezy's 43 AI agents in action.
            </p>
        </div>
    `;
    
    // Track enterprise interest
    if (window.weezyPricingManager) {
        window.weezyPricingManager.trackEvent('enterprise_contact', {
            email: formData.get('email'),
            company: formData.get('company')
        });
    }
}

function requestDemo() {
    // Similar to trial modal but for demo request
    showTrialModal(); // Reuse trial modal for now
}

// Add sparkle animation CSS
const sparkleStyles = document.createElement('style');
sparkleStyles.textContent = `
    @keyframes sparkle {
        0% {
            opacity: 0;
            transform: scale(0) rotate(0deg);
        }
        50% {
            opacity: 1;
            transform: scale(1) rotate(180deg);
        }
        100% {
            opacity: 0;
            transform: scale(0) rotate(360deg);
        }
    }
    
    .plan-card.selected {
        border-color: var(--weezy-light) !important;
        box-shadow: 0 0 40px rgba(251, 191, 36, 0.4) !important;
    }
`;
document.head.appendChild(sparkleStyles);

// Initialize pricing manager
document.addEventListener('DOMContentLoaded', () => {
    window.weezyPricingManager = new WeezyPricingManager();
    console.log('💰 Weezy Pricing Manager initialized - Let there be revenue!');
});