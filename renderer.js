class LanguageLearningRenderer {
  constructor() {
    this.currentImage = null;
    this.currentLanguage = 'english';
    this.settings = {
      language: 'english',
      theme: 'dark',
      ollamaUrl: 'http://localhost:11434'
    };
    this.analysisResults = null;
    this.isAnalyzing = false;
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.setupDragAndDrop();
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
    uploadBtn?.addEventListener('click', () => this.selectImage());

    // Upload area click
    const uploadArea = document.getElementById('uploadArea');
    uploadArea?.addEventListener('click', () => this.selectImage());

    // Language selector
    const languageSelect = document.getElementById('languageSelect');
    languageSelect?.addEventListener('change', (e) => {
      this.settings.language = e.target.value;
      this.currentLanguage = e.target.value;
      this.saveSettings();
    });

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    themeToggle?.addEventListener('click', () => {
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
    const newImageBtn = document.getElementById('newImageBtn');
    const exportBtn = document.getElementById('exportBtn');
    const analyzeAgainBtn = document.getElementById('analyzeAgainBtn');

    newImageBtn?.addEventListener('click', () => this.resetToUpload());
    exportBtn?.addEventListener('click', () => this.exportResults());
    analyzeAgainBtn?.addEventListener('click', () => this.analyzeImage());

    // Panel toggles
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('panel-toggle')) {
        const panel = e.target.dataset.panel;
        this.togglePanel(panel);
      }
    });

    // Close modal on overlay click
    settingsModal?.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        settingsModal.style.display = 'none';
      }
    });
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

  async processImage(imageData) {
    this.currentImage = imageData;
    
    // Switch to analysis view
    document.getElementById('uploadSection').style.display = 'none';
    document.getElementById('analysisSection').style.display = 'block';
    
    // Display image
    const selectedImage = document.getElementById('selectedImage');
    const imageName = document.getElementById('imageName');
    const imageSize = document.getElementById('imageSize');
    
    selectedImage.src = `data:${imageData.mimeType};base64,${imageData.base64}`;
    imageName.textContent = imageData.name;
    imageSize.textContent = this.formatFileSize(imageData.size);
    
    // Start analysis
    await this.analyzeImage();
  }

  async analyzeImage() {
    if (!this.currentImage) return;
    
    this.isAnalyzing = true;
    this.updateAnalysisStatus('Analyzing image...', 10);
    
    try {
      // Check Ollama connection first
      const isConnected = await this.checkOllamaConnection();
      if (!isConnected) {
        throw new Error('Cannot connect to Ollama. Please check your settings.');
      }

      // Perform analysis steps
      await this.performOCR();
      await this.performObjectDetection();
      await this.generateVocabulary();
      await this.generateStory();
      await this.generateConversations();
      
      this.updateAnalysisStatus('Analysis complete!', 100);
      this.showResults();
      
    } catch (error) {
      console.error('Analysis failed:', error);
      this.showToast(error.message || 'Analysis failed', 'error');
      this.updateAnalysisStatus('Analysis failed', 0);
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
        model.name.toLowerCase().includes('llama3.2-vision:latest')
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

  async callOllama(prompt, systemPrompt = '', temperature=0.7, model="gemma3n:latest") {
    // console.log(this.currentImage.base64)
    const response = await fetch(`${this.settings.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        images: [this.currentImage.base64],
        system: systemPrompt,
        stream: false,
        options: {
          temperature: temperature,
          num_predict: 1000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data = await response.json();
    let json_data = {"texts": []}
    if (model == "gemma3n:latest") {
      json_data = data["response"].replace(/^[`\s\n]+|[`\s\n]+$/g, '');
    
      // Python: if json_data.startswith('json'):
      if (json_data.startsWith('json')) {
        // Python: json_data = json_data[4:]
        json_data = json_data.substring(4);
      }
      console.log(json_data)
    }
    else {
      return data["response"]
    }
    return json_data;
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
      const response = await this.callOllama(prompt, systemPrompt, 0.1, "llama3.2-vision:latest");
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
      const response = await this.callOllama(prompt, systemPrompt, 0.1, "llama3.2-vision:latest");
      const response2 = await this.callOllama(`Format this text: '${response}' as a JSON object with this structure:
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
      }`, `You are an expert in formatting. Reformat this text.`, 0.1);
      const detectionResults = JSON.parse(response2);
      this.analysisResults = { ...this.analysisResults, detection: detectionResults };
    } catch (error) {
      console.error('Object detection failed:', error);
      this.analysisResults = { 
        ...this.analysisResults, 
        detection: { objects: [], scene: { setting: 'unknown', location: 'unknown', activity: 'unknown', mood: 'neutral' } }
      };
    }
  }

  async generateVocabulary() {
    this.updateAnalysisStatus('Generating vocabulary...', 60);
    
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
    
    const systemPrompt = `You are an expert language teacher specializing in ${targetLanguage}. Create comprehensive vocabulary lists for language learners based on image content.`;
    
    const ocrTexts = this.analysisResults?.ocr?.texts?.map(t => t.content).join(', ') || '';
    const objects = this.analysisResults?.detection?.objects?.map(o => o.name).join(', ') || '';
    const scene = this.analysisResults?.detection?.scene || {};
    
    const prompt = `Based on this image analysis:
    - Extracted text: ${ocrTexts}
    - Objects detected: ${objects}
    - Scene: ${scene.location}, ${scene.activity}
    
    Create a comprehensive vocabulary list in ${targetLanguage} for language learners. Focus on words that would be useful in this context. Format as JSON:
    {
      "vocabulary": [
        {
          "word": "word in ${targetLanguage}",
          "translation": "word translation in English",
          "category": "noun|verb|adjective|adverb|preposition",
          "difficulty": "beginner|intermediate|advanced",
          "example": "example sentence in ${targetLanguage}",
          "context": "how this word relates to the image"
        }
      ]
    }
    
    Include 10 relevant words, prioritizing practical vocabulary.`;

    try {
      const response = await this.callOllama(prompt, systemPrompt);
      const vocabularyResults = JSON.parse(response);
      this.analysisResults = { ...this.analysisResults, vocabulary: vocabularyResults };
    } catch (error) {
      console.error('Vocabulary generation failed:', error);
      this.analysisResults = { ...this.analysisResults, vocabulary: { vocabulary: [] } };
    }
  }

  async generateStory() {
    this.updateAnalysisStatus('Creating story...', 80);
    
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
    
    const systemPrompt = `You are a creative storyteller and language teacher. Write engaging short stories in ${targetLanguage} that help language learners practice reading comprehension.`;
    
    const scene = this.analysisResults?.detection?.scene || {};
    const objects = this.analysisResults?.detection?.objects?.slice(0, 5).map(o => o.name).join(', ') || '';
    const vocabulary = this.analysisResults?.vocabulary?.vocabulary?.slice(0, 10).map(v => v.word).join(', ') || '';
    
    const prompt = `Create an engaging short story in ${targetLanguage} based on this image context:
    - Setting: ${scene.location}
    - Activity: ${scene.activity}
    - Objects present: ${objects}
    - Key vocabulary to include: ${vocabulary}
    
    Format as JSON:
    {
      "story": {
        "title": "story title in ${targetLanguage}",
        "content": "complete story text in ${targetLanguage}",
        "difficulty": "beginner|intermediate|advanced",
        "word_count": number,
        "key_vocabulary": ["word1", "word2", "word3"],
        "moral": "lesson or takeaway from the story"
      }
    }
    
    Make the story 150-300 words, appropriate for language learners, and incorporate cultural elements.`;

    try {
      const response = await this.callOllama(prompt, systemPrompt);
      const storyResults = JSON.parse(response);
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
    }
  }

  async generateConversations() {
    this.updateAnalysisStatus('Creating conversations...', 90);
    
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
          "translation": "English translation"
        }
      ],
      "cultural_notes": "relevant cultural context"
    }
    
    Create a single conversation scenario with 5-6 exchanges.`;

    try {
      const response = await this.callOllama(prompt, systemPrompt);
      const conversationResults = JSON.parse(response);
      console.log(conversationResults)
      this.analysisResults = { ...this.analysisResults, conversations: conversationResults };
    } catch (error) {
      console.error('Conversation generation failed:', error);
      this.analysisResults = { 
        ...this.analysisResults, 
        conversations: { 
          conversations: [{
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
          }]
        }
      };
    }
  }

  showResults() {
    // Hide status panel
    document.getElementById('statusPanel').style.display = 'none';
    
    // Show and populate vocabulary panel
    this.populateVocabulary();
    document.getElementById('vocabularyPanel').style.display = 'block';
    
    // Show and populate story panel
    this.populateStory();
    document.getElementById('storyPanel').style.display = 'block';
    
    // Show and populate conversation panel
    this.populateConversations();
    document.getElementById('conversationPanel').style.display = 'block';
    
    // Enable export and analyze again buttons
    document.getElementById('exportBtn').disabled = false;
    document.getElementById('analyzeAgainBtn').disabled = false;
    
    this.showToast('Analysis completed successfully!', 'success');
  }

  populateVocabulary() {
    const content = document.getElementById('vocabularyContent');
    const vocabulary = this.analysisResults?.vocabulary?.vocabulary || [];
    
    if (vocabulary.length === 0) {
      content.innerHTML = '<p>No vocabulary items found.</p>';
      return;
    }
    
    const html = vocabulary.map(item => `
      <div class="vocabulary-item">
        <div class="vocab-word">${item.word}</div>
        <div class="vocab-phonetic">${item.phonetic || ''}</div>
        <div class="vocab-translation">${item.translation}</div>
        <div class="vocab-example">${item.example || ''}</div>
        <span class="vocab-category">${item.category}</span>
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
      <h4 style="margin-bottom: 1rem; color: var(--accent-primary);">${story.title}</h4>
      <div class="story-content">
        ${story.content.split('.').map(sentence => 
          sentence.trim() ? `<div class="story-sentence">${sentence.trim()}.</div>` : ''
        ).join('')}
      </div>
      ${story.moral ? `<div style="margin-top: 1rem; padding: 1rem; background-color: var(--bg-primary); border-radius: var(--radius-md); border-left: 3px solid var(--accent-primary);"><strong>Moral:</strong> ${story.moral}</div>` : ''}
    `;
    
    content.innerHTML = html;
  }

  populateConversations() {
    const content = document.getElementById('conversationContent');
    const conversations = [this.analysisResults?.conversations] || [];
    console.log("CONVOS:")
    console.log(conversations[0])
    if (conversations.length === 0) {
      content.innerHTML = '<p>No conversations generated.</p>';
      return;
    }
    
    const html = conversations.map(conv => `
      <div class="conversation-scenario">
        <div class="scenario-title">${conv.scenario}</div>
        <div class="scenario-meta" style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--text-secondary);">
          <span>Participants: ${conv.participants.join(', ')}</span> • 
          <span>Level: ${conv.difficulty}</span>
        </div>
        ${conv.dialogue.map(line => `
          <div class="dialogue-line">
            <div class="speaker">${line.speaker}:</div>
            <div class="dialogue-text">
              <div>${line.text}</div>
              <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">${line.translation}</div>
            </div>
          </div>
        `).join('')}
        ${conv.cultural_notes ? `<div style="margin-top: 1rem; padding: 0.75rem; background-color: var(--bg-primary); border-radius: var(--radius-md); font-size: 0.9rem;"><strong>Cultural Note:</strong> ${conv.cultural_notes}</div>` : ''}
      </div>
    `).join('');
    
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

  resetToUpload() {
    this.currentImage = null;
    this.analysisResults = null;
    this.isAnalyzing = false;
    
    document.getElementById('analysisSection').style.display = 'none';
    document.getElementById('uploadSection').style.display = 'block';
    
    // Reset panels
    ['vocabulary', 'story', 'conversation'].forEach(panel => {
      document.getElementById(`${panel}Panel`).style.display = 'none';
    });
    
    // Reset buttons
    document.getElementById('exportBtn').disabled = true;
    document.getElementById('analyzeAgainBtn').disabled = true;
    
    // Show status panel
    document.getElementById('statusPanel').style.display = 'block';
  }

  async exportResults() {
    if (!this.analysisResults) {
      this.showToast('No results to export', 'error');
      return;
    }
    
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        language: this.currentLanguage,
        image: {
          name: this.currentImage?.name,
          size: this.currentImage?.size
        },
        results: this.analysisResults
      };
      
      const result = await window.electronAPI.exportData(exportData, 'analysis');
      if (result.success) {
        this.showToast('Results exported successfully', 'success');
      } else {
        this.showToast(result.error || 'Export failed', 'error');
      }
    } catch (error) {
      console.error('Export failed:', error);
      this.showToast('Export failed', 'error');
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