import { sdk } from 'https://esm.sh/@farcaster/frame-sdk';
sdk.actions.ready();

const PRIZES = [
  { emoji: "💎", text: "100 USDC JACKPOT", win: true, chance: 3 },
  { emoji: "🥇", text: "10 USDC", win: true, chance: 8 },
  { emoji: "🎁", text: "5 USDC", win: true, chance: 14 },
  { emoji: "⭐", text: "1 USDC", win: true, chance: 20 },
  { emoji: '💸', text: 'BETTER LUCK NEXT TIME', win: false, chance: 30 },
  { emoji: '😢', text: 'NO LUCK TRY AGAIN', win: false, chance: 25 },
];

let canvas, ctx, isScratching, revealed;
let stats = JSON.parse(localStorage.getItem('sw_stats') || '{"plays":0,"wins":0,"streak":0}');
let currentPrize = null;
let walletAddress = null;
let provider = null;

function getProvider() {
  return window.ethereum?.providers?.find(p => p.isCoinbaseWallet)
    || (window.ethereum?.isCoinbaseWallet ? window.ethereum : null)
    || window.ethereum;
}

async function connectWallet() {
  provider = getProvider();
  if (!provider) { alert('Please install Coinbase Wallet extension!'); return; }
  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    walletAddress = accounts[0];
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
    } catch (e) {
      if (e.code === 4902) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{ chainId: '0x2105', chainName: 'Base', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] }]
        });
      }
    }
    updateWalletUI();
  } catch (e) { console.error(e); }
}

function updateWalletUI() {
  const btn = document.getElementById('btnWallet');
  const badge = document.getElementById('walletBadge');
  if (walletAddress) {
    const short = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
    btn.textContent = '✅ ' + short;
    btn.style.background = 'rgba(0,230,118,0.15)';
    btn.style.color = '#00e676';
    btn.style.border = '1px solid #00e676';
    badge.style.display = 'block';
    badge.textContent = '🔵 Connected to Base';
  }
}

async function buyTicket() {
  if (!walletAddress) { alert('Connect your wallet first!'); return; }
  try {
    const val = (0.0001 * 1e18).toString(16);
    await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: walletAddress, to: '0x000000000000000000000000000000000000dEaD', value: '0x' + parseInt(val).toString(16) }]
    });
    window.newGame();
  } catch(e) { console.error(e); }
}

async function sendWinTx() {
  if (!walletAddress) return;
  try {
    const msg = 'Scratch and Win - ' + currentPrize.text + ' - ' + new Date().toISOString();
    const hex = '0x' + Array.from(new TextEncoder().encode(msg)).map(b => b.toString(16).padStart(2, '0')).join('');
    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: walletAddress, to: walletAddress, value: '0x0', data: hex }]
    });
    document.getElementById('resultDesc').textContent += ' TX: ' + txHash.slice(0, 10) + '...';
  } catch(e) { console.error(e); }
}

function pickPrize() {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const prize of PRIZES) { cumulative += prize.chance; if (roll < cumulative) return prize; }
  return PRIZES[PRIZES.length - 1];
}

function setupCanvas() {
  canvas = document.getElementById('scratchCanvas');
  ctx = canvas.getContext('2d');
  isScratching = false;
  revealed = false;
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, '#c9a227');
  grad.addColorStop(0.5, '#f5c518');
  grad.addColorStop(1, '#b8860b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SCRATCH HERE', canvas.width / 2, canvas.height / 2);
  ctx.globalCompositeOperation = 'destination-out';
  attachEvents();
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const source = e.touches ? e.touches[0] : e;
  return { x: (source.clientX - rect.left) * scaleX, y: (source.clientY - rect.top) * scaleY };
}

function scratch(x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.fill();
  checkProgress();
}

function checkProgress() {
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) { if (data[i] < 128) transparent++; }
  const pct = Math.min((transparent / (canvas.width * canvas.height)) * 100, 100);
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressLabel').textContent = pct < 60 ? Math.round(pct) + '% scratched...' : 'Almost there!';
  if (pct >= 60 && !revealed) { revealed = true; revealResult(); }
}

function revealResult() {
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const result = document.getElementById('result');
  result.style.display = 'block';
  result.className = 'result ' + (currentPrize.win ? 'win' : 'lose');
  document.getElementById('resultIcon').textContent = currentPrize.emoji;
  document.getElementById('resultTitle').textContent = currentPrize.win ? '🎉 You Won!' : '😔 No Prize';
  document.getElementById('resultDesc').textContent = currentPrize.win ? 'You got: ' + currentPrize.text : 'Better luck next time!';
  stats.plays++;
  if (currentPrize.win) { stats.wins++; stats.streak++; sendWinTx(); } else { stats.streak = 0; }
  localStorage.setItem('sw_stats', JSON.stringify(stats));
  updateStatsUI();
}

function updateStatsUI() {
  document.getElementById('statPlays').textContent = stats.plays;
  document.getElementById('statWins').textContent = stats.wins;
  document.getElementById('statStreak').textContent = stats.streak;
}

function attachEvents() {
  canvas.addEventListener('mousedown', (e) => { isScratching = true; const p = getPos(e); scratch(p.x, p.y); });
  canvas.addEventListener('mousemove', (e) => { if (isScratching) { const p = getPos(e); scratch(p.x, p.y); } });
  canvas.addEventListener('mouseup', () => { isScratching = false; });
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); isScratching = true; const p = getPos(e); scratch(p.x, p.y); }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); if (isScratching) { const p = getPos(e); scratch(p.x, p.y); } }, { passive: false });
  canvas.addEventListener('touchend', () => { isScratching = false; });
}

window.newGame = function() {
  if (canvas) { ctx.globalCompositeOperation = "source-over"; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  currentPrize = pickPrize();
  document.getElementById('prizeEmoji').textContent = currentPrize.emoji;
  document.getElementById('prizeText').textContent = currentPrize.text;
  document.getElementById('result').style.display = 'none';
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('progressLabel').textContent = 'Scratch to reveal...';
  setupCanvas();
};

window.connectWallet = connectWallet;
window.buyTicket = buyTicket;

if (window.ethereum) {
  provider = getProvider();
  provider?.request({ method: 'eth_accounts' }).then(accounts => {
    if (accounts.length > 0) { walletAddress = accounts[0]; updateWalletUI(); }
  });
}

updateStatsUI();
window.newGame();
