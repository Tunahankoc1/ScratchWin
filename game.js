let userWallet = null;
let gameState = { played: 0, won: 0, streak: 0 };
let canvas, ctx;
let isScratching = false;
let revealed = false;
let currentPrize = null;

function init() {
  console.log('🎮 ScratchWin init başladı');
  canvas = document.getElementById('scratchCanvas');
  if (!canvas) {
    console.error('Canvas bulunamadı!');
    return;
  }
  
  ctx = canvas.getContext('2d');
  drawScratchLayer();
  
  canvas.addEventListener('mousedown', () => { isScratching = true; });
  canvas.addEventListener('mouseup', stopScratching);
  canvas.addEventListener('mousemove', scratch);
  canvas.addEventListener('mouseleave', stopScratching);
  
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); isScratching = true; });
  canvas.addEventListener('touchend', stopScratching);
  canvas.addEventListener('touchmove', scratch);
  
  const saved = localStorage.getItem('scratchWinStats');
  if (saved) Object.assign(gameState, JSON.parse(saved));
  updateStats();
  
  console.log('✅ Init tamamlandı');
}

function drawScratchLayer() {
  ctx.clearRect(0, 0, 300, 300);
  
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

function stopScratching() {
  isScratching = false;
}

function checkRevealed() {
  const imageData = ctx.getImageData(0, 0, 300, 300);
  const data = imageData.data;
  
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 128) transparent++;
  }
  
  const percent = (transparent / (data.length / 4)) * 100;
  console.log('Kazıldı:', percent.toFixed(1) + '%');
  
  if (percent > 25 && !revealed) {
    revealPrize();
  }
}

function revealPrize() {
  revealed = true;
  isScratching = false;
  
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, 300, 300);
  
  ctx.fillStyle = '#FF6B6B';
  ctx.fillRect(0, 0, 300, 300);
  
  ctx.font = 'bold 80px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.fillText(currentPrize.emoji, 150, 150);
  
  console.log('🎉 Kazanıldı:', currentPrize);
  
  if (currentPrize.amount > 0) {
    showWinResult(currentPrize.amount);
  } else {
    showLossResult();
  }
}

async function connectWallet() {
  try {
    if (!window.ethereum) {
      alert('❌ Rabby Wallet yükleyin: https://rabby.io');
      return;
    }
    
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });
    userWallet = accounts[0];
    updateWalletDisplay(userWallet);
    console.log('✅ Wallet bağlandı:', userWallet);
  } catch (e) {
    alert('❌ Hata: ' + e.message);
  }
}

function updateWalletDisplay(addr) {
  const badge = document.getElementById('walletBadge');
  if (badge) {
    badge.textContent = `✅ ${addr.slice(0, 6)}...${addr.slice(-4)}`;
    badge.style.display = 'inline-block';
  }
}

function newGame() {
  if (!userWallet) {
    alert('❌ Önce Wallet bağlayın!');
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
  console.log('🎲 Prize:', currentPrize);
}

function showWinResult(amount) {
  const result = document.getElementById('result');
  result.innerHTML = `
    <div class="result-icon">🎉</div>
    <div class="result-title">Kazandınız! +${amount} USDC</div>
    <div class="result-desc">TX gönderiliyor...</div>
  `;
  result.style.display = 'block';
  
  gameState.won++;
  gameState.streak++;
  updateStats();
}

function showLossResult() {
  const result = document.getElementById('result');
  result.innerHTML = `
    <div class="result-icon">😢</div>
    <div class="result-title">Kazanamadınız!</div>
    <div class="result-desc">Tekrar deneyin</div>
  `;
  result.style.display = 'block';
  
  gameState.streak = 0;
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
