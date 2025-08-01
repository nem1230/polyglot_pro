import { 
  ObjectDetectionOutput, 
  VocabularyOutput, 
  StoryOutput, 
  ConversationOutput 
} from './src/schemas.js';

class LanguageLearningRenderer {
  constructor() {
    this.currentImage = null;
    this.currentDescription = null;
    this.inputMode = 'image'; // 'image' or 'text'
    this.currentLanguage = 'english';
    this.sourceLanguage = 'english';
    this.settings = {
      language: 'english',
      sourceLanguage: 'english',
      theme: 'dark',
      ollamaUrl: 'http://localhost:11434'
    };
    this.analysisResults = null;
    this.isAnalyzing = false;
    this.wordDictionary = [];
    this.currentGameWords = [];
    this.selectedSourceWord = null;
    this.gameScore = 0;
    this.currentSubset = 1;
    this.maxSubsets = 5;
    
    // Sentence game properties
    this.sentenceDictionary = [];
    this.currentGameSentences = [];
    this.currentSentenceIndex = 0;
    this.gameMode = 'word'; // 'word' or 'sentence'
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.setupDragAndDrop();
    await this.loadWordDictionary();
    await this.loadSentenceDictionary();
    await this.checkOllamaConnection();
  }

  async loadSettings() {
    try {
      const result = await window.electronAPI.loadSettings();
      if (result.success) {
        this.settings = { ...this.settings, ...result.data };
        this.applySettings();
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async saveSettings() {
    try {
      await window.electronAPI.saveSettings(this.settings);
      this.showToast('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showToast('Failed to save settings', 'error');
    }
  }

  applySettings() {
    // Apply theme
    document.body.className = `${this.settings.theme}-theme`;
    
    // Apply language
    this.currentLanguage = this.settings.language;
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
      languageSelect.value = this.settings.language;
    }
    
    // Update theme toggle icon
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
      themeIcon.textContent = this.settings.theme === 'dark' ? '☀️' : '🌙';
    }
    
    // Update Ollama URL in modal
    const ollamaUrlInput = document.getElementById('ollamaUrl');
    if (ollamaUrlInput) {
      ollamaUrlInput.value = this.settings.ollamaUrl;
    }
  }

  setupEventListeners() {
    // Upload button
    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn?.addEventListener('click', (e) => {
      e.target.classList.add('loading-state');
      setTimeout(() => e.target.classList.remove('loading-state'), 300);
      this.selectImage();
    });

    // Upload area click
    const uploadArea = document.getElementById('uploadArea');
    uploadArea?.addEventListener('click', (e) => {
      e.currentTarget.style.transform = 'scale(0.98)';
      setTimeout(() => e.currentTarget.style.transform = '', 150);
      this.selectImage();
    });

    // Mode selection buttons
    const imageModeBtn = document.getElementById('imageModeBtn');
    const textModeBtn = document.getElementById('textModeBtn');
    const jsonModeBtn = document.getElementById('jsonModeBtn');
    
    imageModeBtn?.addEventListener('click', () => this.switchInputMode('image'));
    textModeBtn?.addEventListener('click', () => this.switchInputMode('text'));
    jsonModeBtn?.addEventListener('click', () => this.switchInputMode('json'));

    // Text input handling
    const descriptionInput = document.getElementById('descriptionInput');
    const analyzeTextBtn = document.getElementById('analyzeTextBtn');
    const charCount = document.getElementById('charCount');
    
    descriptionInput?.addEventListener('input', (e) => {
      const length = e.target.value.length;
      charCount.textContent = length;
      
      // Update character counter styling
      const counter = document.querySelector('.character-counter');
      counter.classList.remove('warning', 'error');
      if (length > 400) {
        counter.classList.add('warning');
      }
      if (length > 480) {
        counter.classList.add('error');
      }
      
      // Enable/disable analyze button
      analyzeTextBtn.disabled = length < 10 || length > 500;
    });
    
    analyzeTextBtn?.addEventListener('click', () => this.analyzeDescription());

    // JSON import handling
    const importJsonBtn = document.getElementById('importJsonBtn');
    importJsonBtn?.addEventListener('click', (e) => {
      this.addButtonClickEffect(e.target);
      this.importAnalysisFromMode();
    });

    // Language selector
    const languageSelect = document.getElementById('languageSelect');
    languageSelect?.addEventListener('change', (e) => {
      e.target.style.transform = 'scale(1.02)';
      setTimeout(() => e.target.style.transform = '', 200);
      this.settings.language = e.target.value;
      this.currentLanguage = e.target.value;
      this.saveSettings();
    });

    // Source language selector
    const sourceLanguageSelect = document.getElementById('sourceLanguageSelect');
    sourceLanguageSelect?.addEventListener('change', (e) => {
      e.target.style.transform = 'scale(1.02)';
      setTimeout(() => e.target.style.transform = '', 200);
      this.settings.sourceLanguage = e.target.value;
      this.sourceLanguage = e.target.value;
      this.saveSettings();
    });

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    themeToggle?.addEventListener('click', (e) => {
      e.target.style.transform = 'rotate(180deg) scale(1.1)';
      setTimeout(() => e.target.style.transform = '', 300);
      this.settings.theme = this.settings.theme === 'dark' ? 'light' : 'dark';
      this.applySettings();
      this.saveSettings();
    });

    // Settings modal
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');

    settingsBtn?.addEventListener('click', () => {
      settingsModal.style.display = 'flex';
      settingsModal.style.animation = 'fadeIn 0.3s ease';
      this.applySettings(); // Refresh modal content
    });

    closeSettingsBtn?.addEventListener('click', () => {
      settingsModal.style.display = 'none';
    });

    cancelSettingsBtn?.addEventListener('click', () => {
      settingsModal.style.display = 'none';
    });

    saveSettingsBtn?.addEventListener('click', async () => {
      const ollamaUrl = document.getElementById('ollamaUrl').value;
      this.settings.ollamaUrl = ollamaUrl;
      await this.saveSettings();
      settingsModal.style.display = 'none';
      await this.checkOllamaConnection();
    });

    // Test connection button
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    testConnectionBtn?.addEventListener('click', () => this.checkOllamaConnection());

    // Action buttons
    const newSceneBtn = document.getElementById('newSceneBtn');
    const saveBtn = document.getElementById('saveBtn');
    const analyzeAgainBtn = document.getElementById('analyzeAgainBtn');

    newSceneBtn?.addEventListener('click', (e) => {
      this.addButtonClickEffect(e.target);
      this.resetToUpload();
    });
    saveBtn?.addEventListener('click', (e) => {
      this.addButtonClickEffect(e.target);
      this.saveResults();
    });
    analyzeAgainBtn?.addEventListener('click', (e) => {
      this.addButtonClickEffect(e.target);
      this.analyzeImage();
    });

    // Word game event listeners
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('word-item')) {
        this.handleWordClick(e.target);
      }
    });

    const nextSubsetBtn = document.getElementById('nextSubsetBtn');
    const resetGameBtn = document.getElementById('resetGameBtn');
    
    nextSubsetBtn?.addEventListener('click', () => {
      this.nextWordSubset();
    });
    
    resetGameBtn?.addEventListener('click', () => {
      this.resetWordGame();
    });
    
    // Game mode selection
    const wordGameModeBtn = document.getElementById('wordGameModeBtn');
    const sentenceGameModeBtn = document.getElementById('sentenceGameModeBtn');
    
    wordGameModeBtn?.addEventListener('click', () => {
      this.switchGameMode('word');
    });
    
    sentenceGameModeBtn?.addEventListener('click', () => {
      this.switchGameMode('sentence');
    });
    
    // Sentence game event listeners
    const checkSentenceBtn = document.getElementById('checkSentenceBtn');
    const nextSentenceBtn = document.getElementById('nextSentenceBtn');
    const resetSentenceBtn = document.getElementById('resetSentenceBtn');
    
    checkSentenceBtn?.addEventListener('click', () => {
      this.checkSentenceTranslation();
    });
    
    nextSentenceBtn?.addEventListener('click', () => {
      this.nextSentence();
    });
    
    resetSentenceBtn?.addEventListener('click', () => {
      this.resetSentenceGame();
    });


    // Panel toggles
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('panel-toggle')) {
        const panel = e.target.dataset.panel;
        e.target.style.transform = 'rotate(180deg) scale(1.2)';
        setTimeout(() => e.target.style.transform = '', 300);
        this.togglePanel(panel);
      }
      
      // Individual translation toggles
      if (e.target.classList.contains('vocab-toggle')) {
        this.toggleVocabTranslation(e.target);
      }
      if (e.target.classList.contains('dialogue-toggle')) {
        this.toggleDialogueTranslation(e.target);
      }
      if (e.target.classList.contains('story-toggle')) {
        this.toggleStoryTranslation(e.target);
      }
    });

    // Close modal on overlay click
    settingsModal?.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        settingsModal.style.display = 'none';
      }
    });
  }

  addButtonClickEffect(button) {
    button.style.transform = 'scale(0.95)';
    button.classList.add('loading-state');
    setTimeout(() => {
      button.style.transform = '';
      button.classList.remove('loading-state');
    }, 200);
  }

  setupDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    
    if (!uploadArea) return;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, this.preventDefaults, false);
      document.body.addEventListener(eventName, this.preventDefaults, false);
    });

    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => uploadArea.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('drag-over'), false);
    });

    // Handle dropped files
    uploadArea.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleImageFile(files[0]);
      }
    }, false);
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  async selectImage() {
    try {
      const result = await window.electronAPI.selectImage();
      if (result.success) {
        await this.processImage(result.data);
      } else {
        this.showToast(result.error || 'Failed to select image', 'error');
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      this.showToast('Failed to select image', 'error');
    }
  }

  handleImageFile(file) {
    if (!this.isValidImageFile(file)) {
      this.showToast('Please select a valid image file (JPG, PNG, WebP, GIF)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = {
        name: file.name,
        size: file.size,
        base64: e.target.result.split(',')[1],
        mimeType: file.type
      };
      this.processImage(imageData);
    };
    reader.readAsDataURL(file);
  }

  isValidImageFile(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    return validTypes.includes(file.type);
  }

  switchInputMode(mode) {
    this.inputMode = mode;
    
    // Update button states
    document.getElementById('imageModeBtn').classList.toggle('active', mode === 'image');
    document.getElementById('textModeBtn').classList.toggle('active', mode === 'text');
    document.getElementById('jsonModeBtn').classList.toggle('active', mode === 'json');
    
    // Show/hide appropriate input areas
    document.getElementById('uploadArea').style.display = mode === 'image' ? 'block' : 'none';
    document.getElementById('textInputArea').style.display = mode === 'text' ? 'block' : 'none';
    document.getElementById('jsonImportArea').style.display = mode === 'json' ? 'block' : 'none';
  }

  async analyzeDescription() {
    const descriptionInput = document.getElementById('descriptionInput');
    const description = descriptionInput.value.trim();
    
    if (!description || description.length < 10) {
      this.showToast('Please enter a description of at least 10 characters', 'error');
      return;
    }
    
    this.currentDescription = description;
    this.currentImage = null; // Clear any previous image
    
    // Switch to analysis view
    document.getElementById('uploadSection').style.display = 'none';
    document.getElementById('analysisSection').style.display = 'block';
    
    // Hide image display for text mode
    document.querySelector('.image-display').style.display = 'none';
    
    // Start analysis
    await this.analyzeContent();
  }

  async processImage(imageData) {
    this.currentImage = imageData;
    this.currentDescription = null; // Clear any previous description
    
    // Switch to analysis view
    document.getElementById('uploadSection').style.display = 'none';
    document.getElementById('analysisSection').style.display = 'block';
    
    // Show image display for image mode
    document.querySelector('.image-display').style.display = 'block';
    
    // Display image
    const selectedImage = document.getElementById('selectedImage');
    const imageName = document.getElementById('imageName');
    const imageSize = document.getElementById('imageSize');
    
    selectedImage.src = `data:${imageData.mimeType};base64,${imageData.base64}`;
    imageName.textContent = imageData.name;
    imageSize.textContent = this.formatFileSize(imageData.size);
    
    // Start analysis
    await this.analyzeContent();
  }

  async analyzeContent() {
    if (!this.currentImage && !this.currentDescription) return;
    
    this.isAnalyzing = true;
    const contentType = this.currentImage ? 'image' : 'description';
    this.updateAnalysisStatus(`Analyzing ${contentType}...`, 10);
    
    try {
      // Check Ollama connection first
      const isConnected = await this.checkOllamaConnection();
      if (!isConnected) {
        throw new Error('Cannot connect to Ollama. Please check your settings.');
      }

      // Perform analysis steps
      if (this.currentImage) {
        this.showWordGame();
        await this.performObjectDetection();
      } else {
        this.showWordGame();
        await this.performTextAnalysis();
      }
      
      // Show word game after detection/analysis is complete
      
      
      // Run generation functions in parallel
      this.updateAnalysisStatus('Generating vocabulary, story, and conversations...', 60);
      const [vocabularyResults, storyResults, conversationResults] = await Promise.all([
        this.generateVocabulary(),
        this.generateStory(),
        this.generateConversations()
      ]);
      
      this.updateAnalysisStatus('Analysis complete!', 100);
      this.showResults();
      
    } catch (error) {
      console.error('Analysis failed:', error);
      this.showToast(error.message || 'Analysis failed', 'error');
      this.updateAnalysisStatus('Analysis failed', 0);
      this.hideWordGame();
    } finally {
      this.isAnalyzing = false;
    }
  }

  async checkOllamaConnection() {
    try {
      const response = await fetch(`${this.settings.ollamaUrl}/api/tags`);
      const data = await response.json();
      console.log("HAS gemma3n")
      // Check if Gemma 2 model is available
      const hasgemma3n = data.models?.some(model => 
        model.name.toLowerCase().includes('gemma3n') || 
        model.name.toLowerCase().includes('gemma3n:latest') ||
        model.name.toLowerCase().includes('aliafshar/gemma3-it-qat-tools:4b')
      );
      
      const statusElement = document.getElementById('connectionStatus');
      if (statusElement) {
        if (hasgemma3n) {
          statusElement.innerHTML = '<span class="status-indicator">🟢</span><span>Connected (Gemma 2 available)</span>';
        } else {
          statusElement.innerHTML = '<span class="status-indicator">🟡</span><span>Connected (Gemma 2 not found)</span>';
        }
      }
      
      return true;
    } catch (error) {
      console.error('Ollama connection failed:', error);
      const statusElement = document.getElementById('connectionStatus');
      if (statusElement) {
        statusElement.innerHTML = '<span class="status-indicator">🔴</span><span>Connection failed</span>';
      }
      return false;
    }
  }

  async callOllama(prompt, systemPrompt = '', temperature=0.7, model="gemma3n:latest", outputSchema=null) {
    const requestBody = {
      model: model,
      prompt: prompt,
      system: systemPrompt,
      stream: false,
      options: {
        temperature: temperature,
        num_predict: 1000
      }
    };
    
    // Add structured output format if schema is provided
    if (outputSchema) {
      requestBody.format = outputSchema.getJsonSchema();
    }
    
    // Only include images field if we have an image (not text input)
    if (this.currentImage && this.currentImage.base64) {
      requestBody.images = [this.currentImage.base64];
    }
    
    const response = await fetch(`${this.settings.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    // If structured output was requested, parse the JSON response
    if (outputSchema) {
      try {
        return JSON.parse(data.response);
      } catch (error) {
        console.error('Failed to parse structured output:', error);
        throw new Error('Invalid JSON response from Ollama');
      }
    }
    
    return data.response;
  }

  async performOCR() {
    this.updateAnalysisStatus('Extracting text from image...', 20);
    
    const systemPrompt = `You are an expert OCR system. Analyze this image and identify any text you can see.`;
    
    const prompt = `Analyze this image and identify any text you can see. Format your response as a JSON object with this structure:
    {
      "texts": [
        {
          "content": "extracted text",
          "confidence": 0.95,
          "language": "detected language",
          "location": "description of where text appears"
        }
      ]
    }
    
    If no text is found, return {"texts": []}.`;

    try {
      const response = await this.callOllama(prompt, systemPrompt, 0.1, "aliafshar/gemma3-it-qat-tools:4b");
      const response2 = await this.callOllama(`Format this text: '${response}' as a JSON object with this structure:
    {
      "texts": [
        {
          "content": "extracted text",
          "confidence": 0.95,
          "language": "detected language",
          "location": "description of where text appears"
        }
      ]
    }
    
    If no text is found, return {"texts": []}`, `You are an expert in formatting. Reformat this text.`, 0.1);
      const ocrResults = JSON.parse(response2);
      this.analysisResults = { ...this.analysisResults, ocr: ocrResults };
    } catch (error) {
      console.error('OCR failed:', error);
      this.analysisResults = { ...this.analysisResults, ocr: { texts: [] } };
    }
  }

  async performObjectDetection() {
    this.updateAnalysisStatus('Identifying objects and scenes...', 40);
    
    const systemPrompt = `You are an expert computer vision system. Analyze images to identify objects, people, animals, locations, activities, and scenes with high accuracy.`;
    
    const prompt = `Please analyze this image and identify all visible elements. Format your response as a JSON object:
    {
      "objects": [
        {
          "name": "object name",
          "confidence": 0.95,
          "description": "detailed description"
        }
      ],
      "scene": {
        "setting": "place or environement of the picture",
        "location": "description of location type",
        "activity": "what's happening in the scene",
        "mood": "atmosphere or mood of the scene"
      }
    }`;

    try {
      const detectionResults = await this.callOllama(
        prompt, 
        systemPrompt, 
        0.1, 
        "aliafshar/gemma3-it-qat-tools:4b",
        new ObjectDetectionOutput()
      );
      this.analysisResults = { ...this.analysisResults, detection: detectionResults };
    } catch (error) {
      console.error('Object detection failed:', error);
      this.analysisResults = { 
        ...this.analysisResults, 
        detection: { objects: [], scene: { setting: 'unknown', location: 'unknown', activity: 'unknown', mood: 'neutral' } }
      };
    }
  }

  async performTextAnalysis() {
    this.updateAnalysisStatus('Analyzing text description...', 40);
    
    const systemPrompt = `You are an expert scene analyst. Analyze text descriptions to identify objects, people, animals, locations, activities, and scenes with high accuracy based on the provided description.`;
    
    const prompt = `Please analyze this text description and identify all elements that would be present in this scene: "${this.currentDescription}"
    
    Format your response as a JSON object:
    {
      "objects": [
        {
          "name": "object name",
          "confidence": 0.95,
          "description": "detailed description"
        }
      ],
      "scene": {
        "setting": "place or environment described",
        "location": "description of location type",
        "activity": "what's happening in the scene",
        "mood": "atmosphere or mood of the scene"
      }
    }
    
    Based on the description, infer what objects, people, and elements would logically be present in this scenario.`;

    try {
      const detectionResults = await this.callOllama(
        prompt, 
        systemPrompt, 
        0.1, 
        "gemma3n:latest",
        new ObjectDetectionOutput()
      );
      this.analysisResults = { ...this.analysisResults, detection: detectionResults };
    } catch (error) {
      console.error('Text analysis failed:', error);
      this.analysisResults = { 
        ...this.analysisResults, 
        detection: { objects: [], scene: { setting: 'unknown', location: 'unknown', activity: 'unknown', mood: 'neutral' } }
      };
    }
  }
  async generateVocabulary() {
    const languageNames = {
      spanish: 'Spanish',
      french: 'French',
      german: 'German',
      italian: 'Italian',
      portuguese: 'Portuguese',
      chinese: 'Chinese (Simplified)',
      japanese: 'Japanese',
      korean: 'Korean',
      arabic: 'Arabic',
      english: 'English'
    };

    const targetLanguage = languageNames[this.currentLanguage] || 'Spanish';
    const sourceLanguage = languageNames[this.sourceLanguage] || 'English';
    
    const systemPrompt = `You are an expert language teacher specializing in ${targetLanguage}. Create comprehensive vocabulary lists for language learners based on image content.`;
    
    // const ocrTexts = this.analysisResults?.ocr?.texts?.map(t => t.content).join(', ') || '';
    const objects = this.analysisResults?.detection?.objects?.map(o => o.name).join(', ') || '';
    const scene = this.analysisResults?.detection?.scene || {};
    
    const prompt = `Based on this image analysis:
    - Objects detected: ${objects}
    - Scene: ${scene.location}, ${scene.activity}
    
    Create a comprehensive vocabulary list in ${targetLanguage} for language learners. Focus on words that would be useful in this context. Format as JSON:
    {
      "vocabulary": [
        {
          "word": "word in ${targetLanguage}",
          "translation": "word translation in ${sourceLanguage},
          "category": "noun|verb|adjective|adverb|preposition",
          "difficulty": "beginner|intermediate|advanced",
          "example": "example sentence in ${targetLanguage}",
          "context": "how this word relates to the image"
        }
      ]
    }
    
    Include 10 relevant words, prioritizing practical vocabulary.`;

    try {
      const vocabularyResults = await this.callOllama(
        prompt, 
        systemPrompt, 
        0.7, 
        "gemma3n:latest",
        new VocabularyOutput()
      );
      this.analysisResults = { ...this.analysisResults, vocabulary: vocabularyResults };
    } catch (error) {
      console.error('Vocabulary generation failed:', error);
      this.analysisResults = { ...this.analysisResults, vocabulary: { vocabulary: [] } };
      throw error; // Re-throw to handle in Promise.all
    }
  }

  async generateStory() {
    const languageNames = {
      spanish: 'Spanish',
      french: 'French',
      german: 'German',
      italian: 'Italian',
      portuguese: 'Portuguese',
      chinese: 'Chinese (Simplified)',
      japanese: 'Japanese',
      korean: 'Korean',
      arabic: 'Arabic',
      english: 'English'
    };

    const targetLanguage = languageNames[this.currentLanguage] || 'Spanish';
    const sourceLanguageName = languageNames[this.sourceLanguage] || 'English';
    
    const systemPrompt = `You are a creative storyteller and language teacher. Write engaging short stories in ${targetLanguage} that help language learners practice reading comprehension.`;
    
    const scene = this.analysisResults?.detection?.scene || {};
    const objects = this.analysisResults?.detection?.objects?.slice(0, 5).map(o => o.name).join(', ') || '';
    // const vocabulary = this.analysisResults?.vocabulary?.vocabulary?.slice(0, 10).map(v => v.word).join(', ') || '';
    
    const prompt = `Create an engaging short story in ${targetLanguage} based on this image context:
    - Setting: ${scene.location}
    - Activity: ${scene.activity}
    - Objects present: ${objects}
    
    Format as JSON:
    {
      "story": {
        "title": "story title in ${targetLanguage}",
        "content": "complete story text in ${targetLanguage}",
        "difficulty": "beginner|intermediate|advanced",
        "word_count": number,
        "key_vocabulary": ["word1", "word2", "word3"],
        "moral": "lesson or takeaway from the story",
        "translation": "brief summary of the story in ${sourceLanguageName}"
      }
    }
    
    Make the story 150-300 words, appropriate for language learners, and incorporate cultural elements.`;

    try {
      const storyResults = await this.callOllama(
        prompt, 
        systemPrompt, 
        0.7, 
        "gemma3n:latest",
        new StoryOutput()
      );
      this.analysisResults = { ...this.analysisResults, story: storyResults };
    } catch (error) {
      console.error('Story generation failed:', error);
      this.analysisResults = { 
        ...this.analysisResults, 
        story: { 
          story: { 
            title: 'Story generation failed', 
            content: 'Unable to generate story at this time.', 
            difficulty: 'beginner',
            word_count: 0,
            key_vocabulary: [],
            moral: ''
          }
        }
      };
      throw error; // Re-throw to handle in Promise.all
    }
  }

  async generateConversations() {
    const languageNames = {
      spanish: 'Spanish',
      french: 'French',
      german: 'German',
      italian: 'Italian',
      portuguese: 'Portuguese',
      chinese: 'Chinese (Simplified)',
      japanese: 'Japanese',
      korean: 'Korean',
      arabic: 'Arabic',
      english: 'English'
    };

    const targetLanguage = languageNames[this.currentLanguage] || 'Spanish';
    const sourceLanguageName = languageNames[this.sourceLanguage] || 'English';
    
    const systemPrompt = `You are an expert dialogue creator and language teacher. Create realistic conversations in ${targetLanguage} that would naturally occur in the given context.`;
    
    const scene = this.analysisResults?.detection?.scene || {};
    const objects = this.analysisResults?.detection?.objects?.slice(0, 5).map(o => o.name).join(', ') || '';
    
    const prompt = `Create realistic dialogue scenarios in ${targetLanguage} based on this context:
    - Location: ${scene.location}
    - Activity: ${scene.activity}
    - Objects/Setting: ${objects}
    
    Format as JSON:
    {
      "scenario": "description of conversation context",
      "participants": ["person1", "person2"],
      "difficulty": "beginner|intermediate|advanced",
      "dialogue": [
        {
          "speaker": "person1",
          "text": "dialogue in ${targetLanguage}",
          "translation": "${sourceLanguageName} translation"
        }
      ],
      "cultural_notes": "relevant cultural context"
    }
    
    Create a single conversation scenario with 5-6 exchanges.`;

    try {
      const conversationResults = await this.callOllama(
        prompt, 
        systemPrompt, 
        0.7, 
        "gemma3n:latest",
        new ConversationOutput()
      );
      this.analysisResults = { ...this.analysisResults, conversations: conversationResults };
    } catch (error) {
      console.error('Conversation generation failed:', error);
      this.analysisResults = { 
        ...this.analysisResults, 
        conversations: { 
          scenario: 'Conversation generation failed',
          participants: ['System', 'User'],
          difficulty: 'beginner',
          dialogue: [
            {
              speaker: 'System',
              text: 'Unable to generate conversations at this time.',
              translation: 'Unable to generate conversations at this time.'
            }
          ],
          cultural_notes: 'Please try again later.'
        }
      };
      throw error; // Re-throw to handle in Promise.all
    }
  }

  showResults() {
    // Hide status panel
    document.getElementById('statusPanel').style.display = 'none';
    
    // Hide word game when results are shown
    this.hideWordGame();
    
    // Show and populate vocabulary panel
    if (this.analysisResults?.vocabulary) {
      this.populateVocabulary();
      document.getElementById('vocabularyPanel').style.display = 'block';
    }
    
    // Show and populate story panel
    if (this.analysisResults?.story) {
      this.populateStory();
      document.getElementById('storyPanel').style.display = 'block';
    }
    
    // Show and populate conversation panel
    if (this.analysisResults?.conversations) {
      this.populateConversations();
      document.getElementById('conversationPanel').style.display = 'block';
    }
    
    // Enable export and analyze again buttons
    document.getElementById('saveBtn').disabled = false;
    document.getElementById('analyzeAgainBtn').disabled = false;
    
    this.showToast('Analysis completed successfully!', 'success');
  }

  async loadWordDictionary() {
    try {
      const response = await fetch('./word_dict.json');
      const data = await response.json();
      this.wordDictionary = data["words"];
      
    } catch (error) {
      console.error('Failed to load word dictionary:', error);
      this.wordDictionary = [];
    }
  }
  
  async loadSentenceDictionary() {
    try {
      const response = await fetch('./simple_sentences.json');
      const data = await response.json();
      this.sentenceDictionary = data;
      console.log('Sentence dictionary loaded:', this.sentenceDictionary.length, 'sentences');
    } catch (error) {
      console.error('Failed to load sentence dictionary:', error);
      this.sentenceDictionary = [];
    }
  }

  getRandomWordSubset(count = 10) {
    if (!this.wordDictionary || !Array.isArray(this.wordDictionary) || this.wordDictionary.length === 0) {
      return [];
    }
    
    // Filter words that have both source and target language translations
    const availableWords = this.wordDictionary.filter(word => 
      word[this.sourceLanguage] && word[this.currentLanguage] &&
      word[this.sourceLanguage].trim() !== '' && word[this.currentLanguage].trim() !== ''
    );
    
    if (availableWords.length === 0) {
      return [];
    }
    
    // Shuffle and take random subset
    const shuffled = [...availableWords].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  showWordGame() {
    const wordGameContainer = document.getElementById('wordGameContainer');
    if (!wordGameContainer) return;
    
    // Initialize both games
    this.initializeWordGame();
    this.initializeSentenceGame();
    
    // Update language titles
    const sourceLanguageTitle = document.getElementById('sourceLanguageTitle');
    const targetLanguageTitle = document.getElementById('targetLanguageTitle');
    const sourceSentenceTitle = document.getElementById('sourceSentenceTitle');
    const targetSentenceTitle = document.getElementById('targetSentenceTitle');
    
    const languageNames = {
      spanish: 'Spanish',
      french: 'French',
      german: 'German',
      italian: 'Italian',
      portuguese: 'Portuguese',
      chinese: 'Chinese',
      japanese: 'Japanese',
      korean: 'Korean',
      arabic: 'Arabic',
      english: 'English'
    };
    
    if (sourceLanguageTitle) {
      sourceLanguageTitle.textContent = languageNames[this.sourceLanguage] || 'Source';
    }
    if (targetLanguageTitle) {
      targetLanguageTitle.textContent = languageNames[this.currentLanguage] || 'Target';
    }
    if (sourceSentenceTitle) {
      sourceSentenceTitle.textContent = `${languageNames[this.sourceLanguage]} Sentence` || 'Source Sentence';
    }
    if (targetSentenceTitle) {
      targetSentenceTitle.textContent = `Your ${languageNames[this.currentLanguage]} Translation` || 'Your Translation';
    }
    
    // Show the current game mode
    this.switchGameMode(this.gameMode);
    wordGameContainer.style.display = 'block';
  }

  hideWordGame() {
    const wordGameContainer = document.getElementById('wordGameContainer');
    if (wordGameContainer) {
      wordGameContainer.style.display = 'none';
    }
  }
  
  initializeWordGame() {
    this.currentGameWords = this.getRandomWordSubset(10);
    this.gameScore = 0;
    this.currentSubset = 1;
    this.selectedSourceWord = null;
    
    if (this.currentGameWords.length === 0) {
      console.warn('No words available for word game');
      return;
    }
    
    this.renderWordGame();
  }
  
  initializeSentenceGame() {
    this.currentGameSentences = this.getRandomSentenceSubset(5);
    this.currentSentenceIndex = 0;
    
    if (this.currentGameSentences.length === 0) {
      console.warn('No sentences available for sentence game');
      return;
    }
    
    this.renderSentenceGame();
  }
  
  getRandomSentenceSubset(count = 5) {
    if (!this.sentenceDictionary || !Array.isArray(this.sentenceDictionary) || this.sentenceDictionary.length === 0) {
      return [];
    }
    
    // Filter sentences that have both source and target language translations
    const availableSentences = this.sentenceDictionary.filter(sentence => 
      sentence[this.sourceLanguage] && sentence[this.currentLanguage] &&
      sentence[this.sourceLanguage].trim() !== '' && sentence[this.currentLanguage].trim() !== ''
    );
    
    if (availableSentences.length === 0) {
      return [];
    }
    
    // Shuffle and take random subset
    const shuffled = [...availableSentences].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }
  
  switchGameMode(mode) {
    this.gameMode = mode;
    
    // Update button states
    document.getElementById('wordGameModeBtn').classList.toggle('active', mode === 'word');
    document.getElementById('sentenceGameModeBtn').classList.toggle('active', mode === 'sentence');
    
    // Show/hide appropriate game content
    const wordGameContent = document.querySelector('.word-game-content');
    const sentenceGameContent = document.getElementById('sentenceGameContent');
    
    if (wordGameContent) {
      wordGameContent.style.display = mode === 'word' ? 'block' : 'none';
    }
    if (sentenceGameContent) {
      sentenceGameContent.style.display = mode === 'sentence' ? 'block' : 'none';
    }
  }
  
  renderSentenceGame() {
    if (this.currentGameSentences.length === 0) return;
    
    const sourceSentence = document.getElementById('sourceSentence');
    const currentSentenceNum = document.getElementById('currentSentenceNum');
    const sentenceInput = document.getElementById('sentenceInput');
    const sentenceResult = document.getElementById('sentenceResult');
    const nextSentenceBtn = document.getElementById('nextSentenceBtn');
    
    if (!sourceSentence || !currentSentenceNum) return;
    
    // Display current sentence
    const currentSentence = this.currentGameSentences[this.currentSentenceIndex];
    sourceSentence.textContent = currentSentence[this.sourceLanguage];
    currentSentenceNum.textContent = this.currentSentenceIndex + 1;
    
    // Reset input and result
    if (sentenceInput) sentenceInput.value = '';
    if (sentenceResult) sentenceResult.style.display = 'none';
    if (nextSentenceBtn) nextSentenceBtn.style.display = 'none';
  }
  
  checkSentenceTranslation() {
    const sentenceInput = document.getElementById('sentenceInput');
    const sentenceResult = document.getElementById('sentenceResult');
    const targetSentence = document.getElementById('targetSentence');
    const sentenceComparison = document.getElementById('sentenceComparison');
    const nextSentenceBtn = document.getElementById('nextSentenceBtn');
    
    if (!sentenceInput || !sentenceResult || !targetSentence || !sentenceComparison) return;
    
    const userInput = sentenceInput.value.trim();
    if (!userInput) {
      this.showToast('Please enter a translation first', 'error');
      return;
    }
    
    const currentSentence = this.currentGameSentences[this.currentSentenceIndex];
    const correctTranslation = currentSentence[this.currentLanguage];
    
    // Show the correct translation
    targetSentence.textContent = correctTranslation;
    
    // Compare words and highlight matches
    const comparison = this.compareTranslations(userInput, correctTranslation);
    sentenceComparison.innerHTML = comparison;
    
    // Show result section
    sentenceResult.style.display = 'block';
    
    // Show next button if not the last sentence
    if (this.currentSentenceIndex < this.currentGameSentences.length - 1) {
      nextSentenceBtn.style.display = 'inline-block';
    } else {
      this.showToast('All sentences completed! Great job!', 'success');
    }
  }
  
  compareTranslations(userInput, correctTranslation) {
    const userWords = userInput.toLowerCase().split(/\s+/);
    const correctWords = correctTranslation.toLowerCase().split(/\s+/);
    
    let comparisonHtml = '<p><strong>Your translation:</strong> ';
    
    userWords.forEach(userWord => {
      const cleanUserWord = userWord.replace(/[.,!?;:]/g, '');
      let matchType = 'incorrect';
      
      // Check for exact match
      if (correctWords.some(correctWord => {
        const cleanCorrectWord = correctWord.replace(/[.,!?;:]/g, '');
        return cleanCorrectWord === cleanUserWord;
      })) {
        matchType = 'correct';
      }
      // Check for partial match (contains or is contained)
      else if (correctWords.some(correctWord => {
        const cleanCorrectWord = correctWord.replace(/[.,!?;:]/g, '');
        return cleanCorrectWord.includes(cleanUserWord) || cleanUserWord.includes(cleanCorrectWord);
      })) {
        matchType = 'partial';
      }
      
      comparisonHtml += `<span class="word-match ${matchType}">${userWord}</span> `;
    });
    
    comparisonHtml += '</p>';
    return comparisonHtml;
  }
  
  nextSentence() {
    if (this.currentSentenceIndex < this.currentGameSentences.length - 1) {
      this.currentSentenceIndex++;
      this.renderSentenceGame();
    }
  }
  
  resetSentenceGame() {
    this.currentSentenceIndex = 0;
    this.renderSentenceGame();
  }

  renderWordGame() {
    const sourceWordList = document.getElementById('sourceWordList');
    const targetWordList = document.getElementById('targetWordList');
    const gameScore = document.getElementById('gameScore');
    const currentSubset = document.getElementById('currentSubset');
    
    if (!sourceWordList || !targetWordList) return;
    
    // Update score and subset display
    if (gameScore) gameScore.textContent = this.gameScore;
    if (currentSubset) currentSubset.textContent = this.currentSubset;
    
    // Create source language words (in order)
    const sourceWords = this.currentGameWords.map((word, index) => 
      `<div class="word-item" data-word-index="${index}" data-word-type="source">
        ${word[this.sourceLanguage]}
      </div>`
    ).join('');
    
    // Create target language words (shuffled)
    const shuffledIndices = [...Array(this.currentGameWords.length).keys()].sort(() => Math.random() - 0.5);
    const targetWords = shuffledIndices.map(index => 
      `<div class="word-item" data-word-index="${index}" data-word-type="target">
        ${this.currentGameWords[index][this.currentLanguage]}
      </div>`
    ).join('');
    
    sourceWordList.innerHTML = sourceWords;
    targetWordList.innerHTML = targetWords;
  }

  handleWordClick(wordElement) {
    const wordType = wordElement.dataset.wordType;
    const wordIndex = parseInt(wordElement.dataset.wordIndex);
    
    if (wordElement.classList.contains('matched')) {
      return; // Already matched, ignore click
    }
    
    if (wordType === 'source') {
      // Clear previous source selection
      document.querySelectorAll('.word-item[data-word-type="source"]').forEach(el => {
        el.classList.remove('selected');
      });
      
      // Select new source word
      wordElement.classList.add('selected');
      this.selectedSourceWord = { element: wordElement, index: wordIndex };
      
    } else if (wordType === 'target' && this.selectedSourceWord) {
      // Check if match is correct
      const isCorrect = this.selectedSourceWord.index === wordIndex;
      
      if (isCorrect) {
        // Correct match
        this.selectedSourceWord.element.classList.add('matched');
        this.selectedSourceWord.element.classList.remove('selected');
        wordElement.classList.add('matched');
        
        this.gameScore++;
        document.getElementById('gameScore').textContent = this.gameScore;
        
        // Check if subset is complete
        if (this.gameScore >= this.currentGameWords.length) {
          this.completeSubset();
        }
        
      } else {
        // Incorrect match
        wordElement.classList.add('incorrect');
        if (this.selectedSourceWord && this.selectedSourceWord.element) {
          this.selectedSourceWord.element.classList.add('incorrect');
        }
        
        // Remove incorrect styling after animation
        const selectedElement = this.selectedSourceWord ? this.selectedSourceWord.element : null;
        setTimeout(() => {
          wordElement.classList.remove('incorrect');
          if (selectedElement) {
            selectedElement.classList.remove('incorrect');
          }
        }, 500);
      }
      
      // Clear source selection
      this.selectedSourceWord = null;
    }
  }

  completeSubset() {
    const nextSubsetBtn = document.getElementById('nextSubsetBtn');
    if (nextSubsetBtn && this.currentSubset < this.maxSubsets) {
      nextSubsetBtn.style.display = 'inline-block';
    }
    
    this.showToast(`Subset ${this.currentSubset} completed! Score: ${this.gameScore}/${this.currentGameWords.length}`, 'success');
  }

  nextWordSubset() {
    if (this.currentSubset >= this.maxSubsets) return;
    
    this.currentSubset++;
    this.currentGameWords = this.getRandomWordSubset(10);
    this.gameScore = 0;
    this.selectedSourceWord = null;
    
    document.getElementById('nextSubsetBtn').style.display = 'none';
    this.renderWordGame();
  }

  resetWordGame() {
    this.gameScore = 0;
    this.selectedSourceWord = null;
    document.getElementById('nextSubsetBtn').style.display = 'none';
    this.renderWordGame();
  }

  async importAnalysisFromMode() {
    try {
      const result = await window.electronAPI.loadAnalysis();
      if (result.success) {
        // Load the analysis data
        const analysisData = result.data;
        
        // Restore application state
        this.analysisResults = analysisData.results;
        this.inputMode = 'json';
        this.currentLanguage = analysisData.language || this.settings.language;
        this.sourceLanguage = analysisData.sourceLanguage || this.settings.sourceLanguage;
        
        // Update UI settings
        this.applySettings();
        
        // Switch to analysis view
        document.getElementById('uploadSection').style.display = 'none';
        document.getElementById('analysisSection').style.display = 'block';
        
        // Hide image display for imported JSON data
        document.querySelector('.image-display').style.display = 'none';
        
        // Hide status panel and show results
        document.getElementById('statusPanel').style.display = 'none';
        this.showResults();
        
        // Enable save button, disable analyze again (no original input to re-analyze)
        document.getElementById('saveBtn').disabled = false;
        document.getElementById('analyzeAgainBtn').disabled = true;
        
        this.showToast(`Analysis loaded from ${result.filename}`, 'success');
      } else {
        if (result.error !== 'Load cancelled by user') {
          this.showToast(result.error || 'Failed to load analysis', 'error');
        }
      }
    } catch (error) {
      console.error('Import failed:', error);
      this.showToast('Failed to import analysis', 'error');
    }
  }

  populateVocabulary() {
    const content = document.getElementById('vocabularyContent');
    const vocabulary = this.analysisResults?.vocabulary?.vocabulary || [];
    
    if (vocabulary.length === 0) {
      content.innerHTML = '<p>No vocabulary items found.</p>';
      return;
    }
    
    const html = vocabulary.map((item, index) => `
      <div class="vocabulary-item">
        <div class="vocab-header">
          <div class="vocab-main">
            <div class="vocab-word">${item.word}</div>
            <div class="vocab-phonetic">${item.phonetic || ''}</div>
            <div class="vocab-translation" data-vocab-translation="${index}">${item.translation}</div>
            <div class="vocab-example">${item.example || ''}</div>
            <span class="vocab-category">${item.category}</span>
          </div>
          <button class="vocab-toggle" data-vocab-index="${index}" title="Toggle translation">
            T
          </button>
        </div>
      </div>
    `).join('');
    
    content.innerHTML = html;
  }

  populateStory() {
    const content = document.getElementById('storyContent');
    const story = this.analysisResults?.story?.story;
    
    if (!story || !story.content) {
      content.innerHTML = '<p>No story generated.</p>';
      return;
    }
    
    const difficultyStars = '★'.repeat(
      story.difficulty === 'beginner' ? 1 : 
      story.difficulty === 'intermediate' ? 2 : 3
    );
    
    const html = `
      <div class="difficulty-indicator">
        <span>Difficulty:</span>
        <span class="difficulty-stars">${difficultyStars}</span>
        <span>${story.difficulty}</span>
      </div>
      <div class="story-header">
        <div class="story-title-section">
          <h4 style="margin-bottom: 0.5rem; color: var(--accent-primary);">${story.title}</h4>
        </div>
        <button class="story-toggle" title="Toggle translation">
          T
        </button>
      </div>
      <div class="story-content">
        ${story.content.split('.').map(sentence => 
          sentence.trim() ? `<div class="story-sentence">${sentence.trim()}.</div>` : ''
        ).join('')}
      </div>
      ${story.translation ? `<div class="story-translation"><strong>Summary:</strong> ${story.translation}</div>` : ''}
      ${story.moral ? `<div style="margin-top: 1rem; padding: 1rem; background-color: var(--bg-primary); border-radius: var(--radius-md); border-left: 3px solid var(--accent-primary);"><strong>Moral:</strong> ${story.moral}</div>` : ''}
    `;
    
    content.innerHTML = html;
  }

  populateConversations() {
    const content = document.getElementById('conversationContent');
    const conversation = this.analysisResults?.conversations;
    
    if (!conversation) {
      content.innerHTML = '<p>No conversations generated.</p>';
      return;
    }
    
    const html = `
      <div class="conversation-scenario">
        <div class="scenario-title">${conversation.scenario}</div>
        <div class="scenario-meta" style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--text-secondary);">
          <span>Participants: ${conversation.participants.join(', ')}</span> • 
          <span>Level: ${conversation.difficulty}</span>
        </div>
        ${conversation.dialogue.map((line, index) => `
          <div class="dialogue-line">
            <div class="speaker">${line.speaker}:</div>
            <div class="dialogue-content">
              <div class="dialogue-header">
                <div class="dialogue-text">
                  <div>${line.text}</div>
                </div>
                <button class="dialogue-toggle" data-dialogue-index="${index}" title="Toggle translation">
                  T
                </button>
              </div>
              <div class="dialogue-translation" data-dialogue-translation="${index}">${line.translation}</div>
            </div>
          </div>
        `).join('')}
        ${conversation.cultural_notes ? `<div style="margin-top: 1rem; padding: 0.75rem; background-color: var(--bg-primary); border-radius: var(--radius-md); font-size: 0.9rem;"><strong>Cultural Note:</strong> ${conversation.cultural_notes}</div>` : ''}
      </div>
    `;
    
    content.innerHTML = html;
  }

  updateAnalysisStatus(text, progress) {
    const statusText = document.getElementById('statusText');
    const progressFill = document.getElementById('progressFill');
    
    if (statusText) statusText.textContent = text;
    if (progressFill) progressFill.style.width = `${progress}%`;
  }

  togglePanel(panelType) {
    const panel = document.getElementById(`${panelType}Panel`);
    const content = panel?.querySelector('.panel-content');
    const toggle = panel?.querySelector('.panel-toggle');
    
    if (!content || !toggle) return;
    
    const isCollapsed = content.style.display === 'none';
    content.style.display = isCollapsed ? 'block' : 'none';
    toggle.textContent = isCollapsed ? '−' : '+';
  }
  toggleVocabTranslation(toggleButton) {
    const index = toggleButton.dataset.vocabIndex;
    const translation = document.querySelector(`[data-vocab-translation="${index}"]`);
    
    if (translation) {
      const isShowing = translation.classList.contains('show');
      translation.classList.toggle('show', !isShowing);
      toggleButton.classList.toggle('active', !isShowing);
      
      // Add click effect
      toggleButton.style.transform = 'scale(0.9)';
      setTimeout(() => toggleButton.style.transform = '', 150);
    }
  }

  toggleDialogueTranslation(toggleButton) {
    const index = toggleButton.dataset.dialogueIndex;
    const translation = document.querySelector(`[data-dialogue-translation="${index}"]`);
    
    if (translation) {
      const isShowing = translation.classList.contains('show');
      translation.classList.toggle('show', !isShowing);
      toggleButton.classList.toggle('active', !isShowing);
      
      // Add click effect
      toggleButton.style.transform = 'scale(0.9)';
      setTimeout(() => toggleButton.style.transform = '', 150);
    }
  }

  toggleStoryTranslation(toggleButton) {
    const translation = document.querySelector('.story-translation');
    
    if (translation) {
      const isShowing = translation.classList.contains('show');
      translation.classList.toggle('show', !isShowing);
      toggleButton.classList.toggle('active', !isShowing);
      
      // Add click effect
      toggleButton.style.transform = 'scale(0.9)';
      setTimeout(() => toggleButton.style.transform = '', 150);
    }
  }

  resetToUpload() {
    this.currentImage = null;
    this.currentDescription = null;
    this.analysisResults = null;
    this.isAnalyzing = false;
    this.hideWordGame();
    this.hideWordGame();
    
    document.getElementById('analysisSection').style.display = 'none';
    document.getElementById('uploadSection').style.display = 'block';
    
    // Show image display again for new analysis
    document.querySelector('.image-display').style.display = 'block';
    
    // Reset panels
    ['vocabulary', 'story', 'conversation'].forEach(panel => {
      document.getElementById(`${panel}Panel`).style.display = 'none';
    });
    
    // Reset buttons
    document.getElementById('saveBtn').disabled = true;
    document.getElementById('analyzeAgainBtn').disabled = true;
    
    // Show status panel
    document.getElementById('statusPanel').style.display = 'block';
  }

  async saveResults() {
    if (!this.analysisResults) {
      this.showToast('No results to save', 'error');
      return;
    }
    
    try {
      const saveData = {
        timestamp: new Date().toISOString(),
        language: this.currentLanguage,
        sourceLanguage: this.sourceLanguage,
        inputMode: this.inputMode,
        input: this.currentImage ? {
          type: 'image',
          name: this.currentImage.name,
          size: this.currentImage.size
        } : {
          type: 'text',
          description: this.currentDescription
        },
        results: this.analysisResults
      };
      
      const result = await window.electronAPI.saveAnalysis(saveData);
      if (result.success) {
        this.showToast(`Analysis saved as ${result.filename}`, 'success');
      } else {
        if (result.error !== 'Save cancelled by user') {
          this.showToast(result.error || 'Save failed', 'error');
        }
      }
    } catch (error) {
      console.error('Save failed:', error);
      this.showToast('Save failed', 'error');
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Remove toast after 5 seconds
    setTimeout(() => {
      if (toast.parentNode === container) {
        container.removeChild(toast);
      }
    }, 5000);
  }

}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new LanguageLearningRenderer();
});