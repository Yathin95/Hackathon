from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # This allows your JS to access the Python server

@app.route('/get-message')
def home():
    # This sends data back to your JS
    return jsonify({"message": "Successfully connected to Python!"})

if __name__ == '__main__':
    app.run(port=5000)