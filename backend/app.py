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
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file:
        filename = secure_filename(file.filename)
        # Avoid collisions completely
        unique_name = f"{uuid.uuid4()}_{filename}"
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
        file.save(save_path)
        
        code = generate_code()
        while code in file_registry:
            code = generate_code()
            
        file_registry[code] = {
            'filename': filename,
            'path': save_path,
            'timestamp': time.time(),
            'downloaded': False
        }
        
        local_ip = get_local_ip()
        return jsonify({'code': code, 'filename': filename, 'local_ip': local_ip}), 200

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
