/**
 * Privacy Information Modal/Panel Component
 * Displays Privacy Cash education in a user-friendly format
 */

export interface PrivacyEducationState {
  currentTopic: 'overview' | 'transfers' | 'swaps' | 'practices' | 'faq' | 'warnings' | 'levels'
  searchQuery: string
  showFAQs: boolean
  expandedFAQCategories: Set<string>
  showWarnings: boolean
  showChecklist: boolean
}

export class PrivacyEducationPanel {
  state: PrivacyEducationState = {
    currentTopic: 'overview',
    searchQuery: '',
    showFAQs: false,
    expandedFAQCategories: new Set(),
    showWarnings: false,
    showChecklist: false,
  }

  /**
   * Initialize the privacy education panel
   */
  initialize() {
    console.log('🔒 Privacy Cash Education Panel Initialized')
    this.renderOverview()
  }

  /**
   * Render Privacy Cash overview
   */
  renderOverview() {
    const html = `
      <div class="privacy-education-panel">
        <header class="privacy-header">
          <h1>🔒 Privacy Cash Guide</h1>
          <p>Learn how to transfer funds privately on Solana</p>
        </header>

        <nav class="privacy-nav">
          <button class="nav-btn" data-topic="overview">Overview</button>
          <button class="nav-btn" data-topic="transfers">How It Works</button>
          <button class="nav-btn" data-topic="practices">Best Practices</button>
          <button class="nav-btn" data-topic="faq">FAQ</button>
          <button class="nav-btn" data-topic="warnings">⚠️ Warnings</button>
          <button class="nav-btn" data-topic="levels">Privacy Levels</button>
        </nav>

        <div class="privacy-content">
          <div class="content-overview">
            <h2>What is Privacy Cash?</h2>
            <p>Privacy Cash is a privacy protocol on Solana that enables private transfers without linking your wallet addresses or transaction history.</p>
            
            <div class="key-points">
              <h3>Key Features:</h3>
              <ul>
                <li>✓ Built with zero-knowledge proofs</li>
                <li>✓ Uses append-only Merkle tree</li>
                <li>✓ Relayer system for anonymity</li>
                <li>✓ Breaks on-chain link between deposits and withdrawals</li>
                <li>✓ 14 audits + formal verification</li>
                <li>✓ $190M+ volume transferred privately</li>
              </ul>
            </div>

            <div class="credentials">
              <h3>Security Credentials:</h3>
              <p>✓ 14 Smart Contract Audits</p>
              <p>✓ Formally Verified by Veridise</p>
              <p>✓ Fully Open-Source Code</p>
              <p>✓ On-Chain Verified Program</p>
              <p>✓ Backed by AllianceDAO</p>
            </div>
          </div>
        </div>

        <footer class="privacy-footer">
          <p>For more information: <a href="https://privacycash.org" target="_blank">privacycash.org</a></p>
        </footer>
      </div>
    `
    return html
  }

  /**
   * Render transfers guide
   */
  renderTransfers() {
    const html = `
      <div class="privacy-content-section">
        <h2>🔄 How Private Transfers Work</h2>
        
        <div class="transfer-steps">
          <div class="step">
            <div class="step-number">1</div>
            <h3>Deposit</h3>
            <p>You deposit your tokens into Privacy Cash</p>
          </div>

          <div class="step">
            <div class="step-number">2</div>
            <h3>Screening</h3>
            <p>Relayer screens your wallet through CipherOwl for compliance</p>
          </div>

          <div class="step">
            <div class="step-number">3</div>
            <h3>Private Storage</h3>
            <p>Tokens stored encrypted. Only you can decrypt with your key</p>
          </div>

          <div class="step">
            <div class="step-number">4</div>
            <h3>Withdrawal</h3>
            <p>Withdraw to recipient address. Relayer signs (not you)</p>
          </div>

          <div class="step">
            <div class="step-number">5</div>
            <h3>Zero-Knowledge Proof</h3>
            <p>Client generates ZK proof to verify withdrawal correctness</p>
          </div>

          <div class="step">
            <div class="step-number">6</div>
            <h3>Anonymity</h3>
            <p>On-chain shows no link to original depositor</p>
          </div>
        </div>

        <div class="security-note">
          <h3>🔐 Security Guarantee</h3>
          <p>Relayers cannot modify your withdrawal parameters. Any tampering causes the transaction to fail. Your encryption key never leaves your device.</p>
        </div>
      </div>
    `
    return html
  }

  /**
   * Render best practices
   */
  renderBestPractices() {
    const html = `
      <div class="privacy-content-section">
        <h2>🎯 Privacy Best Practices</h2>
        
        <div class="warning-box">
          <p>⚠️ Although Privacy Cash breaks the technical link between deposits and withdrawals, observers can still analyze on-chain patterns. Follow these practices for maximum privacy:</p>
        </div>

        <div class="practices-list">
          <div class="practice">
            <h3>📱 Use a Clean Wallet</h3>
            <p>Withdraw to a new non-custodial wallet (Phantom, Solflare, Backpack) before sending to CEXs or other platforms.</p>
          </div>

          <div class="practice">
            <h3>💰 Deposit Round Amounts</h3>
            <p>Deposit 10 SOL not 10.237 SOL. Unique amounts make correlation obvious.</p>
          </div>

          <div class="practice">
            <h3>⏱️ Wait Before Withdrawing</h3>
            <p>Don't withdraw immediately. Wait at least 24 hours to break timing-based correlation.</p>
          </div>

          <div class="practice">
            <h3>📊 Split Withdrawals</h3>
            <p>Withdraw in multiple chunks (3, 3, 4 SOL) over several days instead of withdrawing once.</p>
          </div>

          <div class="practice">
            <h3>🔄 Swap Tokens</h3>
            <p>Swap some SOL to USDC/USDT to diversify tokens and prevent amount-based analysis.</p>
          </div>
        </div>

        <div class="privacy-tips">
          <h3>💡 Quick Tips</h3>
          <ul>
            <li>Deposit round, integer amounts</li>
            <li>Wait at least 1 day before withdrawing</li>
            <li>Split large withdrawals into chunks</li>
            <li>Use a clean wallet before sending to CEXs</li>
            <li>Swap tokens to diversify</li>
            <li>Spread withdrawals over multiple days</li>
            <li>Never sign messages on untrusted websites</li>
          </ul>
        </div>
      </div>
    `
    return html
  }

  /**
   * Render FAQ section
   */
  renderFAQ() {
    const html = `
      <div class="privacy-content-section">
        <h2>❓ Frequently Asked Questions</h2>
        
        <div class="faq-search">
          <input type="text" id="faq-search" placeholder="Search FAQs..." class="faq-search-input">
        </div>

        <div class="faq-categories">
          <details class="faq-category">
            <summary>Network Fees</summary>
            <div class="faq-items">
              <div class="faq-item">
                <p class="faq-q">Who pays for network fees?</p>
                <p class="faq-a">On deposit, you pay Solana network fees. On withdrawal, relayers pay. After SDK integration, you don't pay network fees.</p>
              </div>
              <div class="faq-item">
                <p class="faq-q">What is the minimum withdrawal amount?</p>
                <p class="faq-a">Check the minimum_withdrawal field in Privacy Cash config at https://api3.privacycash.org/config</p>
              </div>
            </div>
          </details>

          <details class="faq-category">
            <summary>Security & Privacy</summary>
            <div class="faq-items">
              <div class="faq-item">
                <p class="faq-q">How private is Privacy Cash really?</p>
                <p class="faq-a">Privacy Cash breaks the on-chain link, but observers can still make educated guesses using timing/amount analysis. Follow best practices for stronger privacy.</p>
              </div>
              <div class="faq-item">
                <p class="faq-q">Do I have to trust the relayer?</p>
                <p class="faq-a">No. Zero-knowledge proofs ensure relayers cannot modify your withdrawal parameters. Any tampering causes failure.</p>
              </div>
              <div class="faq-item">
                <p class="faq-q">Is my encryption key safe?</p>
                <p class="faq-a">Your key is derived from your signature and never leaves your device unless you leak it (e.g., phishing). Never sign on untrusted sites.</p>
              </div>
            </div>
          </details>

          <details class="faq-category">
            <summary>Development</summary>
            <div class="faq-items">
              <div class="faq-item">
                <p class="faq-q">Does the user need to pass private key to relayer?</p>
                <p class="faq-a">No. Private keys belong to users and never leave the client. The SDK keeps keys on the client side.</p>
              </div>
              <div class="faq-item">
                <p class="faq-q">Can I charge fees for SDK integration?</p>
                <p class="faq-a">Yes! You can add fee transfer instructions on deposit and charge users. Several projects already do this.</p>
              </div>
            </div>
          </details>
        </div>
      </div>
    `
    return html
  }

  /**
   * Render warnings
   */
  renderWarnings() {
    const html = `
      <div class="privacy-content-section">
        <h2>⚠️ Critical Security Warnings</h2>
        
        <div class="warning critical">
          <h3>🔒 Never Sign Messages on Phishing Sites</h3>
          <p>Your encryption key is derived from your signature. If you sign on a phishing site, your key can be compromised and funds stolen.</p>
          <p class="action">✓ Only sign on official Privacy Cash or ShadowPay interfaces</p>
        </div>

        <div class="warning critical">
          <h3>🔐 Keep Your Private Key Secret</h3>
          <p>Never share your private key with anyone. If compromised, anyone can access your funds.</p>
          <p class="action">✓ Store in secure password manager or hardware wallet</p>
        </div>

        <div class="warning important">
          <h3>✓ Use Clean Wallet for Final Transfer</h3>
          <p>Withdraw to a new clean non-custodial wallet before sending to CEXs. This adds extra privacy.</p>
          <p class="action">✓ Create a new wallet and withdraw there first</p>
        </div>

        <div class="warning important">
          <h3>⚠️ Avoid Unique Amounts</h3>
          <p>Depositing and withdrawing the same unique amount (10.237 SOL) makes correlation obvious.</p>
          <p class="action">✓ Use round amounts and split withdrawals</p>
        </div>

        <div class="warning important">
          <h3>⏱️ Timing Patterns Visible</h3>
          <p>Instant deposit followed by instant withdrawal is suspicious. Wait at least 24 hours.</p>
          <p class="action">✓ Space out your transactions</p>
        </div>
      </div>
    `
    return html
  }

  /**
   * Render privacy levels
   */
  renderPrivacyLevels() {
    const html = `
      <div class="privacy-content-section">
        <h2>🔐 Privacy Levels</h2>
        
        <div class="privacy-level">
          <h3>Minimal Privacy (Score: 2/10)</h3>
          <p>Single deposit and withdrawal on the same day</p>
          <p class="time">Time: 10 minutes</p>
          <p class="risk">Risk: Very high - obvious timing and amount correlation</p>
        </div>

        <div class="privacy-level">
          <h3>Standard Privacy (Score: 5/10)</h3>
          <p>Wait before withdrawing, use clean wallet, round amounts</p>
          <p class="time">Time: 1+ days</p>
          <p class="risk">Risk: Medium - timing correlation reduced</p>
          <p class="recommended">⭐ Recommended minimum</p>
        </div>

        <div class="privacy-level">
          <h3>Enhanced Privacy (Score: 7/10)</h3>
          <p>Split withdrawals into 3+ chunks, space them out over days</p>
          <p class="time">Time: 3+ days</p>
          <p class="risk">Risk: Low - both amount and timing correlation reduced</p>
        </div>

        <div class="privacy-level">
          <h3>Maximum Privacy (Score: 9/10)</h3>
          <p>Combine all strategies: wait, split, swap, use multiple clean wallets</p>
          <p class="time">Time: 1+ weeks</p>
          <p class="risk">Risk: Very low - comprehensive correlation prevention</p>
          <p class="recommended">⭐ For highest privacy needs</p>
        </div>
      </div>
    `
    return html
  }

  /**
   * Get complete HTML panel
   */
  getCompletePanel(): string {
    const basHTML = `
      <div class="privacy-education-container">
        ${this.renderOverview()}
        ${this.renderTransfers()}
        ${this.renderBestPractices()}
        ${this.renderFAQ()}
        ${this.renderWarnings()}
        ${this.renderPrivacyLevels()}
      </div>
    `
    return basHTML
  }
}

// CSS styles for the privacy education panel
export const PRIVACY_EDUCATION_STYLES = `
.privacy-education-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.privacy-header {
  text-align: center;
  margin-bottom: 30px;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 20px;
}

.privacy-header h1 {
  font-size: 28px;
  margin: 0 0 10px 0;
  color: #1a1a1a;
}

.privacy-header p {
  color: #666;
  margin: 0;
}

.privacy-nav {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
  flex-wrap: wrap;
}

.nav-btn {
  padding: 10px 20px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.nav-btn:hover {
  background: #f5f5f5;
  border-color: #999;
}

.privacy-content-section {
  margin-bottom: 40px;
  padding: 20px;
  background: #f9f9f9;
  border-radius: 8px;
  border-left: 4px solid #007bff;
}

.privacy-content-section h2 {
  margin-top: 0;
  color: #1a1a1a;
}

.transfer-steps,
.practices-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
  margin: 20px 0;
}

.step,
.practice {
  background: white;
  padding: 20px;
  border-radius: 6px;
  border: 1px solid #ddd;
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: #007bff;
  color: white;
  border-radius: 50%;
  font-weight: bold;
  margin-bottom: 10px;
}

.step h3,
.practice h3 {
  margin: 10px 0;
  color: #1a1a1a;
}

.step p,
.practice p {
  margin: 0;
  color: #666;
  font-size: 14px;
  line-height: 1.5;
}

.warning {
  padding: 15px;
  margin: 15px 0;
  border-radius: 6px;
  border-left: 4px solid;
}

.warning.critical {
  background: #ffe5e5;
  border-left-color: #d32f2f;
}

.warning.important {
  background: #fff3e0;
  border-left-color: #f57c00;
}

.warning h3 {
  margin: 0 0 10px 0;
  color: #1a1a1a;
}

.warning p {
  margin: 5px 0;
  color: #333;
}

.warning .action {
  color: #2e7d32;
  font-weight: 500;
}

.faq-category {
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  margin: 10px 0;
  padding: 0;
}

.faq-category summary {
  padding: 15px;
  cursor: pointer;
  font-weight: 500;
  user-select: none;
}

.faq-category summary:hover {
  background: #f5f5f5;
}

.faq-items {
  padding: 0 15px 15px 15px;
}

.faq-item {
  margin: 15px 0;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 4px;
}

.faq-q {
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 5px 0;
}

.faq-a {
  color: #666;
  margin: 0;
  line-height: 1.5;
}

.privacy-level {
  background: white;
  padding: 20px;
  border-radius: 6px;
  border: 1px solid #ddd;
  margin: 15px 0;
}

.privacy-level h3 {
  margin: 0 0 10px 0;
  color: #1a1a1a;
}

.privacy-level p {
  margin: 5px 0;
  color: #666;
}

.privacy-level .time {
  font-weight: 500;
  color: #007bff;
}

.privacy-level .risk {
  color: #d32f2f;
}

.privacy-level .recommended {
  color: #2e7d32;
  font-weight: 600;
}

.key-points ul,
.privacy-tips ul {
  list-style: none;
  padding: 0;
}

.key-points li,
.privacy-tips li {
  padding: 8px 0;
  color: #333;
}

.privacy-footer {
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid #ddd;
  color: #666;
  font-size: 14px;
}

.privacy-footer a {
  color: #007bff;
  text-decoration: none;
}

.privacy-footer a:hover {
  text-decoration: underline;
}
`
