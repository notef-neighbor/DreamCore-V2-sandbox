class GameCreatorApp {
  constructor() {
    this.ws = null;
    this.visitorId = null;
    this.currentProjectId = null;
    this.projects = [];
    this.isProcessing = false;

    // DOM elements
    this.chatMessages = document.getElementById('chatMessages');
    this.chatInput = document.getElementById('chatInput');
    this.sendButton = document.getElementById('sendButton');
    this.stopButton = document.getElementById('stopButton');
    this.refreshButton = document.getElementById('refreshButton');
    this.newProjectButton = document.getElementById('newProjectButton');
    this.projectSelect = document.getElementById('projectSelect');
    this.gamePreview = document.getElementById('gamePreview');
    this.statusIndicator = document.getElementById('statusIndicator');
    this.previewTitle = document.getElementById('previewTitle');
    this.noProjectMessage = document.getElementById('noProjectMessage');
    this.versionsButton = document.getElementById('versionsButton');
    this.versionPanel = document.getElementById('versionPanel');
    this.versionList = document.getElementById('versionList');
    this.closeVersionsButton = document.getElementById('closeVersionsButton');

    // Streaming elements
    this.streamingContainer = document.getElementById('streamingContainer');
    this.streamingStatus = document.getElementById('streamingStatus');
    this.streamingFile = document.getElementById('streamingFile');
    this.streamingOutput = document.getElementById('streamingOutput');
    this.streamingText = '';
    this.typewriterQueue = [];
    this.isTyping = false;

    // IME composition state
    this.isComposing = false;

    // Try to restore visitorId from localStorage
    this.visitorId = localStorage.getItem('gameCreatorVisitorId');

    this.init();
  }

  init() {
    this.connectWebSocket();
    this.setupEventListeners();
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}`);

    this.ws.onopen = () => {
      this.updateStatus('connected', 'Connected');
      this.ws.send(JSON.stringify({
        type: 'init',
        visitorId: this.visitorId
      }));
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onclose = () => {
      this.updateStatus('', 'Disconnected');
      this.sendButton.disabled = true;
      this.chatInput.disabled = true;
      setTimeout(() => this.connectWebSocket(), 3000);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.updateStatus('', 'Error');
    };
  }

  setupEventListeners() {
    this.sendButton.addEventListener('click', () => this.sendMessage());

    // Track IME composition state
    this.chatInput.addEventListener('compositionstart', () => {
      this.isComposing = true;
    });

    this.chatInput.addEventListener('compositionend', () => {
      this.isComposing = false;
    });

    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !this.isComposing) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.refreshButton.addEventListener('click', () => this.refreshPreview());
    this.newProjectButton.addEventListener('click', () => this.createNewProject());
    this.projectSelect.addEventListener('change', (e) => this.selectProject(e.target.value));
    this.stopButton.addEventListener('click', () => this.stopGeneration());
    this.versionsButton.addEventListener('click', () => this.toggleVersionPanel());
    this.closeVersionsButton.addEventListener('click', () => this.hideVersionPanel());
  }

  handleMessage(data) {
    switch (data.type) {
      case 'init':
        this.visitorId = data.visitorId;
        localStorage.setItem('gameCreatorVisitorId', this.visitorId);
        this.projects = data.projects || [];
        this.updateProjectList();

        // Auto-select last project if exists
        if (this.projects.length > 0) {
          const lastProjectId = localStorage.getItem('gameCreatorLastProjectId');
          const projectToSelect = this.projects.find(p => p.id === lastProjectId) || this.projects[0];
          this.selectProject(projectToSelect.id);
        }
        break;

      case 'projectCreated':
        this.projects = data.projects;
        this.updateProjectList();
        this.selectProject(data.project.id);
        this.addMessage(`Project "${data.project.name}" created!`, 'system');
        break;

      case 'projectSelected':
        this.currentProjectId = data.projectId;
        localStorage.setItem('gameCreatorLastProjectId', this.currentProjectId);
        this.chatInput.disabled = false;
        this.sendButton.disabled = false;

        // Clear and reload history
        this.chatMessages.innerHTML = '';
        if (data.history && data.history.length > 0) {
          data.history.forEach(h => {
            this.addMessage(h.content, h.role);
          });
        }

        this.refreshPreview();
        this.updatePreviewVisibility(true);

        // Update preview title
        const project = this.projects.find(p => p.id === this.currentProjectId);
        if (project) {
          this.previewTitle.textContent = project.name;
        }

        // Show versions button
        this.versionsButton.classList.remove('hidden');
        break;

      case 'projectDeleted':
        this.projects = data.projects;
        this.updateProjectList();
        if (!this.currentProjectId || this.currentProjectId === data.projectId) {
          this.currentProjectId = null;
          this.chatMessages.innerHTML = '';
          this.chatInput.disabled = true;
          this.sendButton.disabled = true;
          this.updatePreviewVisibility(false);
        }
        break;

      case 'projectRenamed':
        this.projects = data.projects;
        this.updateProjectList();
        if (this.currentProjectId === data.project.id) {
          this.previewTitle.textContent = data.project.name;
        }
        break;

      case 'status':
        this.updateStatus('processing', data.message);
        this.isProcessing = true;
        this.sendButton.disabled = true;
        this.stopButton.classList.remove('hidden');
        this.showStreaming();
        break;

      case 'stream':
        console.log('Stream event received:', data);
        this.appendToStream(data.content);
        break;

      case 'fileEdit':
        this.updateStreamingFile(data.filename, data.status);
        break;

      case 'complete':
        this.completeStreaming();
        this.addMessage(data.message, 'assistant');
        this.updateStatus('connected', 'Connected');
        this.isProcessing = false;
        this.sendButton.disabled = false;
        this.stopButton.classList.add('hidden');
        break;

      case 'info':
        // Info messages during processing - don't close streaming
        this.addMessage(data.message, 'system');
        break;

      case 'gameUpdated':
        this.refreshPreview();
        break;

      case 'error':
        this.hideStreaming();
        this.addMessage(data.message, 'error');
        this.updateStatus('connected', 'Connected');
        this.isProcessing = false;
        this.sendButton.disabled = false;
        this.stopButton.classList.add('hidden');
        break;

      case 'cancelled':
        this.hideStreaming();
        this.addMessage('Stopped', 'system');
        this.updateStatus('connected', 'Connected');
        this.isProcessing = false;
        this.sendButton.disabled = false;
        this.stopButton.classList.add('hidden');
        break;

      case 'versionsList':
        this.displayVersions(data.versions);
        break;

      case 'versionRestored':
        this.addMessage(`Restored to ${data.versionId}`, 'system');
        this.hideVersionPanel();
        this.refreshPreview();
        break;
    }
  }

  updateProjectList() {
    this.projectSelect.innerHTML = '<option value="">-- Select Project --</option>';
    this.projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      if (project.id === this.currentProjectId) {
        option.selected = true;
      }
      this.projectSelect.appendChild(option);
    });
  }

  selectProject(projectId) {
    if (!projectId) return;

    this.projectSelect.value = projectId;
    this.ws.send(JSON.stringify({
      type: 'selectProject',
      projectId
    }));
  }

  createNewProject() {
    const name = prompt('Enter project name:', 'New Game');
    if (name === null) return;

    this.ws.send(JSON.stringify({
      type: 'createProject',
      name: name || 'New Game'
    }));
  }

  updatePreviewVisibility(hasProject) {
    if (hasProject) {
      this.gamePreview.style.display = 'block';
      this.noProjectMessage.classList.add('hidden');
    } else {
      this.gamePreview.style.display = 'none';
      this.noProjectMessage.classList.remove('hidden');
      this.previewTitle.textContent = 'Preview';
      this.versionsButton.classList.add('hidden');
      this.hideVersionPanel();
    }
  }

  sendMessage() {
    const content = this.chatInput.value.trim();
    if (!content || this.isProcessing || !this.currentProjectId) return;

    this.addMessage(content, 'user');
    this.chatInput.value = '';

    this.ws.send(JSON.stringify({
      type: 'message',
      content
    }));
  }

  stopGeneration() {
    if (!this.isProcessing) return;

    this.ws.send(JSON.stringify({
      type: 'cancel'
    }));
  }

  addMessage(content, role) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const formattedContent = this.formatContent(content);
    messageDiv.innerHTML = formattedContent;

    this.chatMessages.appendChild(messageDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  formatContent(content) {
    let escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    escaped = escaped.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
    escaped = escaped.replace(/\n/g, '<br>');

    return escaped;
  }

  refreshPreview() {
    if (this.visitorId && this.currentProjectId) {
      const timestamp = Date.now();
      this.gamePreview.src = `/game/${this.visitorId}/${this.currentProjectId}/index.html?t=${timestamp}`;
    }
  }

  updateStatus(className, text) {
    this.statusIndicator.className = `status-indicator ${className}`;
    this.statusIndicator.textContent = text;
  }

  // Version methods
  toggleVersionPanel() {
    if (this.versionPanel.classList.contains('hidden')) {
      this.showVersionPanel();
    } else {
      this.hideVersionPanel();
    }
  }

  showVersionPanel() {
    if (!this.currentProjectId) return;

    this.ws.send(JSON.stringify({
      type: 'getVersions',
      projectId: this.currentProjectId
    }));

    this.versionPanel.classList.remove('hidden');
  }

  hideVersionPanel() {
    this.versionPanel.classList.add('hidden');
  }

  displayVersions(versions) {
    this.versionList.innerHTML = '';

    if (versions.length === 0) {
      this.versionList.innerHTML = '<div class="version-item"><span style="color:#666">No versions yet</span></div>';
      return;
    }

    versions.forEach(v => {
      const item = document.createElement('div');
      item.className = 'version-item';

      const time = new Date(v.timestamp).toLocaleString('ja-JP', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Format size
      const sizeKB = (v.size / 1024).toFixed(1);
      const isSmall = v.size < 1000;

      item.innerHTML = `
        <div class="version-info">
          <span class="version-id">${v.id} <span style="color:${isSmall ? '#666' : '#4fc3f7'};font-size:0.7rem">(${sizeKB}KB)</span></span>
          <span class="version-message">${v.message}</span>
          <span class="version-time">${time}</span>
        </div>
        <button class="version-restore" data-version="${v.id}" ${isSmall ? 'style="opacity:0.5"' : ''}>Restore</button>
      `;

      item.querySelector('.version-restore').addEventListener('click', () => {
        this.restoreVersion(v.id);
      });

      this.versionList.appendChild(item);
    });
  }

  restoreVersion(versionId) {
    if (!this.currentProjectId) return;

    if (!confirm(`Restore to ${versionId}? Current state will be saved as a new version.`)) {
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'restoreVersion',
      projectId: this.currentProjectId,
      versionId
    }));
  }

  // Streaming methods
  showStreaming() {
    this.streamingText = '';
    this.streamingOutput.innerHTML = '<span class="cursor"></span>';
    this.streamingStatus.textContent = 'Generating...';
    this.streamingStatus.className = 'streaming-status';
    this.streamingFile.textContent = 'index.html';
    this.streamingContainer.classList.remove('hidden');
    this.typewriterQueue = [];
    this.isTyping = false;
    console.log('Streaming started');
  }

  hideStreaming() {
    this.streamingContainer.classList.add('hidden');
    this.typewriterQueue = [];
    this.isTyping = false;
  }

  completeStreaming() {
    this.streamingStatus.textContent = 'Complete';
    this.streamingStatus.className = 'streaming-status completed';

    // Remove cursor
    const cursor = this.streamingOutput.querySelector('.cursor');
    if (cursor) cursor.remove();

    // Hide after delay
    setTimeout(() => {
      this.hideStreaming();
    }, 2000);
  }

  updateStreamingFile(filename, status) {
    if (status === 'editing') {
      this.streamingFile.textContent = `editing ${filename}...`;
    } else if (status === 'completed') {
      this.streamingFile.textContent = `${filename}`;
    }
  }

  appendToStream(content) {
    console.log('Stream received:', content);
    // Add content to queue for typewriter effect
    this.typewriterQueue.push(...content.split(''));

    if (!this.isTyping) {
      this.processTypewriterQueue();
    }
  }

  processTypewriterQueue() {
    if (this.typewriterQueue.length === 0) {
      this.isTyping = false;
      return;
    }

    this.isTyping = true;

    // Process multiple characters at once for speed
    const charsToProcess = Math.min(5, this.typewriterQueue.length);
    let newText = '';

    for (let i = 0; i < charsToProcess; i++) {
      newText += this.typewriterQueue.shift();
    }

    this.streamingText += newText;

    // Update display (keep only last 2000 chars for performance)
    const displayText = this.streamingText.length > 2000
      ? '...' + this.streamingText.slice(-2000)
      : this.streamingText;

    // Escape HTML and add cursor
    const escaped = displayText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    this.streamingOutput.innerHTML = escaped + '<span class="cursor"></span>';

    // Auto-scroll to bottom
    this.streamingOutput.scrollTop = this.streamingOutput.scrollHeight;

    // Continue processing with slight delay for animation effect
    setTimeout(() => this.processTypewriterQueue(), 10);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new GameCreatorApp();
});
