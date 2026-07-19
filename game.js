let userWallet = null;
let gameState = { played: 0, won: 0, streak: 0 };
let canvas, ctx;
let isScratching = false;
let revealed = false;
let currentPrize = null;

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];

async function sendUSDC(amount, recipient) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
  const tx = await usdc.transfer(recipient, ethers.parseUnits(amount.toString(), 6));
  const receipt = await tx.wait();
  return receipt.transactionHash;
}

function init() {
  canvas = document.getElementById('scratchCanvas');
  ctx = canvas.getContext('2d');
  
  drawScratchLayer();
  
  canvas.addEventListener('mousedown', () => { isScratching = true; });
  canvas.addEventListener('mouseup', () => { isScratching = false; });
  canvas.addEventListener('mousemove', scratch);
  canvas.addEventListener('mouseleave', () => { isScratching = false; });
  
  canvas.addEventListener('touchstart', (e) => { 
    e.preventDefault(); 
    isScratching = true; 
  });
  canvas.addEventListener('touchend', () => { isScratching = false; });
  canvas.addEventListener('touchmove', scratch);
  
  const saved = localStorage.getItem('scratchWinStats');
  if (saved) Object.assign(gameState, JSON.parse(saved));
  updateStats();
  
  if (window.ethereum?.selectedAddress) {
    userWallet = window.ethereum.selectedAddress;
    updateWalletDisplay(userWallet);
  }
}

function drawScratchLayer() {
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(0, 0, 300, 300);
  ctx.fillStyle = '#333';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SCRATCH HERE', 150, 150);
}

function scratch(e) {
  if (revealed || !currentPrize || !isScratching) return;
  
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  let x, y;
  
  if (e.touches) {
    x = e.touches[0].clientX - rect.left;
    y = e.touches[0].clientY - rect.top;
  } else {
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;
  }
  
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(x, y, 35, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  
  checkRevealed();
}

function checkRevealed() {
  const imageData = ctx.getImageData(0, 0, 300, 300);
  const data = imageData.data;
  
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 128) transparent++;
  }
  
  const percent = (transparent / (data.length / 4)) * 100;
  
  if (percent > 20 && !revealed) {
    revealPrize();
  }
}

function revealPrize() {
  revealed = true;
  
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, 300, 300);
  ctx.fillStyle = '#FF6B6B';
  ctx.fillRect(0, 0, 300, 300);
  
  ctx.font = 'bold 80px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.fillText(currentPrize.emoji, 150, 150);
  
  if (currentPrize.amount > 0) {
    gameState.won++;
    gameState.streak++;
    showWinResult(currentPrize.amount);
  } else {
    gameState.streak = 0;
    showLossResult();
  }
  updateStats();
}

async function showWinResult(amount) {
  const result = document.getElementById('result');
  result.innerHTML = `
    <div class="result-icon">🎉</div>
    <div class="result-title">Won! +${amount} USDC</div>
    <div class="result-desc">Processing...</div>
  `;
  result.style.display = 'block';
  
  try {
    const txHash = await sendUSDC(amount, userWallet);
    result.innerHTML = `
      <div class="result-icon">🎉</div>
      <div class="result-title">Won! +${amount} USDC</div>
      <div class="result-desc">
        <p style="font-size: 12px; color: #666; margin: 8px 0;">TX Hash:</p>
        <a href="https://basescan.org/tx/${txHash}" target="_blank" style="color: #0052ff; text-decoration: none; word-break: break-all; font-family: monospace; font-size: 11px; display: inline-block; background: #f5f5f5; padding: 8px; border-radius: 5px; max-width: 280px;">
          ${txHash}
        </a>
        <br>
        <a href="https://basescan.org/tx/${txHash}" target="_blank" style="color: #0052ff; text-decoration: underline; margin-top: 10px; display: inline-block;">
          📊 View on Basescan →
        </a>
      </div>
    `;
  } catch (e) {
    result.innerHTML = `
      <div class="result-icon">⚠️</div>
      <div class="result-title">Transfer Failed</div>
      <div class="result-desc">${e.message}</div>
    `;
  }
}

function showLossResult() {
  const result = document.getElementById('result');
  result.innerHTML = `
    <div class="result-icon">😢</div>
    <div class="result-title">Try Again!</div>
  `;
  result.style.display = 'block';
}

async function connectWallet() {
  try {
    if (!window.ethereum) {
      alert('Install Rabby Wallet: https://rabby.io');
      return;
    }
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }],
      });
    } catch (e) {
      if (e.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x2105',
            chainName: 'Base Mainnet',
            rpcUrls: ['https://mainnet.base.org'],
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            blockExplorerUrls: ['https://basescan.org'],
          }],
        });
      }
    }
    
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });
    
    userWallet = accounts[0];
    updateWalletDisplay(userWallet);
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

function updateWalletDisplay(addr) {
  const badge = document.getElementById('walletBadge');
  badge.textContent = `✅ ${addr.slice(0, 6)}...${addr.slice(-4)}`;
  badge.style.display = 'inline-block';
  
  const btn = document.getElementById('btnWallet');
  btn.textContent = '✅ Connected';
  btn.disabled = true;
}

function newGame() {
  if (!userWallet) {
    alert('Connect wallet first!');
    return;
  }
  
  revealed = false;
  isScratching = false;
  document.getElementById('result').style.display = 'none';
  
  drawScratchLayer();
  
  const r = Math.random() * 100;
  if (r < 3) currentPrize = { emoji: '💎', amount: 100 };
  else if (r < 11) currentPrize = { emoji: '🥇', amount: 10 };
  else if (r < 25) currentPrize = { emoji: '🎁', amount: 5 };
  else if (r < 45) currentPrize = { emoji: '⭐', amount: 1 };
  else currentPrize = { emoji: '❌', amount: 0 };
  
  gameState.played++;
  updateStats();
}

function updateStats() {
  document.getElementById('statPlays').textContent = gameState.played;
  document.getElementById('statWins').textContent = gameState.won;
  document.getElementById('statStreak').textContent = gameState.streak;
  localStorage.setItem('scratchWinStats', JSON.stringify(gameState));
}

window.connectWallet = connectWallet;
window.newGame = newGame;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
