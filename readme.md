# VisionScribe

VisionScribe is a Flask web application for generating, refining, exporting, and improving image captions. It uses the BLIP image captioning model by default, with an optional OpenAI vision fallback when `OPENAI_API_KEY` is configured.

## Features

- Upload PNG, JPG, GIF, and other browser-supported image files.
- Generate captions with style modes: detailed, concise, alt text, social, product, and poetic.
- Control detail level, audience, language, and number of caption variants.
- Generate English captions or translate captions locally into Bengali, Hindi, Spanish, French, German, Arabic, Chinese, or Japanese.
- Compare distinct caption variants and choose one for editing.
- Edit generated captions and save the revised version.
- View image metadata such as filename, size, dimensions, and format.
- Submit like/dislike feedback with optional notes.
- Batch-generate captions for multiple images with dedicated batch style, detail, audience, and language controls.
- Browse caption history with search and style filters.
- Delete individual history items or clear the full caption history.
- Export saved captions as CSV, JSON, or TXT.
- Review caption, feedback, and training-data counts in the dashboard.
- Save training image-caption pairs locally.

## Tech Stack

- Backend: Python, Flask
- Model: `Salesforce/blip-image-captioning-large`
- Deep learning: PyTorch, Transformers
- Image processing: Pillow
- Database: SQLite
- Frontend: HTML, CSS, vanilla JavaScript

## Requirements

- Python 3.8+
- pip
- Internet access on first run to download model weights, unless already cached
- Internet access on first use of a non-English language to download the local translation model

Python packages are listed in `requirements.txt`.

## Installation

Clone the project and create a local virtual environment:

```bash
git clone https://github.com/wprashed/visionscribe
cd visionscribe
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

If you already have the repository locally, run from the project directory:

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

## Running The App

Start the Flask server:

```bash
source .venv/bin/activate
python app.py
```

Open the app at:

```text
http://127.0.0.1:5000
```

The first startup can take time because the BLIP model may need to download and initialize.

## Optional OpenAI Fallback

To enable the OpenAI vision fallback, create a `.env` file:

```bash
OPENAI_API_KEY=your_api_key_here
```

Without this key, VisionScribe uses the local BLIP pipeline.

## Usage

1. Open the Generate tab.
2. Upload or drag in an image.
3. Choose a caption style and prompt controls.
4. Generate captions and compare the variants.
5. Select a variant, edit the caption, then save it if needed.
6. Copy the caption or submit feedback.
7. Use Batch for multiple images with its own caption controls, History for saved captions, Dashboard for stats, and Train for local training pairs.

## Language Support

VisionScribe does not require API keys for language support. English captions are generated locally with BLIP. Non-English outputs use local Hugging Face translation models that are downloaded on first use and cached afterward.

Supported language options:

- English
- Bengali
- Hindi
- Spanish
- French
- German
- Arabic
- Chinese
- Japanese

If a translation model is unavailable, the app falls back to the generated English caption instead of failing the request.

## API Endpoints

### `POST /api/generate-caption`

Generates caption variants for one uploaded image.

Form fields:

- `file`: image file
- `style`: `detailed`, `concise`, `alt`, `social`, `product`, or `poetic`
- `detail_level`: `short`, `balanced`, or `rich`
- `audience`: target audience text
- `language`: output language preference
- `variants`: `1`, `2`, or `3`

### `POST /api/batch-generate`

Generates captions for up to 8 uploaded images.

Form fields:

- `files`: one or more image files
- `style`
- `detail_level`
- `audience`
- `language`

### `PUT /api/captions/<caption_id>`

Updates a saved caption.

JSON body:

```json
{
  "caption": "Updated caption text"
}
```

### `DELETE /api/captions/<caption_id>`

Deletes a specific saved caption and removes its uploaded image file.

### `GET /api/history`

Returns saved captions.

Query parameters:

- `query`: optional search text
- `style`: optional style filter

### `DELETE /api/history`

Deletes all saved caption history and removes uploaded caption images.

### `GET /api/dashboard`

Returns caption, feedback, and training-data summary statistics.

### `GET /api/export?format=csv`

Exports saved captions.

Supported formats:

- `csv`
- `json`
- `txt`

### `POST /api/feedback`

Saves feedback for a caption.

JSON body:

```json
{
  "caption": "Generated or edited caption",
  "liked": true,
  "comment": "Optional feedback note"
}
```

### `POST /api/train`

Stores a training image-caption pair.

Form fields:

- `file`: image file
- `caption`: accurate caption text

## Local Data

VisionScribe stores local data in:

- `visionscribe.db`: SQLite database
- `uploads/`: generated-caption image uploads
- `training_data/`: training image-caption uploads

These files are local application data and can grow over time.

## Notes

- Use `.venv/bin/python app.py` or activate `.venv` before running the app.
- If you see `ModuleNotFoundError`, you are probably using the system Python instead of the virtual environment.
- The generated variants are derived from the base model caption and formatted into distinct caption perspectives.

## Acknowledgments

- BLIP image captioning model by Salesforce.
- Flask for the backend application.
- PyTorch and Transformers for model inference.
