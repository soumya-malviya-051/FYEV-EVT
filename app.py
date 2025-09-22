from flask import Flask, request, jsonify, session
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
import json
import os
import random
from datetime import datetime, timedelta, timezone
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import requests
import pandas as pd
import numpy as np # Import numpy to handle NaN values

# --- App Initialization ---
app = Flask(__name__)
CORS(app, supports_credentials=True, resources={r"/*": {"origins": "*"}})
bcrypt = Bcrypt(app)

# --- 🔽 ACTION REQUIRED: PASTE YOUR KEYS AND SECRETS HERE 🔽 ---
MONGO_URI = ""
SENDGRID_API_KEY = ''
SENDER_EMAIL = ''
GEMINI_API_KEY = ""
app.secret_key = ''
# --- 🔼 ACTION REQUIRED: PASTE YOUR KEYS AND SECRETS HERE 🔼 ---


# --- Database & Login Manager Setup ---
client = MongoClient(MONGO_URI)
db = client.fvey
users_collection = db.users
login_manager = LoginManager()
login_manager.init_app(app)

class User(UserMixin):
    def __init__(self, user_data):
        self.id = str(user_data["_id"])
        self.email = user_data["email"]
        self.name = user_data.get("name")

@login_manager.user_loader
def load_user(user_id):
    user_data = users_collection.find_one({"_id": ObjectId(user_id)})
    return User(user_data) if user_data else None

# --- User Authentication Routes ---

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    if not name or not email: return jsonify({"error": "Name and email are required."}), 400
    if len(name) < 2: return jsonify({"error": "Name must be at least 2 characters long."}), 400
    if users_collection.find_one({"email": email}): return jsonify({"error": "This email is already registered."}), 409
    users_collection.insert_one({"name": name, "email": email, "createdAt": datetime.now(timezone.utc)})
    return jsonify({"message": "Registration successful. Please proceed to log in."}), 201

@app.route('/login/otp/send', methods=['POST'])
def send_otp():
    data = request.get_json()
    email = data.get('email')
    if not email: return jsonify({"error": "Email is required"}), 400
    user = users_collection.find_one({"email": email})
    if not user: return jsonify({"error": "Email not found"}), 404
    otp = str(random.randint(100000, 999999))
    otp_expiry = datetime.now(timezone.utc) + timedelta(minutes=10)
    users_collection.update_one({"_id": user["_id"]}, {"$set": {"otp": otp, "otp_expiry": otp_expiry}})
    message = Mail(from_email=SENDER_EMAIL, to_emails=email, subject='Your FYEV Login Code', html_content=f'<h2>Your login code is: <strong>{otp}</strong></h2><p>This code will expire in 10 minutes.</p>')
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        sg.send(message)
        return jsonify({"message": "Login code sent to your email."})
    except Exception as e:
        print(f"SendGrid Error: {e}")
        return jsonify({"error": "Could not send login code."}), 500

@app.route('/login/otp/verify', methods=['POST'])
def verify_otp():
    data = request.get_json()
    email = data.get('email')
    otp = data.get('otp')
    if not email or not otp: return jsonify({"error": "Email and OTP are required"}), 400
    user_data = users_collection.find_one({"email": email, "otp": otp, "otp_expiry": {"$gt": datetime.now(timezone.utc)}})
    if not user_data: return jsonify({"error": "Invalid or expired login code."}), 401
    users_collection.update_one({"_id": user_data["_id"]}, {"$unset": {"otp": "", "otp_expiry": ""}})
    user_obj = User(user_data)
    login_user(user_obj)
    return jsonify({"message": "Login successful", "user": {"name": user_obj.name, "email": user_obj.email}})

@app.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "You have been logged out."})

@app.route('/@me')
@login_required
def get_current_user():
    return jsonify({"user": {"name": current_user.name, "email": current_user.email}})

# --- AI Suggestion Route (No Image) ---
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={GEMINI_API_KEY}"
CLASSIFIER_SYSTEM_PROMPT = "You are a classifier. The user will provide a question. Your only job is to determine if the user's question is asking for a recommendation for an Electric Vehicle (EV). Respond with only 'yes' or 'no'."
SYSTEM_PROMPT = """
You are an expert EV advisor named 'FYEV AI'. A user will describe their needs for an electric vehicle. Your job is to analyze their request and recommend exactly ONE EV that is a great fit.
Respond in a valid, minified JSON format without any markdown formatting. The JSON object must have the following structure:
{
  "name": "Vehicle Name",
  "tagline": "A catchy, one-sentence summary.",
  "specs": { "Range": "X miles", "0-60": "X.X seconds", "Top Speed": "XXX mph", "Price": "$XX,XXX" },
  "key_features": [ "Feature 1 description.", "Feature 2 description.", "Feature 3 description." ],
  "reasoning": "A concise paragraph (2-3 sentences) explaining WHY this specific car is the perfect recommendation based on the user's query."
}
"""

@app.route('/suggest', methods=['POST'])
def suggest_ev():
    try:
        user_text = request.json.get('user_text')
        if not user_text:
            return jsonify({"error": "User text is required."}), 400
        classifier_payload = {"contents": [{"parts": [{"text": user_text}]}], "system_instruction": {"parts": [{"text": CLASSIFIER_SYSTEM_PROMPT}]}}
        classifier_response = requests.post(GEMINI_API_URL, json=classifier_payload, headers={'Content-Type': 'application/json'})
        classifier_response.raise_for_status()
        intent = classifier_response.json()['candidates'][0]['content']['parts'][0]['text'].strip().lower()
        if 'no' in intent:
            return jsonify({"error": "This question doesn't seem to be about EV recommendations."}), 400
        payload = {"contents": [{"parts": [{"text": user_text}]}], "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]}}
        response = requests.post(GEMINI_API_URL, json=payload, headers={'Content-Type': 'application/json'})
        response.raise_for_status()
        json_text = response.json()['candidates'][0]['content']['parts'][0]['text']
        cleaned_json_text = json_text.strip().replace('```json', '').replace('```', '').strip()
        ai_recommendation = json.loads(cleaned_json_text)
        required_keys = ["name", "tagline", "specs", "key_features", "reasoning"]
        if not all(key in ai_recommendation for key in required_keys):
            raise ValueError("AI response is missing one or more required fields.")
        if not isinstance(ai_recommendation["specs"], dict) or not isinstance(ai_recommendation["key_features"], list):
             raise ValueError("AI response has incorrect data types for 'specs' or 'key_features'.")
        return jsonify(ai_recommendation)
    except requests.exceptions.RequestException as e:
        print(f"API Request Error: {e}")
        return jsonify({"error": "Failed to communicate with the AI model."}), 500
    except (KeyError, IndexError, json.JSONDecodeError, ValueError) as e:
        print(f"Error parsing or validating AI response: {e}")
        return jsonify({"error": "The AI gave an unexpected response. Please try rephrasing your request."}), 500
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500

# --- Advanced Search Route using car_data.csv ---

@app.route('/search_cars', methods=['GET'])
def search_cars():
    """
    This endpoint searches the car_data.csv file and returns a list of cars that match the criteria.
    """
    try:
        df = pd.read_csv('car_data.csv')
    except FileNotFoundError:
        return jsonify({"error": "car_data.csv not found on the server."}), 500

    # Get query parameters
    min_range = request.args.get('min_range', default=0, type=int)
    max_price = request.args.get('max_price', default=999999, type=int)
    min_safety_rating = request.args.get('min_safety_rating', default=0, type=int)
    min_popularity = request.args.get('min_popularity', default=0.0, type=float)
    max_charge_time = request.args.get('max_charge_time', default=24.0, type=float)


    # Filter the DataFrame
    df = df[df['Range_km'] >= min_range]
    df = df[df['Price_USD'] <= max_price]
    df = df[df['Safety_Rating'] >= min_safety_rating]
    df = df[df['Popularity_Index'] >= min_popularity]
    df = df[df['Charge_Time_hr'] <= max_charge_time]


    # --- FIX for JSON ERROR ---
    # Replace NaN with None (which becomes null in JSON)
    df = df.replace({np.nan: None})
    # --------------------------

    # Convert the filtered DataFrame to a list of dictionaries
    results = df.to_dict(orient='records')
    return jsonify(results)

# --- Caching Header ---
@app.after_request
def add_no_cache_headers(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

# --- Main Execution ---
if __name__ == '__main__':

    app.run(debug=True)
