import os
import uuid
import random
import string
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
import time
import threading
import socket
import shutil

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

app = Flask(__name__)
# Allow CORS for local network and frontend
CORS(app, resources={r"/*": {"origins": "*"}})

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# In-memory storage: code -> file metadata
file_registry = {}

# Clean up files older than 10 mins (600 seconds)
def cleanup_old_files():
    while True:
        time.sleep(60)
        now = time.time()
        to_delete = []
        for code, info in list(file_registry.items()):
            if now - info['timestamp'] > 600:
                to_delete.append(code)
        for code in to_delete:
            path = file_registry[code]['path']
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception as e:
                print(f"Error removing {path}: {e}")
            del file_registry[code]

threading.Thread(target=cleanup_old_files, daemon=True).start()

def generate_code():
    return ''.join(random.choices(string.digits, k=6))

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
        
    files = request.files.getlist('file')
    if not files or files[0].filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    code = generate_code()
    while code in file_registry:
        code = generate_code()

    if len(files) == 1:
        # Avoid collisions completely
        file = files[0]
        filename = secure_filename(file.filename)
        unique_name = f"{uuid.uuid4()}_{filename}"
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
        file.save(save_path)
    else:
        # Zip multiple files
        filename = f"Dropzy_Bundle_{code}.zip"
        bundle_id = str(uuid.uuid4())
        unique_name = f"{bundle_id}_{filename}"
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
        
        # Save files to temp directory then zip
        temp_dir = os.path.join(app.config['UPLOAD_FOLDER'], bundle_id)
        os.makedirs(temp_dir, exist_ok=True)
        
        for file in files:
            file.save(os.path.join(temp_dir, secure_filename(file.filename)))
            
        shutil.make_archive(save_path.replace('.zip', ''), 'zip', temp_dir)
        shutil.rmtree(temp_dir)
        
    file_registry[code] = {
        'filename': filename,
        'path': save_path,
        'timestamp': time.time(),
        'downloaded': False
    }
    
    local_ip = get_local_ip()
    return jsonify({'code': code, 'filename': filename, 'local_ip': local_ip}), 200

# WebRTC Signaling Routes
@app.route('/webrtc/signal', methods=['POST'])
def webrtc_signal():
    data = request.json
    if not data or 'peerId' not in data:
        return jsonify({'error': 'No peerId provided'}), 400
    
    code = generate_code()
    while code in file_registry:
        code = generate_code()
        
    file_registry[code] = {
        'peerId': data['peerId'],
        'metadata': data.get('metadata', {}),
        'timestamp': time.time(),
        'webrtc': True
    }
    
    return jsonify({'code': code}), 200

@app.route('/webrtc/<code>', methods=['GET'])
def webrtc_get(code):
    if code in file_registry and file_registry[code].get('webrtc'):
        return jsonify({
            'peerId': file_registry[code]['peerId'],
            'metadata': file_registry[code]['metadata']
        }), 200
    return jsonify({'error': 'Invalid code or expired'}), 404

@app.route('/files/<code>', methods=['GET'])
def get_file_info(code):
    if code in file_registry:
        return jsonify({'filename': file_registry[code]['filename']})
    return jsonify({'error': 'Invalid code or file expired'}), 404

@app.route('/download/<code>', methods=['GET'])
def download_file(code):
    if code not in file_registry:
        return jsonify({'error': 'Invalid code or file expired'}), 404
        
    file_info = file_registry[code]
    file_info['downloaded'] = True
    return send_file(file_info['path'], as_attachment=True, download_name=file_info['filename'])

@app.route('/status/<code>', methods=['GET'])
def check_status(code):
    if code in file_registry:
        return jsonify({'downloaded': file_registry[code].get('downloaded', False)})
    return jsonify({'error': 'Not found'}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
