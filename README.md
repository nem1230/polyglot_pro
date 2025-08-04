# Polyglot Pro

An AI-powered language learning application that uses computer vision and natural language processing to create immersive learning experiences from images and text descriptions.

## 🌟 Features

- **Visual Analysis**: AI-powered image recognition for vocabulary extraction
- **Scene Description**: Natural language processing for text-based learning
- **Interactive Games**: Word matching and sentence translation challenges
- **Multi-language Support**: 10 languages including Spanish, French, German, Italian, Portuguese, Chinese, Japanese, Korean, and Arabic
- **Story Generation**: AI-created narratives based on visual content
- **Conversation Practice**: Contextual dialogue scenarios
- **Dark/Light Themes**: Customizable interface themes

## 📋 Prerequisites

- **Node.js** (version 16 or higher)
- **npm** (comes with Node.js)
- **Ollama** (AI model runtime)

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd language-learning-app
```

### 2. Install Node.js Dependencies

```bash
npm install
```

This will install all required packages including:
- Electron
- All development dependencies

### 3. Install Ollama

1. Download Ollama from [https://ollama.com/download](https://ollama.com/download)
2. Run the installer and follow the setup wizard
3. Ollama will be available in your system PATH

### 4. Start Ollama Service

Open a terminal and start the Ollama service:

```bash
ollama serve
```

Keep this terminal window open - Ollama needs to run in the background.

### 5. Download AI Models

Open a **new terminal window** and download the recommended models:

#### For Object Detection (Image Analysis)
Choose any Ollama model found on Ollama.com that allows "image" as input. For example:
```bash
ollama pull aliafshar/gemma3-it-qat-tools:4b
```

#### For Text Generation (Stories, Conversations, Vocabulary)
Choose any Ollama model found on Ollama.com that allows "text" as input. For example:
```bash
ollama pull gemma3n:e2b
```

**Note**: Model downloads can take several minutes depending on your internet connection. The models are several GB in size.

## 🎮 Running the Application

### 1. Start Ollama (if not already running)
```bash
ollama serve
```

### 2. Launch the Application
In a new terminal window, navigate to the project directory and run:

```bash
npm start
```

For development mode with debugging tools:
```bash
npm run dev
```

## ⚙️ Configuration

### First-Time Setup

1. **Launch the application** using `npm start`
2. **Click the settings icon** (⚙️) in the top-right corner
3. **Verify the AI Engine Endpoint** is set to `http://localhost:11434`
4. **Select models** from the dropdowns:
   - Object Detection Model: `aliafshar/gemma3-it-qat-tools:4b`
   - Text Generation Model: `gemma3n:e2b`
5. **Click "Apply Changes"** to save your settings

### Model Verification

To verify your models are installed correctly:

```bash
ollama list
```

You should see both models listed:
- `aliafshar/gemma3-it-qat-tools:4b`
- `gemma3n:e2b`

## 📖 Usage

### Visual Analysis Mode
1. Select "Visual Analysis" mode
2. Upload an image by clicking "Browse Files" or drag-and-drop
3. Choose your source and target languages
4. Click analyze to generate vocabulary, stories, and conversations

### Scene Description Mode
1. Select "Scene Description" mode
2. Enter a detailed description of a scene (up to 500 characters)
3. Choose your languages
4. Process the description for AI analysis

### Interactive Games
- **Word Matching**: Match words between languages
- **Sentence Translation**: Translate sentences and get feedback

## 🛠️ Troubleshooting

### "No AI Models Found" Error
- Ensure Ollama is running (`ollama serve`)
- Verify models are downloaded (`ollama list`)
- Check that the Ollama endpoint is correct in settings

### Connection Issues
- Confirm Ollama is running on `http://localhost:11434`
- Try restarting the Ollama service

### Model Download Issues
- Ensure stable internet connection
- Models are large (several GB) - downloads may take time
- Try downloading models one at a time

### Performance Issues
- Close other applications to free up RAM
- Consider using smaller models if available

## 📁 Project Structure

```
language-learning-app/
├── main.js              # Electron main process
├── preload.js           # Electron preload script
├── renderer.js          # Frontend JavaScript
├── index.html           # Main HTML file
├── styles.css           # Application styles
├── package.json         # Node.js dependencies
├── simple_sentences.json # Sample sentences data
└── src/
    ├── App.tsx          # React components (if using)
    ├── main.tsx         # React entry point
    └── schemas.js       # AI response schemas
```

## 🔧 Development

### Building for Production
```bash
npm run build
```

### Packaging the Application
```bash
npm run pack
```

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify all prerequisites are installed
3. Ensure Ollama service is running
4. Check that required models are downloaded

---

**Happy Learning! 🎓**