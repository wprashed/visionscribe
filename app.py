import os
import sqlite3
import uuid
import base64
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory
from PIL import Image
import torch
from transformers import BlipProcessor, BlipForConditionalGeneration
import requests
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Create necessary directories
os.makedirs('uploads', exist_ok=True)
os.makedirs('training_data', exist_ok=True)
os.makedirs('static', exist_ok=True)

# Load BLIP model and processor
processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-large")
model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-large")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)


def generate_caption_with_openai(image_path):
    """Generate a detailed caption using OpenAI's vision model as a fallback."""
    # Check if OpenAI API key is available
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None  # No API key available, can't use this method
    
    try:
        # Convert image to base64
        with open(image_path, "rb") as image_file:
            import base64
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        payload = {
            "model": "gpt-4-vision-preview",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Generate a very detailed caption for this image. Describe all visible elements, colors, objects, people, scenery, mood, lighting, and any notable features. Make the description comprehensive and vivid."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 500
        }
        
        response = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        response_data = response.json()
        
        if "choices" in response_data and len(response_data["choices"]) > 0:
            return response_data["choices"][0]["message"]["content"]
        else:
            return None
    except Exception as e:
        print(f"Error using OpenAI for caption: {str(e)}")
        return None

# Update the generate_detailed_caption function to try both methods
def generate_detailed_caption(image_path):
    """Generate a detailed caption for an image using multiple methods."""
    # First try with OpenAI if available (produces better results)
    openai_caption = generate_caption_with_openai(image_path)
    if openai_caption:
        return openai_caption
    
    # Fall back to BLIP model
    try:
        image = Image.open(image_path).convert('RGB')

        # First pass: Generate a basic caption
        inputs = processor(image, return_tensors="pt").to(device)
        basic_caption = model.generate(**inputs, max_new_tokens=50)[0]
        basic_caption = processor.decode(basic_caption, skip_special_tokens=True)

        # Second pass: Use the basic caption as a prompt for a more detailed description
        detailed_prompt = f"{basic_caption}"
        inputs = processor(image, text=detailed_prompt, return_tensors="pt").to(device)
        
        # Generate a more detailed caption with better parameters
        detailed_caption = model.generate(
            **inputs,
            max_new_tokens=500,  # Allow for longer captions
            num_beams=5,         # Beam search for better quality
            min_length=100,      # Ensure a minimum length for detail
            no_repeat_ngram_size=3,  # Avoid repetition
            temperature=0.8,     # Slightly higher temperature for more creative descriptions
            top_p=0.9,           # Nucleus sampling for better diversity
        )[0]
        
        detailed_caption = processor.decode(detailed_caption, skip_special_tokens=True)
        
        # Clean up any potential artifacts (like "arafed")
        detailed_caption = detailed_caption.replace("arafed", "").strip()
        
        # If the caption is too short, try a third pass with a different approach
        if len(detailed_caption.split()) < 50:
            elements_prompt = "Describe this image in detail, including: objects, people, colors, background, foreground, lighting, mood, and any notable elements."
            inputs = processor(image, text=elements_prompt, return_tensors="pt").to(device)
            
            enhanced_caption = model.generate(
                **inputs,
                max_new_tokens=500,
                num_beams=5,
                temperature=0.7,
            )[0]
            
            enhanced_caption = processor.decode(enhanced_caption, skip_special_tokens=True)
            enhanced_caption = enhanced_caption.replace("arafed", "").strip()
            
            # Use the longer of the two captions
            if len(enhanced_caption.split()) > len(detailed_caption.split()):
                detailed_caption = enhanced_caption

        return detailed_caption
    except Exception as e:
        print(f"Error using BLIP for caption: {str(e)}")
        return "Failed to generate caption. Please try again with a different image."


def init_db():
    """Initialize the SQLite database with necessary tables."""
    conn = sqlite3.connect('visionscribe.db')
    c = conn.cursor()
    
    # Table for storing generated captions
    c.execute('''CREATE TABLE IF NOT EXISTS captions
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  image_path TEXT,
                  caption TEXT,
                  created_at TIMESTAMP)''')
    
    # Table for storing user feedback
    c.execute('''CREATE TABLE IF NOT EXISTS feedback
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  caption TEXT,
                  liked INTEGER,
                  comment TEXT,
                  created_at TIMESTAMP)''')
    
    # Table for storing training data
    c.execute('''CREATE TABLE IF NOT EXISTS training_data
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  image_path TEXT,
                  caption TEXT,
                  created_at TIMESTAMP)''')
    
    conn.commit()
    conn.close()


def post_process_caption(caption):
    """Clean up and enhance the generated caption."""
    # Remove any known artifacts
    caption = caption.replace("arafed", "").strip()
    
    # Fix common issues
    caption = caption.replace("  ", " ")  # Remove double spaces
    
    # Ensure the caption starts with a capital letter
    if caption and len(caption) > 0:
        caption = caption[0].upper() + caption[1:]
    
    return caption


@app.route('/')
def index():
    """Render the main application page."""
    return render_template('index.html')


@app.route('/api/generate-caption', methods=['POST'])
def generate_caption():
    """API endpoint to generate a caption for an uploaded image."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'})
    
    if file:
        # Save the uploaded file with a unique filename
        filename = f"{uuid.uuid4()}-{file.filename}"
        file_path = os.path.join('uploads', filename)
        file.save(file_path)
        
        try:
            # Generate caption for the image
            caption = generate_detailed_caption(file_path)
            
            # Post-process the caption to clean up any issues
            caption = post_process_caption(caption)
            
            # Store in database
            conn = sqlite3.connect('visionscribe.db')
            c = conn.cursor()
            c.execute("INSERT INTO captions (image_path, caption, created_at) VALUES (?, ?, ?)",
                      (file_path, caption, datetime.now()))
            conn.commit()
            conn.close()
            
            return jsonify({'caption': caption})
        except Exception as e:
            # Clean up the file if there's an error
            if os.path.exists(file_path):
                os.remove(file_path)
            return jsonify({'error': str(e)})


@app.route('/api/feedback', methods=['POST'])
def save_feedback():
    """API endpoint to save user feedback on generated captions."""
    data = request.json
    
    if not data or 'caption' not in data or 'liked' not in data:
        return jsonify({'error': 'Missing required fields'})
    
    conn = sqlite3.connect('visionscribe.db')
    c = conn.cursor()
    c.execute("INSERT INTO feedback (caption, liked, comment, created_at) VALUES (?, ?, ?, ?)",
              (data['caption'], data['liked'], data.get('comment', ''), datetime.now()))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})


@app.route('/api/train', methods=['POST'])
def train_model():
    """API endpoint to save training data (image + caption pairs)."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'})
    
    file = request.files['file']
    caption = request.form.get('caption', '')
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'})
    
    if not caption:
        return jsonify({'error': 'No caption provided'})
    
    if file:
        # Save the uploaded file with a unique filename
        filename = f"{uuid.uuid4()}-{file.filename}"
        file_path = os.path.join('training_data', filename)
        file.save(file_path)
        
        try:
            # Store in database
            conn = sqlite3.connect('visionscribe.db')
            c = conn.cursor()
            c.execute("INSERT INTO training_data (image_path, caption, created_at) VALUES (?, ?, ?)",
                      (file_path, caption, datetime.now()))
            conn.commit()
            conn.close()
            
            return jsonify({'success': True})
        except Exception as e:
            # Clean up the file if there's an error
            if os.path.exists(file_path):
                os.remove(file_path)
            return jsonify({'error': str(e)})


@app.route('/static/<path:path>')
def serve_static(path):
    """Serve static files."""
    return send_from_directory('static', path)


if __name__ == '__main__':
    init_db()
    app.run(debug=True)