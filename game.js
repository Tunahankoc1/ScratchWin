import { ethers } from 'https://cdn.jsdelivr.net/npm/ethers@6.8.0/+esm';

// ============ CONSTANTS ============

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_CHAIN_ID = '0x2105'; // Base Mainnet
const BASESCAN_URL = 'https://basescan.org/tx/';

const USDC_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

// ============ STATE ============

let userWallet = null;
let gameState = {
  played: 0,
  won: 0,
  streak: 0,
};

// ============ WALLET CONNECTION ============

async function connectWallet() {
  try {
    console.log('🔌 Wallet bağlantı başladı...');

    // Rabby Wallet kontrolü
    if (!window.ethereum) {
      alert('❌ Lütfen Rabby Wallet yükleyin!\n\nhttps://rabby.io');
      window.open('https://rabby.io', '_blank');
      return;
    }

    console.log('✅ Rabby Wallet bulundu');

    // Base Mainnet'e switch yap
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID }],
      });
      console.log('✅ Base Mainnet\'e switched');
    } catch (switchError) {
      // Eğer network yoksa ekle
      if (switchError.code === 4902) {
        console.log('🔧 Base ağı ekleniyor...');
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: BASE_CHAIN_ID,
              chainName: 'Base Mainnet',
              rpcUrls: ['https://mainnet.base.org'],
              nativeCurrency: {
                name: 'Ether',
                symbol: 'ETH',
                decimals: 18,
              },
              blockExplorerUrls: ['https://basescan.org'],
            },
          ],
        });
        console.log('✅ Base ağı eklendi');
      }
    }

    // Hesap bağlantısı iste
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });

    userWallet = accounts[0];
    console.log('✅ Hesap bağlandı:', userWallet);

    updateWalletDisplay(userWallet);
    enableGameButtons();

  } catch (error) {
    console.error('❌ Wallet hatası:', error);
    alert('❌ Cüzdan bağlantısı başarısız oldu\n\n' + error.message);
  }
}

// ============ WALLET DISPLAY ============

function updateWalletDisplay(address) {
  const badge = document.getElementById('walletBadge');
  if (badge) {
    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
    badge.textContent = `✅ Bağlı: ${shortAddr}`;
    badge.style.display = 'inline-block';
  }

  const btn = document.getElementById('btnWallet');
  if (btn) {
    btn.textContent = '✅ Bağlı';
    btn.disabled = true;
    btn.style.opacity = '0.7';
  }
}

function enableGameButtons() {
  const playBtn = document.getElementById('btnPlay');
  if (playBtn) {
    playBtn.disabled = false;
    playBtn.style.opacity = '1';
  }
}

// ============ PRIZE CALCULATION ============

function calculatePrize() {
  const random = Math.random() * 100;

  if (random < 3) return 100; // 💎 Jackpot (3%)
  if (random < 11) return 10; // 🥇 Gold (8%)
  if (random < 25) return 5; // 🎁 Mystery (14%)
  if (random < 45) return 1; // ⭐ Lucky (20%)
  return 0; // ❌ No Prize (55%)
}

function getPrizeEmoji(amount) {
  if (amount >= 100) return '💎';
  if (amount >= 10) return '🥇';
  if (amount >= 5) return '🎁';
  if (amount >= 1) return '⭐';
  return '❌';
}

// ============ GAME LOGIC ============

async function newGame() {
  if (!userWallet) {
    alert('❌ Lütfen önce Rabby Wallet ile bağlanın!');
    document.getElementById('btnWallet').click();
    return;
  }

  // Hide previous result
  document.getElementById('result').style.display = 'none';

  // Play game
  await playGame();
}

async function playGame() {
  try {
    console.log('🎮 Oyun başladı...');

    const prize = calculatePrize();
    gameState.played++;

    if (prize > 0) {
      // Win - Send USDC
      console.log(`🎉 Kazandı! Prize: ${prize} USDC`);
      await sendUSDCPayout(userWallet, prize);
    } else {
      // Loss
      console.log('❌ Kazanamadı');
      gameState.streak = 0;
      showLossResult();
    }

    updateStats();

  } catch (error) {
    console.error('❌ Oyun hatası:', error);
    alert('❌ Oyun sırasında hata oluştu:\n\n' + error.message);
  }
}

// ============ USDC TRANSFER ============

async function sendUSDCPayout(recipientWallet, amountUsdc) {
  try {
    console.log(`💸 USDC gönderiliyor: ${amountUsdc} → ${recipientWallet}`);

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

    // USDC miktarını hesapla (6 decimals)
    const amountInWei = ethers.parseUnits(amountUsdc.toString(), 6);

    console.log('📝 Transfer transaction oluşturuluyor...');

    // Transfer
    const tx = await usdc.transfer(recipientWallet, amountInWei);
    const txHash = tx.hash;

    console.log('⏳ Transaction bekleniyor:', txHash);

    const receipt = await tx.wait();

    console.log('✅ Transaction başarılı:', receipt.transactionHash);

    // Update game state
    gameState.won++;
    gameState.streak++;

    // Show win result with link
    showWinResult(amountUsdc, receipt.transactionHash);

  } catch (error) {
    console.error('❌ USDC transfer hatası:', error);

    if (error.code === 'INSUFFICIENT_FUNDS') {
      alert('❌ Yetersiz ETH balance (gas fee için)');
    } else if (error.code === 'ACTION_REJECTED') {
      alert('❌ Transaction reddedildi');
    } else {
      alert('❌ Transfer başarısız:\n\n' + error.message);
    }

    throw error;
  }
}

// ============ UI - WIN RESULT ============

function showWinResult(prize, txHash) {
  const result = document.getElementById('result');
  const icon = document.getElementById('resultIcon');
  const title = document.getElementById('resultTitle');
  const desc = document.getElementById('resultDesc');

  const emoji = getPrizeEmoji(prize);
  const explorerUrl = BASESCAN_URL + txHash;

  // Icon
  icon.textContent = emoji;

  // Title
  title.textContent = `🎉 Kazandınız! +${prize} USDC`;

  // Description with clickable link
  desc.innerHTML = `
    <div style="margin-top: 15px; text-align: center;">
      <p style="font-size: 12px; color: #666; margin: 8px 0; font-weight: 500;">
        📊 Transaction Hash
      </p>
      
      <a href="${explorerUrl}" 
         target="_blank" 
         rel="noopener noreferrer"
         style="
           display: inline-block;
           background: #f5f5f5;
           color: #0052ff;
           text-decoration: none;
           padding: 10px 12px;
           border-radius: 6px;
           font-family: 'Courier New', monospace;
           font-size: 11px;
           word-break: break-all;
           max-width: 280px;
           border: 1px solid #e0e0e0;
           transition: all 0.2s ease;
           cursor: pointer;
         "
         onmouseover="this.style.background='#e8f0ff'; this.style.borderColor='#0052ff';"
         onmouseout="this.style.background='#f5f5f5'; this.style.borderColor='#e0e0e0';">
        ${txHash}
      </a>
      
      <br>
      
      <a href="${explorerUrl}" 
         target="_blank" 
         rel="noopener noreferrer"
         style="
           display: inline-block;
           color: #0052ff;
           text-decoration: none;
           font-size: 14px;
           margin-top: 12px;
           padding: 8px 16px;
           border-radius: 5px;
           transition: all 0.2s ease;
         "
         onmouseover="this.style.textDecoration='underline'; this.style.background='rgba(0,82,255,0.05)';"
         onmouseout="this.style.textDecoration='none'; this.style.background='transparent';">
        🔗 Basescan'da Görüntüle →
      </a>
    </div>
  `;

  result.style.display = 'block';
}

// ============ UI - LOSS RESULT ============

function showLossResult() {
  const result = document.getElementById('result');
  const icon = document.getElementById('resultIcon');
  const title = document.getElementById('resultTitle');
  const desc = document.getElementById('resultDesc');

  icon.textContent = '😢';
  title.textContent = 'Kazanamadınız!';
  desc.innerHTML = `
    <p style="font-size: 14px; color: #666; margin: 10px 0;">
      🎰 Tekrar deneyin! Şansınız başkasında olabilir...
    </p>
  `;

  result.style.display = 'block';
}

// ============ STATS UPDATE ============

function updateStats() {
  try {
    document.getElementById('statPlays').textContent = gameState.played;
    document.getElementById('statWins').textContent = gameState.won;
    document.getElementById('statStreak').textContent = gameState.streak;

    // Local storage'a kaydet
    localStorage.setItem('scratchWinStats', JSON.stringify(gameState));
    console.log('📊 Stats güncellendi:', gameState);

  } catch (error) {
    console.error('Stats update hatası:', error);
  }
}

// ============ INITIALIZATION ============

function initializeGame() {
  console.log('🎮 ScratchWin başlatılıyor...');

  // Load stats from local storage
  const savedStats = localStorage.getItem('scratchWinStats');
  if (savedStats) {
    Object.assign(gameState, JSON.parse(savedStats));
    console.log('📊 Kaydedilmiş stats yüklendi:', gameState);
  }

  // Update display
  updateStats();

  // Check if wallet is already connected
  if (window.ethereum?.selectedAddress) {
    userWallet = window.ethereum.selectedAddress;
    updateWalletDisplay(userWallet);
    enableGameButtons();
    console.log('✅ Wallet zaten bağlı:', userWallet);
  }

  // Listen for account changes
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        console.log('⚠️ Wallet bağlantısı kesildi');
        userWallet = null;
        location.reload();
      } else {
        console.log('🔄 Account değişti:', accounts[0]);
        userWallet = accounts[0];
        updateWalletDisplay(userWallet);
      }
    });

    window.ethereum.on('chainChanged', (chainId) => {
      console.log('🔄 Network değişti:', chainId);
      if (chainId !== BASE_CHAIN_ID) {
        alert('⚠️ Lütfen Base Mainnet ağını seçin!');
        location.reload();
      }
    });
  }

  console.log('✅ ScratchWin hazır!');
}

// ============ START ============

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGame);
} else {
  initializeGame();
}

// Export functions for HTML onclick handlers
window.connectWallet = connectWallet;
window.newGame = newGame;
