import os
import sqlite3
from flask import Flask, render_template, request, jsonify
from PIL import Image
import torch
from transformers import BlipProcessor, BlipForConditionalGeneration

app = Flask(__name__)

# Load BLIP model and processor
processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-large")
model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-large")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)


def generate_detailed_caption(image_path):
    image = Image.open(image_path).convert('RGB')

    # Generate a basic caption
    inputs = processor(image, return_tensors="pt").to(device)
    basic_caption = model.generate(**inputs, max_new_tokens=50)[0]
    basic_caption = processor.decode(basic_caption, skip_special_tokens=True)

    # Use the basic caption to generate a more detailed description
    prompt = f"{basic_caption}"
    inputs = processor(image, text=prompt, return_tensors="pt").to(device)
    detailed_caption = model.generate(**inputs, max_new_tokens=300, num_beams=5, temperature=0.7)[0]
    detailed_caption = processor.decode(detailed_caption, skip_special_tokens=True)

    return detailed_caption


def init_db():
    conn = sqlite3.connect('feedback.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS feedback
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  caption TEXT,
                  liked INTEGER,
                  comment TEXT)''')
    conn.commit()
    conn.close()


@app.route('/', methods=['GET', 'POST'])
def upload_file():
    if request.method == 'POST':
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'})
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'})
        if file:
            filename = file.filename
            file_path = os.path.join('uploads', filename)
            file.save(file_path)
            try:
                caption = generate_detailed_caption(file_path)
                os.remove(file_path)  # Remove the uploaded file after processing
                return jsonify({'caption': caption})
            except Exception as e:
                os.remove(file_path)  # Remove the uploaded file if there's an error
                return jsonify({'error': str(e)})
    return render_template('index.html')


@app.route('/feedback', methods=['POST'])
def save_feedback():
    data = request.json
    conn = sqlite3.connect('feedback.db')
    c = conn.cursor()
    c.execute("INSERT INTO feedback (caption, liked, comment) VALUES (?, ?, ?)",
              (data['caption'], data['liked'], data['comment']))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


if __name__ == '__main__':
    os.makedirs('uploads', exist_ok=True)
    init_db()
    app.run(debug=True)