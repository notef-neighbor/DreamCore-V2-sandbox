const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const userManager = require('./userManager');

// Skills configuration with keywords for auto-detection
const SKILLS_CONFIG = {
  'p5js': {
    keywords: ['2d', 'p5', 'キャンバス', 'canvas', 'シューティング', 'shooting', 'アクション', 'ブロック崩し', 'breakout', 'パドル', 'paddle', 'ボール', 'ball', 'スプライト', 'sprite', '当たり判定', 'collision', 'ゲームループ', 'game loop', 'クリエイティブ'],
    priority: 1
  },
  'threejs': {
    keywords: ['3d', 'three', '立体', 'キューブ', 'cube', '球', 'sphere', 'カメラ', 'camera', 'ライト', 'light', '物理', 'physics', 'レーシング', 'racing', 'fps', 'ファーストパーソン'],
    priority: 2
  },
  'game-audio': {
    keywords: ['音', 'sound', 'サウンド', 'bgm', '効果音', 'se', 'music', '音楽', 'オーディオ', 'audio', 'howler'],
    priority: 3
  },
  'game-ai': {
    keywords: ['ai', '敵', 'enemy', 'npc', '追いかけ', 'chase', '逃げる', 'flee', 'パスファインディング', 'pathfinding', 'ステートマシン', 'state machine', '巡回', 'patrol', 'yuka'],
    priority: 4
  },
  'tween-animation': {
    keywords: ['アニメーション', 'animation', 'tween', 'gsap', 'イージング', 'easing', 'フェード', 'fade', 'スライド', 'slide', 'スコア演出', 'ui animation', '滑らか'],
    priority: 5
  },
  'particles': {
    keywords: ['パーティクル', 'particle', '爆発', 'explosion', '紙吹雪', 'confetti', '花火', 'firework', '雪', 'snow', '火', 'fire', '火花', 'spark', 'エフェクト', 'effect', 'tsparticles'],
    priority: 6
  }
};

class ClaudeRunner {
  constructor() {
    this.runningProcesses = new Map();
    this.skillsDir = path.join(__dirname, '..', '.claude', 'skills');
    this.skillsCache = new Map();
    this.loadSkills();
  }

  // Load all skills from .claude/skills/
  loadSkills() {
    try {
      if (!fs.existsSync(this.skillsDir)) {
        console.log('Skills directory not found:', this.skillsDir);
        return;
      }

      const skillFolders = fs.readdirSync(this.skillsDir).filter(f => {
        const stat = fs.statSync(path.join(this.skillsDir, f));
        return stat.isDirectory();
      });

      for (const skillName of skillFolders) {
        const skillPath = path.join(this.skillsDir, skillName, 'SKILL.md');
        if (fs.existsSync(skillPath)) {
          const content = fs.readFileSync(skillPath, 'utf-8');
          this.skillsCache.set(skillName, content);
          console.log(`Loaded skill: ${skillName}`);
        }
      }

      console.log(`Total skills loaded: ${this.skillsCache.size}`);
    } catch (error) {
      console.error('Error loading skills:', error);
    }
  }

  // Auto-detect which skills to use based on user message
  detectSkills(userMessage, conversationHistory = []) {
    const detectedSkills = [];
    const messageLower = userMessage.toLowerCase();

    // Also check recent conversation history
    const recentHistory = conversationHistory.slice(-5).map(h => h.content.toLowerCase()).join(' ');
    const fullContext = messageLower + ' ' + recentHistory;

    for (const [skillName, config] of Object.entries(SKILLS_CONFIG)) {
      if (!this.skillsCache.has(skillName)) continue;

      const matchCount = config.keywords.filter(keyword =>
        fullContext.includes(keyword.toLowerCase())
      ).length;

      if (matchCount > 0) {
        detectedSkills.push({
          name: skillName,
          matchCount,
          priority: config.priority
        });
      }
    }

    // Sort by match count (desc), then priority (asc)
    detectedSkills.sort((a, b) => {
      if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
      return a.priority - b.priority;
    });

    // Return top 2 skills max to avoid overwhelming the prompt
    return detectedSkills.slice(0, 2).map(s => s.name);
  }

  // Get skill content for prompt
  getSkillsContent(skillNames) {
    if (skillNames.length === 0) return '';

    let content = '\n\n=== 利用可能なライブラリとパターン ===\n';
    content += '以下のライブラリを使用してください：\n\n';

    for (const skillName of skillNames) {
      const skillContent = this.skillsCache.get(skillName);
      if (skillContent) {
        content += `--- ${skillName} ---\n${skillContent}\n\n`;
      }
    }

    return content;
  }

  async runClaude(visitorId, projectId, userMessage, onProgress) {
    const projectDir = userManager.getProjectDir(visitorId, projectId);
    const history = userManager.getConversationHistory(visitorId, projectId);

    // Build context from conversation history
    const contextMessages = history.map(h => `${h.role}: ${h.content}`).join('\n');

    // Read current files
    const files = userManager.listProjectFiles(visitorId, projectId);
    const currentCode = files.map(f => {
      const content = userManager.readProjectFile(visitorId, projectId, f);
      return `--- ${f} ---\n${content}`;
    }).join('\n\n');

    // Auto-detect and load relevant skills
    const detectedSkills = this.detectSkills(userMessage, history);
    const skillsContent = this.getSkillsContent(detectedSkills);

    if (detectedSkills.length > 0) {
      console.log('Detected skills:', detectedSkills.join(', '));
      onProgress({ type: 'info', message: `使用スキル: ${detectedSkills.join(', ')}` });
    }

    // Build the prompt for Claude Code
    const prompt = `あなたはブラウザゲーム開発アシスタントです。
ユーザーの指示に従って、HTMLファイル（index.html）を作成・更新してください。

重要なルール:
1. ゲームは単一のHTMLファイル(index.html)で完結させてください
2. CSS、JavaScriptはHTMLファイル内に含めてください
3. 既存のコードがある場合は、必要な部分だけを変更してください
4. コードは実際に動作するものを出力してください
5. 日本語でコメントを書いてください
6. 提供されたライブラリドキュメントがある場合は、そのパターンとCDNを使用してください
${skillsContent}
現在のファイル:
${currentCode || '(まだファイルがありません)'}

${contextMessages ? `会話履歴:\n${contextMessages}\n` : ''}

ユーザーの指示: ${userMessage}

index.htmlファイルを更新してください。`;

    return new Promise((resolve, reject) => {
      onProgress({ type: 'status', message: 'Claude Codeを実行中...' });

      console.log('Running Claude in:', projectDir);
      console.log('Prompt length:', prompt.length);

      // Use stdin to pass long prompts with streaming JSON output
      const claude = spawn('claude', [
        '--print',
        '--verbose',
        '--output-format', 'stream-json',
        '--include-partial-messages',
        '--dangerously-skip-permissions'
      ], {
        cwd: projectDir,
        env: { ...process.env, PATH: process.env.PATH },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Write prompt to stdin
      claude.stdin.write(prompt);
      claude.stdin.end();

      let output = '';
      let errorOutput = '';

      let buffer = '';

      claude.stdout.on('data', (data) => {
        buffer += data.toString();

        // Process complete JSON lines
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const json = JSON.parse(line);
            console.log('Claude event:', json.type, json.subtype || '');

            // Handle stream_event wrapper (Claude CLI wraps events in stream_event)
            let event = json;
            if (json.type === 'stream_event' && json.event) {
              event = json.event;
              // Log tool usage
              if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
                console.log('  Tool:', event.content_block.name);
                onProgress({ type: 'stream', content: `\n[${event.content_block.name}]\n` });
              }
            }

            // Handle different event types
            if (event.type === 'assistant' && event.message) {
              // Assistant message with content
              if (event.message.content) {
                for (const block of event.message.content) {
                  if (block.type === 'text' && block.text) {
                    onProgress({ type: 'stream', content: block.text });
                  } else if (block.type === 'tool_use') {
                    // Tool being used (file edit, etc.)
                    const toolName = block.name || 'unknown';
                    if (toolName === 'Write' || toolName === 'Edit') {
                      const filename = block.input?.file_path?.split('/').pop() || 'index.html';
                      onProgress({ type: 'fileEdit', filename, status: 'editing' });
                    }
                    onProgress({ type: 'stream', content: `\n[${toolName}]\n` });
                  }
                }
              }
            } else if (event.type === 'content_block_delta' && event.delta) {
              // Streaming text delta
              if (event.delta.type === 'text_delta' && event.delta.text) {
                onProgress({ type: 'stream', content: event.delta.text });
              } else if (event.delta.type === 'input_json_delta' && event.delta.partial_json) {
                // Tool input streaming - show partial JSON
                onProgress({ type: 'stream', content: event.delta.partial_json });
              }
            } else if (event.type === 'content_block_start' && event.content_block) {
              // Content block starting
              if (event.content_block.type === 'text' && event.content_block.text) {
                onProgress({ type: 'stream', content: event.content_block.text });
              } else if (event.content_block.type === 'tool_use') {
                const toolName = event.content_block.name || 'tool';
                onProgress({ type: 'stream', content: `\n[${toolName}]\n` });
              }
            } else if (event.type === 'result' && event.result) {
              // Final result - store for later
              output = event.result;
              console.log('Result received, length:', output.length);
            } else if (json.type === 'result' && json.result) {
              // Result at top level
              output = json.result;
              console.log('Top-level result received, length:', output.length);
            }
          } catch (e) {
            // Not JSON, treat as plain text
            onProgress({ type: 'stream', content: line });
          }
        }
      });

      claude.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        console.log('Claude stderr:', text);
      });

      claude.on('close', (code) => {
        console.log('Claude exited with code:', code);
        console.log('Output length:', output.length);

        const processKey = `${visitorId}-${projectId}`;
        this.runningProcesses.delete(processKey);

        if (code === 0) {
          // Claude CLI may have edited files directly
          // Check if index.html was updated by reading it
          const currentHtml = userManager.readProjectFile(visitorId, projectId, 'index.html');

          // Extract HTML from Claude's response if present
          const htmlMatch = output.match(/```html\n([\s\S]*?)```/);
          if (htmlMatch) {
            const htmlContent = htmlMatch[1];
            userManager.writeProjectFile(visitorId, projectId, 'index.html', htmlContent);
          }

          // Always report success if Claude exited normally
          const responseMsg = output.trim() || 'ゲームを更新しました';
          onProgress({ type: 'complete', message: responseMsg });
          resolve({ success: true, output: currentHtml });
        } else {
          const errorMsg = errorOutput || output || 'Unknown error';
          onProgress({ type: 'error', message: `エラーが発生しました: ${errorMsg}` });
          reject(new Error(errorMsg));
        }
      });

      claude.on('error', (err) => {
        console.log('Claude process error:', err);
        onProgress({ type: 'error', message: `プロセスエラー: ${err.message}` });
        reject(err);
      });

      // Store process reference for potential cancellation
      this.runningProcesses.set(`${visitorId}-${projectId}`, claude);
    });
  }

  cancelRun(userId) {
    const process = this.runningProcesses.get(userId);
    if (process) {
      process.kill();
      this.runningProcesses.delete(userId);
      return true;
    }
    return false;
  }
}

// Stub for Gemini API (future expansion)
class GeminiRunner {
  async run(prompt) {
    console.log('Gemini API stub called with:', prompt);
    return { success: false, message: 'Gemini API is not yet implemented' };
  }
}

// Stub for image generation (future expansion)
class ImageGenerator {
  async generate(prompt) {
    console.log('Image generation stub called with:', prompt);
    return { success: false, message: 'Image generation is not yet implemented' };
  }
}

module.exports = {
  claudeRunner: new ClaudeRunner(),
  geminiRunner: new GeminiRunner(),
  imageGenerator: new ImageGenerator()
};
