const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const USERS_DIR = path.join(__dirname, '..', 'users');

// Ensure users directory exists
if (!fs.existsSync(USERS_DIR)) {
  fs.mkdirSync(USERS_DIR, { recursive: true });
}

const INITIAL_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Game</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: sans-serif;
      background: #1a1a2e;
      color: white;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .welcome {
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="welcome">
    <h1>Welcome to Game Creator!</h1>
    <p>Send a message to start creating your game.</p>
  </div>
</body>
</html>`;

class UserManager {
  constructor() {
    this.sessions = new Map();
    this.initUsersGit();
  }

  // === Git Helper Methods ===

  execGit(command, cwd) {
    try {
      return execSync(command, {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
    } catch (error) {
      console.error(`Git error in ${cwd}:`, error.message);
      return null;
    }
  }

  // Initialize Git for users/ folder (global activity log)
  initUsersGit() {
    const gitDir = path.join(USERS_DIR, '.git');
    if (!fs.existsSync(gitDir)) {
      console.log('Initializing Git for users/ folder...');
      this.execGit('git init', USERS_DIR);
      this.execGit('git config user.email "gamecreator@local"', USERS_DIR);
      this.execGit('git config user.name "GameCreator"', USERS_DIR);

      // Create .gitignore to exclude project .git folders
      const gitignore = path.join(USERS_DIR, '.gitignore');
      fs.writeFileSync(gitignore, '# Exclude project-level git\n*/*/.git/\n');

      this.execGit('git add -A', USERS_DIR);
      this.execGit('git commit -m "Initial commit" --allow-empty', USERS_DIR);
      console.log('Users Git initialized');
    }
  }

  // Initialize Git for a project
  initProjectGit(projectDir) {
    const gitDir = path.join(projectDir, '.git');
    if (!fs.existsSync(gitDir)) {
      this.execGit('git init', projectDir);
      this.execGit('git config user.email "gamecreator@local"', projectDir);
      this.execGit('git config user.name "GameCreator"', projectDir);
      return true;
    }
    return false;
  }

  // Commit to users/ folder (global log)
  commitToUsers(message) {
    this.execGit('git add -A', USERS_DIR);
    const result = this.execGit(`git commit -m "${message.replace(/"/g, '\\"')}" --allow-empty`, USERS_DIR);
    if (result) {
      console.log('Users commit:', message);
    }
  }

  // Commit to project folder
  commitToProject(projectDir, message) {
    // Skip if no changes
    const status = this.execGit('git status --porcelain', projectDir);
    if (!status) return null;

    this.execGit('git add -A', projectDir);
    const result = this.execGit(`git commit -m "${message.replace(/"/g, '\\"')}"`, projectDir);

    if (result) {
      // Get the commit hash
      const hash = this.execGit('git rev-parse --short HEAD', projectDir);
      console.log('Project commit:', hash, message);
      return hash;
    }
    return null;
  }

  // === User Management ===

  getOrCreateUser(visitorId) {
    if (!visitorId) {
      visitorId = uuidv4();
    }

    const userDir = path.join(USERS_DIR, visitorId);
    const projectsFile = path.join(userDir, 'projects.json');
    const isNew = !fs.existsSync(userDir);

    if (isNew) {
      fs.mkdirSync(userDir, { recursive: true });
      fs.writeFileSync(projectsFile, JSON.stringify({ projects: [] }, null, 2));

      // Commit to users/ git
      this.commitToUsers(`New user: ${visitorId}`);
    }

    return visitorId;
  }

  // === Project Management ===

  getProjects(visitorId) {
    const projectsFile = path.join(USERS_DIR, visitorId, 'projects.json');
    if (fs.existsSync(projectsFile)) {
      const data = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
      return data.projects || [];
    }
    return [];
  }

  createProject(visitorId, name) {
    const projectId = uuidv4();
    const projectDir = path.join(USERS_DIR, visitorId, projectId);
    const projectsFile = path.join(USERS_DIR, visitorId, 'projects.json');

    // Create project directory
    fs.mkdirSync(projectDir, { recursive: true });

    // Create initial game file
    fs.writeFileSync(path.join(projectDir, 'index.html'), INITIAL_HTML);

    // Initialize project Git
    this.initProjectGit(projectDir);
    this.commitToProject(projectDir, 'Initial project setup');

    // Update projects list
    const data = fs.existsSync(projectsFile)
      ? JSON.parse(fs.readFileSync(projectsFile, 'utf-8'))
      : { projects: [] };

    const project = {
      id: projectId,
      name: name || 'New Game',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    data.projects.unshift(project);
    fs.writeFileSync(projectsFile, JSON.stringify(data, null, 2));

    // Commit to users/ git
    this.commitToUsers(`New project: ${name || 'New Game'} (${visitorId}/${projectId})`);

    // Initialize session
    this.sessions.set(`${visitorId}-${projectId}`, {
      conversationHistory: [],
      createdAt: new Date().toISOString()
    });

    return project;
  }

  deleteProject(visitorId, projectId) {
    const projectDir = path.join(USERS_DIR, visitorId, projectId);
    const projectsFile = path.join(USERS_DIR, visitorId, 'projects.json');

    // Get project name for commit message
    let projectName = projectId;
    if (fs.existsSync(projectsFile)) {
      const data = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
      const project = data.projects.find(p => p.id === projectId);
      if (project) projectName = project.name;
    }

    // Remove project directory
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true });
    }

    // Update projects list
    if (fs.existsSync(projectsFile)) {
      const data = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
      data.projects = data.projects.filter(p => p.id !== projectId);
      fs.writeFileSync(projectsFile, JSON.stringify(data, null, 2));
    }

    // Commit to users/ git
    this.commitToUsers(`Deleted project: ${projectName}`);

    // Clear session
    this.sessions.delete(`${visitorId}-${projectId}`);
  }

  renameProject(visitorId, projectId, newName) {
    const projectsFile = path.join(USERS_DIR, visitorId, 'projects.json');
    if (fs.existsSync(projectsFile)) {
      const data = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
      const project = data.projects.find(p => p.id === projectId);
      if (project) {
        const oldName = project.name;
        project.name = newName;
        project.updatedAt = new Date().toISOString();
        fs.writeFileSync(projectsFile, JSON.stringify(data, null, 2));

        // Commit to users/ git
        this.commitToUsers(`Renamed project: ${oldName} -> ${newName}`);

        return project;
      }
    }
    return null;
  }

  // === Session & History Management ===

  getSessionKey(visitorId, projectId) {
    return `${visitorId}-${projectId}`;
  }

  getSession(visitorId, projectId) {
    const key = this.getSessionKey(visitorId, projectId);
    if (!this.sessions.has(key)) {
      const history = this.loadChatHistory(visitorId, projectId);
      this.sessions.set(key, {
        conversationHistory: history,
        createdAt: new Date().toISOString()
      });
    }
    return this.sessions.get(key);
  }

  loadChatHistory(visitorId, projectId) {
    const historyFile = path.join(USERS_DIR, visitorId, projectId, 'chat-history.json');
    if (fs.existsSync(historyFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
        return data.history || [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  saveChatHistory(visitorId, projectId) {
    const session = this.sessions.get(this.getSessionKey(visitorId, projectId));
    if (!session) return;

    const historyFile = path.join(USERS_DIR, visitorId, projectId, 'chat-history.json');
    const data = {
      history: session.conversationHistory,
      savedAt: new Date().toISOString()
    };
    fs.writeFileSync(historyFile, JSON.stringify(data, null, 2));
  }

  getProjectDir(visitorId, projectId) {
    return path.join(USERS_DIR, visitorId, projectId);
  }

  addToHistory(visitorId, projectId, role, content) {
    const session = this.getSession(visitorId, projectId);
    if (session) {
      session.conversationHistory.push({
        role,
        content,
        timestamp: new Date().toISOString()
      });
      this.saveChatHistory(visitorId, projectId);
    }
    this.updateProjectTimestamp(visitorId, projectId);
  }

  updateProjectTimestamp(visitorId, projectId) {
    const projectsFile = path.join(USERS_DIR, visitorId, 'projects.json');
    if (fs.existsSync(projectsFile)) {
      const data = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
      const project = data.projects.find(p => p.id === projectId);
      if (project) {
        project.updatedAt = new Date().toISOString();
        fs.writeFileSync(projectsFile, JSON.stringify(data, null, 2));
      }
    }
  }

  getConversationHistory(visitorId, projectId, limit = 50) {
    const session = this.getSession(visitorId, projectId);
    if (!session) return [];
    const history = session.conversationHistory;
    return history.length > limit ? history.slice(-limit) : history;
  }

  getFullHistoryForContext(visitorId, projectId, maxItems = 20) {
    const session = this.getSession(visitorId, projectId);
    if (!session) return [];
    const history = session.conversationHistory;
    return history.length > maxItems ? history.slice(-maxItems) : history;
  }

  // === File Operations ===

  readProjectFile(visitorId, projectId, filename) {
    const filePath = path.join(USERS_DIR, visitorId, projectId, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
  }

  writeProjectFile(visitorId, projectId, filename, content) {
    const filePath = path.join(USERS_DIR, visitorId, projectId, filename);
    fs.writeFileSync(filePath, content);
  }

  listProjectFiles(visitorId, projectId) {
    const projectDir = path.join(USERS_DIR, visitorId, projectId);
    if (fs.existsSync(projectDir)) {
      return fs.readdirSync(projectDir).filter(f => {
        if (f.startsWith('.')) return false;
        const filePath = path.join(projectDir, f);
        if (fs.statSync(filePath).isDirectory()) return false;
        if (f.endsWith('.json')) return false;
        return true;
      });
    }
    return [];
  }

  // === Git-based Version Management ===

  // Create a version (Git commit) after code update
  createVersionSnapshot(visitorId, projectId, message = '') {
    const projectDir = path.join(USERS_DIR, visitorId, projectId);
    const indexPath = path.join(projectDir, 'index.html');

    if (!fs.existsSync(indexPath)) return null;

    const content = fs.readFileSync(indexPath, 'utf-8');

    // Skip if it's just the initial welcome page
    if (content.length < 1000 && content.includes('Welcome to Game Creator')) {
      return null;
    }

    // Commit to project Git
    const hash = this.commitToProject(projectDir, message || 'Update');

    if (hash) {
      // Also commit to users/ for global log
      this.commitToUsers(`Update: ${message} (${visitorId}/${projectId})`);
      return { id: hash, message };
    }

    return null;
  }

  // Get list of versions from Git log
  getVersions(visitorId, projectId) {
    const projectDir = path.join(USERS_DIR, visitorId, projectId);

    if (!fs.existsSync(path.join(projectDir, '.git'))) {
      return [];
    }

    // Get git log with hash, message, timestamp
    const logOutput = this.execGit(
      'git log --pretty=format:"%h|%s|%ai" -50',
      projectDir
    );

    if (!logOutput) return [];

    // Filter out restore-related commits
    const restorePatterns = ['Before restore', 'Restored to', 'Initial project setup', 'Migration from'];

    const allCommits = logOutput.split('\n').filter(line => line.trim());

    const versions = [];
    let versionNum = 1;

    for (const line of allCommits) {
      const [hash, message, timestamp] = line.split('|');

      // Skip restore-related commits
      const isRestoreCommit = restorePatterns.some(pattern =>
        message && message.includes(pattern)
      );

      if (!isRestoreCommit) {
        versions.push({
          id: hash,
          number: versionNum++,
          message: message || 'Update',
          timestamp: new Date(timestamp).toISOString(),
          hash
        });
      }
    }

    // Limit to 20 versions for display
    return versions.slice(0, 20);
  }

  // Restore a specific version using Git
  restoreVersion(visitorId, projectId, versionId) {
    const projectDir = path.join(USERS_DIR, visitorId, projectId);

    if (!fs.existsSync(path.join(projectDir, '.git'))) {
      return { success: false, error: 'Git not initialized' };
    }

    // First, commit current state as backup
    this.commitToProject(projectDir, 'Before restore');

    // Checkout the specific version's files (not the whole commit)
    const result = this.execGit(`git checkout ${versionId} -- .`, projectDir);

    if (result !== null) {
      // Commit the restored state
      this.commitToProject(projectDir, `Restored to ${versionId}`);
      this.commitToUsers(`Restored: ${versionId} (${visitorId}/${projectId})`);

      return { success: true, versionId };
    }

    return { success: false, error: 'Failed to restore version' };
  }
}

module.exports = new UserManager();
