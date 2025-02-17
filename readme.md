# VisionScribe: Transforming Images into Detailed Narratives

VisionScribe is a web application that leverages advanced AI models to generate detailed captions and narratives from images. Users can upload an image, and the application will provide a caption describing the contents. The generated captions are detailed and contextually enriched using the BLIP (Bootstrapping Language Image Pretraining) model.

## Features

- **Image Upload**: Users can upload PNG, JPG, or GIF images.
- **Automatic Caption Generation**: The application generates a basic caption and then enhances it with a detailed narrative using the BLIP model.
- **Feedback System**: Users can provide feedback by liking or disliking the generated caption and submitting additional comments.
- **User Interface**: A simple and responsive frontend built with Tailwind CSS and Alpine.js.

## Tech Stack

- **Backend**: Python, Flask
- **AI Model**: BLIP (Salesforce/blip-image-captioning-large)
- **Database**: SQLite
- **Frontend**: HTML, Tailwind CSS, Alpine.js
- **Image Processing**: PIL (Python Imaging Library)
- **Deep Learning Framework**: PyTorch

## Requirements

- Python 3.8+
- pip (Python package manager)
- torch
- transformers
- Flask
- Pillow
- SQLite (Pre-installed with Python)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/wprashed/VisionScribe
cd visionscribe
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Set up the database

The app uses SQLite to store user feedback. When the app starts, it will automatically create the `feedback.db` file.

```bash
python app.py
```

### 4. Start the Flask Application

Run the following command to start the Flask server:

```bash
python app.py
```

The server will start, and you can access the web app at `http://127.0.0.1:5000`.

## Usage

### Uploading an Image

- Navigate to the web interface at `http://127.0.0.1:5000`.
- Click on the "Click to upload" area or drag and drop an image.
- The app will process the image and generate a detailed caption.
- You can then provide feedback on the caption by either liking or disliking it and submitting additional comments.

### Viewing and Providing Feedback

After the caption is generated, you will have the option to:

- **Like/Dislike**: Provide feedback on the generated caption.
- **Copy**: Copy the caption to your clipboard.
- **Submit Feedback**: If you liked or disliked the caption, you can provide further comments which will be saved to the database.

## Database

The application uses SQLite to store user feedback, which includes:

- **id**: A unique identifier for each feedback.
- **caption**: The generated caption.
- **liked**: Whether the user liked the caption (1 for liked, 0 for disliked).
- **comment**: The feedback comment from the user.

## API Endpoints

### `POST /`
Uploads an image and returns the generated caption.

**Request Body (Form Data)**:
- `file`: The image file to be uploaded.

**Response**:
```json
{
  "caption": "Generated caption text here"
}
```

### `POST /feedback`
Submits user feedback on the caption.

**Request Body (JSON)**:
```json
{
  "caption": "Generated caption text here",
  "liked": 1,
  "comment": "User's comment here"
}
```

**Response**:
```json
{
  "success": true
}
```

## Contributing

Feel free to fork the project, submit issues, and create pull requests. Contributions are welcome!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- The BLIP model is provided by Salesforce for image captioning and has been integrated into this project.
- Flask is used to build the backend API.
- Tailwind CSS and Alpine.js are used to build the responsive and interactive frontend.