const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const userManager = require('./userManager');
const { claudeRunner } = require('./claudeRunner');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve project game files
app.get('/game/:visitorId/:projectId/*', (req, res) => {
  const { visitorId, projectId } = req.params;
  const filename = req.params[0] || 'index.html';
  const content = userManager.readProjectFile(visitorId, projectId, filename);

  if (content) {
    const ext = path.extname(filename);
    const contentTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif'
    };
    res.type(contentTypes[ext] || 'text/plain');
    res.send(content);
  } else {
    res.status(404).send('File not found');
  }
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  let visitorId = null;
  let currentProjectId = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'init':
          // Initialize or reconnect visitor
          visitorId = userManager.getOrCreateUser(data.visitorId);
          const projects = userManager.getProjects(visitorId);

          ws.send(JSON.stringify({
            type: 'init',
            visitorId,
            projects
          }));
          break;

        case 'selectProject':
          if (!visitorId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not initialized' }));
            return;
          }
          currentProjectId = data.projectId;
          const history = userManager.getConversationHistory(visitorId, currentProjectId);
          ws.send(JSON.stringify({
            type: 'projectSelected',
            projectId: currentProjectId,
            history
          }));
          break;

        case 'createProject':
          if (!visitorId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not initialized' }));
            return;
          }
          const newProject = userManager.createProject(visitorId, data.name);
          currentProjectId = newProject.id;
          ws.send(JSON.stringify({
            type: 'projectCreated',
            project: newProject,
            projects: userManager.getProjects(visitorId)
          }));
          break;

        case 'deleteProject':
          if (!visitorId || !data.projectId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid request' }));
            return;
          }
          userManager.deleteProject(visitorId, data.projectId);
          if (currentProjectId === data.projectId) {
            currentProjectId = null;
          }
          ws.send(JSON.stringify({
            type: 'projectDeleted',
            projectId: data.projectId,
            projects: userManager.getProjects(visitorId)
          }));
          break;

        case 'renameProject':
          if (!visitorId || !data.projectId || !data.name) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid request' }));
            return;
          }
          const renamedProject = userManager.renameProject(visitorId, data.projectId, data.name);
          ws.send(JSON.stringify({
            type: 'projectRenamed',
            project: renamedProject,
            projects: userManager.getProjects(visitorId)
          }));
          break;

        case 'message':
          if (!visitorId || !currentProjectId) {
            ws.send(JSON.stringify({ type: 'error', message: 'No project selected' }));
            return;
          }

          const userMessage = data.content;
          userManager.addToHistory(visitorId, currentProjectId, 'user', userMessage);

          ws.send(JSON.stringify({ type: 'status', message: 'Processing...' }));

          try {
            const result = await claudeRunner.runClaude(
              visitorId,
              currentProjectId,
              userMessage,
              (progress) => {
                ws.send(JSON.stringify(progress));
              }
            );

            // Create version snapshot AFTER successful update
            userManager.createVersionSnapshot(visitorId, currentProjectId, userMessage.substring(0, 50));

            userManager.addToHistory(visitorId, currentProjectId, 'assistant', result.output ? 'ゲームを更新しました' : '');
            ws.send(JSON.stringify({
              type: 'gameUpdated',
              visitorId,
              projectId: currentProjectId
            }));
          } catch (error) {
            userManager.addToHistory(visitorId, currentProjectId, 'assistant', `Error: ${error.message}`);
            ws.send(JSON.stringify({
              type: 'error',
              message: error.message
            }));
          }
          break;

        case 'getVersions':
          if (!visitorId || !data.projectId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid request' }));
            return;
          }
          const versions = userManager.getVersions(visitorId, data.projectId);
          ws.send(JSON.stringify({
            type: 'versionsList',
            projectId: data.projectId,
            versions
          }));
          break;

        case 'restoreVersion':
          if (!visitorId || !data.projectId || !data.versionId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid request' }));
            return;
          }
          const restoreResult = userManager.restoreVersion(visitorId, data.projectId, data.versionId);
          if (restoreResult.success) {
            ws.send(JSON.stringify({
              type: 'versionRestored',
              projectId: data.projectId,
              versionId: data.versionId
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: restoreResult.error
            }));
          }
          break;

        case 'cancel':
          if (visitorId && currentProjectId) {
            claudeRunner.cancelRun(`${visitorId}-${currentProjectId}`);
            ws.send(JSON.stringify({ type: 'cancelled', message: 'Operation cancelled' }));
          }
          break;

        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected:', visitorId);
  });
});

server.listen(PORT, () => {
  console.log(`Game Creator MVP running at http://localhost:${PORT}`);
});
