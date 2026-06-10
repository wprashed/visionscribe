import os
import sqlite3
import uuid
import base64
import csv
import io
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory, Response
from PIL import Image
import torch
from transformers import BlipProcessor, BlipForConditionalGeneration, MarianMTModel, MarianTokenizer
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


STYLE_GUIDANCE = {
    "detailed": "Write a vivid, detailed caption with visible objects, setting, lighting, mood, and notable context.",
    "concise": "Write a short, clear caption in one sentence.",
    "alt": "Write accessible alt text that is factual, concise, and useful for a screen reader.",
    "social": "Write a polished social media caption with natural energy, but do not add hashtags unless the image strongly suggests them.",
    "product": "Write a product-style description focused on visible details, materials, qualities, and use cases.",
    "poetic": "Write an expressive, poetic description while staying grounded in what is visible.",
}

DETAIL_LIMITS = {
    "short": 80,
    "balanced": 180,
    "rich": 420,
}

TRANSLATION_MODELS = {
    "Bengali": "Helsinki-NLP/opus-mt-en-bn",
    "Hindi": "Helsinki-NLP/opus-mt-en-hi",
    "Spanish": "Helsinki-NLP/opus-mt-en-es",
    "French": "Helsinki-NLP/opus-mt-en-fr",
    "German": "Helsinki-NLP/opus-mt-en-de",
    "Arabic": "Helsinki-NLP/opus-mt-en-ar",
    "Chinese": "Helsinki-NLP/opus-mt-en-zh",
    "Japanese": "Helsinki-NLP/opus-mt-en-jap",
}

translation_cache = {}


def db_connect():
    conn = sqlite3.connect('visionscribe.db')
    conn.row_factory = sqlite3.Row
    return conn


def translate_text(text, language="English"):
    """Translate text locally with Hugging Face models when a target language is selected."""
    if not text or not language or language == "English":
        return text

    model_name = TRANSLATION_MODELS.get(language)
    if not model_name:
        return text

    try:
        if model_name not in translation_cache:
            tokenizer = MarianTokenizer.from_pretrained(model_name)
            model = MarianMTModel.from_pretrained(model_name)
            translation_cache[model_name] = (tokenizer, model)
        tokenizer, model = translation_cache[model_name]
        inputs = tokenizer([text], return_tensors="pt", truncation=True, max_length=512)
        translated = model.generate(**inputs, max_new_tokens=512)
        return tokenizer.decode(translated[0], skip_special_tokens=True)
    except Exception as e:
        print(f"Translation unavailable for {language}: {str(e)}")
        return text


def translate_items(items, language="English"):
    return [post_process_caption(translate_text(item, language)) for item in items]


def generate_caption_with_openai(image_path, style="detailed", detail_level="rich", audience="general", language="English"):
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
                            "text": (
                                f"{STYLE_GUIDANCE.get(style, STYLE_GUIDANCE['detailed'])} "
                                f"Audience: {audience or 'general'}. Language: {language or 'English'}. "
                                "Avoid inventing details that are not visible."
                            )
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
            "max_tokens": DETAIL_LIMITS.get(detail_level, 420)
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

def split_caption_sentences(caption):
    """Split generated text into readable sentence fragments."""
    normalized = " ".join(post_process_caption(caption).split())
    sentences = []
    start = 0
    for index, char in enumerate(normalized):
        if char in ".!?":
            part = normalized[start:index + 1].strip()
            if part:
                sentences.append(part)
            start = index + 1
    tail = normalized[start:].strip()
    if tail:
        sentences.append(tail if tail.endswith((".", "!", "?")) else f"{tail}.")
    return sentences or [normalized]


def concise_sentence(caption):
    sentence = split_caption_sentences(caption)[0].strip()
    return sentence if sentence.endswith((".", "!", "?")) else f"{sentence}."


def caption_phrases(caption):
    return [
        phrase.strip(" ,.")
        for phrase in post_process_caption(caption).replace(" and ", ", ").split(",")
        if len(phrase.strip(" ,.")) > 3
    ][:6]


def lower_first(text):
    return text[:1].lower() + text[1:] if text else text


def apply_audience_language(variants, audience="general"):
    if audience and audience.lower() not in ("general", ""):
        variants = [f"For {audience}: {variant}" for variant in variants]
    return variants


def adapt_caption_for_style(base_caption, style="detailed", detail_level="rich", audience="general", language="English", variant_index=0):
    """Create distinct variants from one model caption without rerunning the model."""
    caption = post_process_caption(base_caption)
    sentences = split_caption_sentences(caption)
    primary = concise_sentence(caption)
    secondary = " ".join(sentences[:2])
    phrases = caption_phrases(caption)
    visible_details = ", ".join(phrases[:5])
    supporting_details = ", ".join(phrases[1:5])

    if style == "concise":
        variants = [
            primary,
            f"{primary} The frame keeps attention on the main visible subject.",
            f"Quick caption: {lower_first(primary)}",
        ]
    elif style == "alt":
        variants = [
            f"Alt text: {primary}",
            f"Alt text: {secondary}",
            f"Alt text: The image shows {visible_details}." if visible_details else f"Alt text: {caption}",
        ]
    elif style == "social":
        variants = [
            f"A visual story in focus: {primary}",
            f"Captured in frame: {secondary}",
            f"A moment worth noticing, with {', '.join(phrases[:3])}." if phrases else f"A moment worth noticing: {caption}",
        ]
    elif style == "product":
        variants = [
            f"Product overview: {primary}",
            f"Key visible details: {visible_details}." if visible_details else f"Key visible details: {caption}",
            f"Merchandising note: {secondary} The image emphasizes presentation, color, and visible condition.",
        ]
    elif style == "poetic":
        variants = [
            f"A quiet scene unfolds: {primary}",
            f"Light, texture, and form come together as {lower_first(primary)}",
            f"The frame carries a vivid mood through {', '.join(phrases[:3])}." if phrases else f"The frame carries a vivid mood: {caption}",
        ]
    elif detail_level == "short":
        variants = [
            primary,
            f"Short scene note: {primary}",
            f"Compact description: {secondary}",
        ]
    else:
        variants = [
            caption,
            f"Scene summary: {secondary} Notable visible elements include {visible_details}." if visible_details else f"Scene summary: {caption}",
            f"Accessibility-focused description: {primary} The image also includes {supporting_details}." if supporting_details else f"Accessibility-focused description: {caption}",
        ]

    variants = apply_audience_language(variants, audience)
    return variants[variant_index % len(variants)]


def generate_detailed_caption(image_path, style="detailed", detail_level="rich", audience="general", language="English"):
    """Generate a detailed caption for an image using multiple methods."""
    # First try with OpenAI if available (produces better results)
    openai_caption = generate_caption_with_openai(image_path, style, detail_level, audience, "English")
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

    caption_columns = {
        "original_filename": "TEXT",
        "file_size": "INTEGER",
        "image_width": "INTEGER",
        "image_height": "INTEGER",
        "image_format": "TEXT",
        "style": "TEXT",
        "detail_level": "TEXT",
        "audience": "TEXT",
        "language": "TEXT",
        "variants": "TEXT"
    }
    existing_caption_columns = {row[1] for row in c.execute("PRAGMA table_info(captions)")}
    for column, column_type in caption_columns.items():
        if column not in existing_caption_columns:
            c.execute(f"ALTER TABLE captions ADD COLUMN {column} {column_type}")
    
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


def save_uploaded_image(file, folder="uploads"):
    filename = f"{uuid.uuid4()}-{file.filename}"
    file_path = os.path.join(folder, filename)
    file.save(file_path)

    with Image.open(file_path) as image:
        width, height = image.size
        image_format = image.format or ""

    return {
        "path": file_path,
        "original_filename": file.filename,
        "file_size": os.path.getsize(file_path),
        "width": width,
        "height": height,
        "format": image_format,
    }


def remove_local_file(path):
    if not path:
        return
    normalized = os.path.normpath(path)
    allowed_roots = {os.path.normpath('uploads'), os.path.normpath('training_data')}
    if normalized.split(os.sep)[0] not in allowed_roots:
        return
    if os.path.exists(normalized):
        os.remove(normalized)


def serialize_caption(row):
    return {
        "id": row["id"],
        "image_path": row["image_path"],
        "image_url": f"/{row['image_path']}" if row["image_path"] else "",
        "caption": row["caption"],
        "created_at": row["created_at"],
        "original_filename": row["original_filename"],
        "file_size": row["file_size"],
        "image_width": row["image_width"],
        "image_height": row["image_height"],
        "image_format": row["image_format"],
        "style": row["style"],
        "detail_level": row["detail_level"],
        "audience": row["audience"],
        "language": row["language"],
        "variants": json.loads(row["variants"] or "[]"),
    }


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
        style = request.form.get('style', 'detailed')
        detail_level = request.form.get('detail_level', 'rich')
        audience = request.form.get('audience', 'general')
        language = request.form.get('language', 'English')
        variant_count = max(1, min(int(request.form.get('variants', 3)), 3))
        upload = save_uploaded_image(file)
        file_path = upload["path"]
        
        try:
            base_caption = generate_detailed_caption(file_path, style, detail_level, audience, language)
            variants = [
                adapt_caption_for_style(base_caption, style, detail_level, audience, language, index)
                for index in range(variant_count)
            ]
            variants = translate_items(variants, language)
            caption = post_process_caption(variants[0])
            
            # Store in database
            conn = sqlite3.connect('visionscribe.db')
            c = conn.cursor()
            c.execute(
                """INSERT INTO captions
                   (image_path, caption, created_at, original_filename, file_size, image_width, image_height,
                    image_format, style, detail_level, audience, language, variants)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    file_path, caption, datetime.now(), upload["original_filename"], upload["file_size"],
                    upload["width"], upload["height"], upload["format"], style, detail_level, audience,
                    language, json.dumps(variants)
                )
            )
            caption_id = c.lastrowid
            conn.commit()
            conn.close()
            
            return jsonify({
                'id': caption_id,
                'caption': caption,
                'variants': variants,
                'metadata': upload,
            })
        except Exception as e:
            # Clean up the file if there's an error
            if os.path.exists(file_path):
                os.remove(file_path)
            return jsonify({'error': str(e)})


@app.route('/api/batch-generate', methods=['POST'])
def batch_generate():
    files = request.files.getlist('files')
    if not files:
        return jsonify({'error': 'No files uploaded'}), 400

    style = request.form.get('style', 'detailed')
    detail_level = request.form.get('detail_level', 'balanced')
    audience = request.form.get('audience', 'general')
    language = request.form.get('language', 'English')
    results = []

    for file in files[:8]:
        if not file.filename:
            continue

        upload = save_uploaded_image(file)
        base_caption = generate_detailed_caption(upload["path"], style, detail_level, audience, language)
        caption = translate_text(
            adapt_caption_for_style(base_caption, style, detail_level, audience, language, 0),
            language
        )
        caption = post_process_caption(caption)

        conn = sqlite3.connect('visionscribe.db')
        c = conn.cursor()
        c.execute(
            """INSERT INTO captions
               (image_path, caption, created_at, original_filename, file_size, image_width, image_height,
                image_format, style, detail_level, audience, language, variants)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                upload["path"], caption, datetime.now(), upload["original_filename"], upload["file_size"],
                upload["width"], upload["height"], upload["format"], style, detail_level, audience,
                language, json.dumps([caption])
            )
        )
        caption_id = c.lastrowid
        conn.commit()
        conn.close()
        results.append({"id": caption_id, "caption": caption, "metadata": upload})

    return jsonify({"results": results})


@app.route('/api/captions/<int:caption_id>', methods=['PUT'])
def update_caption(caption_id):
    data = request.json or {}
    caption = post_process_caption(data.get('caption', ''))
    if not caption:
        return jsonify({'error': 'Caption is required'}), 400

    conn = sqlite3.connect('visionscribe.db')
    c = conn.cursor()
    c.execute("UPDATE captions SET caption = ? WHERE id = ?", (caption, caption_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'caption': caption})


@app.route('/api/captions/<int:caption_id>', methods=['DELETE'])
def delete_caption(caption_id):
    conn = db_connect()
    row = conn.execute("SELECT image_path FROM captions WHERE id = ?", (caption_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Caption not found'}), 404

    conn.execute("DELETE FROM captions WHERE id = ?", (caption_id,))
    conn.commit()
    conn.close()
    remove_local_file(row["image_path"])
    return jsonify({'success': True})


@app.route('/api/history')
def history():
    query = request.args.get('query', '').strip()
    style = request.args.get('style', '').strip()
    conn = db_connect()
    sql = "SELECT * FROM captions WHERE 1=1"
    params = []
    if query:
        sql += " AND (caption LIKE ? OR original_filename LIKE ?)"
        params.extend([f"%{query}%", f"%{query}%"])
    if style:
        sql += " AND style = ?"
        params.append(style)
    sql += " ORDER BY created_at DESC LIMIT 80"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return jsonify({"items": [serialize_caption(row) for row in rows]})


@app.route('/api/history', methods=['DELETE'])
def clear_history():
    conn = db_connect()
    rows = conn.execute("SELECT image_path FROM captions").fetchall()
    conn.execute("DELETE FROM captions")
    conn.commit()
    conn.close()

    for row in rows:
        remove_local_file(row["image_path"])

    return jsonify({'success': True, 'deleted': len(rows)})


@app.route('/api/dashboard')
def dashboard():
    conn = db_connect()
    stats = {
        "captions": conn.execute("SELECT COUNT(*) AS value FROM captions").fetchone()["value"],
        "liked": conn.execute("SELECT COUNT(*) AS value FROM feedback WHERE liked = 1").fetchone()["value"],
        "disliked": conn.execute("SELECT COUNT(*) AS value FROM feedback WHERE liked = 0").fetchone()["value"],
        "training": conn.execute("SELECT COUNT(*) AS value FROM training_data").fetchone()["value"],
    }
    recent_feedback = [
        dict(row) for row in conn.execute(
            "SELECT caption, liked, comment, created_at FROM feedback ORDER BY created_at DESC LIMIT 8"
        ).fetchall()
    ]
    conn.close()
    return jsonify({"stats": stats, "feedback": recent_feedback})


@app.route('/api/export')
def export_captions():
    export_format = request.args.get('format', 'csv')
    conn = db_connect()
    rows = [serialize_caption(row) for row in conn.execute("SELECT * FROM captions ORDER BY created_at DESC").fetchall()]
    conn.close()

    if export_format == "json":
        return Response(json.dumps(rows, indent=2), mimetype="application/json")

    if export_format == "txt":
        body = "\n\n".join(f"{item['original_filename'] or item['image_path']}\n{item['caption']}" for item in rows)
        return Response(body, mimetype="text/plain")

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "id", "original_filename", "caption", "style", "detail_level", "audience", "language",
        "image_width", "image_height", "image_format", "file_size", "created_at"
    ])
    writer.writeheader()
    for item in rows:
        writer.writerow({key: item.get(key) for key in writer.fieldnames})
    return Response(output.getvalue(), mimetype="text/csv")


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
        upload = save_uploaded_image(file, 'training_data')
        file_path = upload["path"]
        
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


@app.route('/uploads/<path:path>')
def serve_upload(path):
    return send_from_directory('uploads', path)


if __name__ == '__main__':
    init_db()
    app.run(debug=True)
