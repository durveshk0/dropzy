# ⚡ Dropzy

**Lightning fast, cross-device P2P file transfer application.**

Dropzy allows you to securely share files of any size directly between your devices without storing them on a central server. By leveraging WebRTC, Dropzy establishes a robust peer-to-peer connection for fast, limitless, and secure multi-file transfers. 

## ✨ Features

- **🚀 P2P WebRTC Transfers:** Files are transferred directly between peers. No server-side file size limits or bottlenecks.
- **📱 Cross-Device Compatibility:** Works seamlessly across mobile phones, tablets, and laptops.
- **🔗 Quick Connect:** Scan a QR code or enter a 6-digit code to instantly bridge devices.
- **📦 Multi-File & Large File Support:** Send multiple files simultaneously with ease. Handles large files smoothly by streaming them in chunks.
- **📊 Real-time Progress Tracking:** Visual indicators and progress bars keep you updated on your transfer status.
- **🛡️ Secure & Private:** Files are streamed directly through secure WebRTC Data Channels. No persistent storage on the server.
- **🔋 Fallback Mechanism:** Includes a reliable backend handler for signaling and temporary fallback for basic network constraints.

## 🛠️ Tech Stack

**Frontend:**
- **React (Vite)**
- **PeerJS** (WebRTC API wrapper)
- **Axios**
- CSS (Modern Glassmorphism UI)
- Lucide React (Icons)
- QRCode React (QR Generation)

**Backend:**
- **Python (Flask)**
- Flask-CORS
- Werkzeug

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- Python (3.8+)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/dropzy.git
cd dropzy
```

### 2. Setup the Backend
The backend serves as a signaling server to exchange WebRTC connection details.

```bash
cd backend

# Create a virtual environment (optional but recommended)
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate 

# Install dependencies
pip install flask flask-cors werkzeug

# Run the Flask server
python app.py
```
*The server will run on `http://0.0.0.0:5000`.*

### 3. Setup the Frontend
```bash
# Open a new terminal
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

## 💡 Architecture & Workflow
1. **Initiate:** The sender selects files. The React app connects to PeerJS to get an ID and registers it with the Flask backend, receiving a unique 6-digit code.
2. **Connect:** The receiver inputs the 6-digit code (or scans the QR). The backend resolves this to the sender's Peer ID.
3. **Tunnel:** A direct WebRTC tunnel is established between both browsers.
4. **Stream:** Files are sliced into 128KB chunks and transmitted sequentially. This handles backpressure efficiently to prevent the browser from crashing when sending GBs of data!

## 🤝 Contributing
Contributions, issues, and feature requests are welcome!

## 📝 License
This project is licensed under the MIT License.
