# DreamCore 無料ユーザー制限 & Analytics 設計書

## 概要

本ドキュメントは、DreamCore の無料ユーザー制限機能およびデータ分析基盤の設計をまとめたものです。

---

## 1. 無料ユーザー制限

### 1.1 制限値

| 項目 | 無料プラン | 有料プラン（参考） |
|------|-----------|-------------------|
| **日次プロジェクト作成** | 3回/日 | 無制限 |
| **日次メッセージ（修正）** | 20回/日 | 無制限 or 100回/日 |
| **プロジェクト総数** | 無制限 | 無制限 |
| **履歴保持期間** | 無制限 | 無制限 |

### 1.2 制限の根拠

- **新規プロジェクト作成**: ゼロからゲームを生成するため、トークン消費が大きい（入力~8,000 + 出力~10,000トークン）
- **メッセージ（修正）**: 差分修正のため比較的低コスト（入力~5,000 + 出力~3,000トークン）

### 1.3 コスト試算（Claude 3.5 Sonnet基準）

| 操作 | 1回あたりコスト |
|------|----------------|
| 新規プロジェクト作成 | 約 $0.17（約26円） |
| メッセージ（修正） | 約 $0.06（約9円） |

**日次制限フル利用時:**
- プロジェクト作成 3回: $0.51
- メッセージ 20回: $1.20
- **日次合計: 約 $1.71（約260円）**
- **月間（毎日フル利用）: 約 $51（約7,700円）/ユーザー**

### 1.4 リセットタイミング

- **日次リセット**: 毎日 00:00 UTC（日本時間 09:00）

---

## 2. アーキテクチャ

### 2.1 全体構成

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
├─────────────────────────────────────────────────────────────┤
│  各ページ                                                    │
│  └── <script src="/analytics.js"></script>  ← 1行追加のみ   │
│                                                             │
│  analytics.js（SDK）                                        │
│  ├── 自動: セッション開始、ページビュー、デバイス情報         │
│  └── 手動: DreamCoreAnalytics.track('event', {data})        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼ POST /api/analytics/*
┌─────────────────────────────────────────────────────────────┐
│                        Backend                              │
├─────────────────────────────────────────────────────────────┤
│  analyticsMiddleware.js                                     │
│  ├── 自動: IP, User-Agent, レスポンス時間                    │
│  └── 自動: API呼び出し記録                                  │
│                                                             │
│  quotaMiddleware.js                                         │
│  ├── 制限チェック（生成前）                                  │
│  └── 使用量カウントアップ（生成後）                          │
│                                                             │
│  server/routes/analytics.js                                 │
│  ├── POST /api/analytics/session                            │
│  └── POST /api/analytics/event                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Supabase (PostgreSQL)                   │
├─────────────────────────────────────────────────────────────┤
│  Phase 1: user_sessions, usage_logs, usage_quotas           │
│  Phase 2: game_plays, likes, follows, reports, etc.         │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 データフロー

```
[ユーザー操作]
      │
      ▼
[analytics.js] ──────────────────────────────┐
      │                                      │
      │ セッション/イベント送信                │
      ▼                                      │
[POST /api/analytics/*]                      │
      │                                      │
      ▼                                      │
[user_sessions] [events]                     │
                                             │
[ゲーム生成リクエスト] ◀─────────────────────┘
      │
      ▼
[quotaMiddleware]
      │
      ├── 制限超過 → 403 エラー返却
      │
      └── OK → [claudeRunner.js]
                    │
                    ▼
              [Claude API呼び出し]
                    │
                    ▼
              [usage_logs に記録]
              ├── model
              ├── operation
              ├── input_tokens
              ├── output_tokens
              ├── cost_usd
              ├── duration_ms
              └── status
```

---

## 3. データベーススキーマ

### Phase 1: 制限機能 & 基本Analytics（今回実装）

```sql
-- =====================================================
-- 3.1 ユーザーセッション
-- =====================================================
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),  -- NULL = 匿名

  -- 接続情報
  ip_address INET,
  country_code TEXT,                -- 'JP', 'US', etc（IP→国変換）

  -- デバイス・ブラウザ
  user_agent TEXT,
  device_type TEXT,                 -- 'desktop', 'mobile', 'tablet'
  browser TEXT,                     -- 'Chrome', 'Safari', etc
  os TEXT,                          -- 'Windows', 'macOS', 'iOS', etc

  -- 言語・地域
  language TEXT,                    -- 'ja', 'en', etc
  timezone TEXT,                    -- 'Asia/Tokyo'

  -- 画面
  screen_width INTEGER,
  screen_height INTEGER,

  -- 流入
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  -- セッション
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_started ON user_sessions(started_at);
CREATE INDEX idx_user_sessions_country ON user_sessions(country_code);

-- =====================================================
-- 3.2 API使用量ログ（トークン・コスト追跡）
-- =====================================================
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID REFERENCES user_sessions(id),
  project_id UUID REFERENCES projects(id),

  -- 操作情報
  model TEXT NOT NULL,              -- 'claude-opus', 'claude-sonnet', 'claude-haiku', 'gemini-pro', 'gemini-flash'
  operation TEXT NOT NULL,          -- 'generate', 'chat', 'intent_detect', 'skill_detect', 'image_generate', 'image_analyze'

  -- トークン・コスト
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd DECIMAL(10, 6),

  -- パフォーマンス
  duration_ms INTEGER,
  status TEXT NOT NULL,             -- 'success', 'failed', 'timeout', 'quota_exceeded'
  error_code TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_logs_user_date ON usage_logs(user_id, created_at);
CREATE INDEX idx_usage_logs_model ON usage_logs(model, created_at);
CREATE INDEX idx_usage_logs_status ON usage_logs(status);

-- =====================================================
-- 3.3 日次クォータ（制限管理）
-- =====================================================
CREATE TABLE usage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  quota_date DATE NOT NULL,         -- 日付（UTC）

  -- カウンター
  projects_created INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,

  -- メタ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, quota_date)
);

CREATE INDEX idx_usage_quotas_user_date ON usage_quotas(user_id, quota_date);

-- =====================================================
-- 3.4 サブスクリプション（tier管理）
-- =====================================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),

  -- プラン
  plan TEXT NOT NULL DEFAULT 'free', -- 'free', 'pro', 'team'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'past_due', 'trialing'

  -- Stripe連携（将来用）
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- 期間
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_plan ON subscriptions(plan);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- =====================================================
-- 3.5 汎用イベントログ（Analytics）
-- =====================================================
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  session_id UUID REFERENCES user_sessions(id),

  -- イベント
  event_name TEXT NOT NULL,         -- 'pageview', 'project_create', 'generate_start', etc
  event_data JSONB,                 -- 追加データ

  -- ページ情報
  page_path TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_user ON analytics_events(user_id, created_at);
CREATE INDEX idx_analytics_events_name ON analytics_events(event_name, created_at);
CREATE INDEX idx_analytics_events_session ON analytics_events(session_id);
```

### Phase 2: SNS/UGC機能（ゲーム公開時）

```sql
-- =====================================================
-- 3.6 ゲームプレイログ
-- =====================================================
CREATE TABLE game_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES projects(id),
  player_user_id UUID REFERENCES auth.users(id), -- NULL = 匿名プレイヤー
  session_id UUID REFERENCES user_sessions(id),

  -- プレイ情報
  duration_seconds INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  score INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_game_plays_game ON game_plays(game_id, created_at);
CREATE INDEX idx_game_plays_player ON game_plays(player_user_id);

-- =====================================================
-- 3.7 いいね
-- =====================================================
CREATE TABLE likes (
  user_id UUID NOT NULL REFERENCES auth.users(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

CREATE INDEX idx_likes_project ON likes(project_id);

-- =====================================================
-- 3.8 フォロー
-- =====================================================
CREATE TABLE follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id),
  following_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_following ON follows(following_id);

-- =====================================================
-- 3.9 コメント
-- =====================================================
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  parent_id UUID REFERENCES comments(id),  -- 返信の場合

  content TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_project ON comments(project_id, created_at);

-- =====================================================
-- 3.10 通報（モデレーション）
-- =====================================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id),

  -- 対象
  target_type TEXT NOT NULL,        -- 'project', 'user', 'comment'
  target_id UUID NOT NULL,

  -- 内容
  reason TEXT NOT NULL,             -- 'spam', 'inappropriate', 'copyright', 'harassment', 'other'
  details TEXT,

  -- ステータス
  status TEXT DEFAULT 'pending',    -- 'pending', 'reviewing', 'actioned', 'dismissed'
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  action_taken TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_status ON reports(status, created_at);
CREATE INDEX idx_reports_target ON reports(target_type, target_id);

-- =====================================================
-- 3.11 ユーザー制裁（BAN等）
-- =====================================================
CREATE TABLE user_sanctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- 制裁内容
  type TEXT NOT NULL,               -- 'warning', 'mute', 'suspend', 'ban'
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ,           -- NULL = 永久

  -- 管理
  issued_by UUID REFERENCES auth.users(id),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_sanctions_user ON user_sanctions(user_id);
CREATE INDEX idx_user_sanctions_active ON user_sanctions(user_id, expires_at)
  WHERE revoked_at IS NULL;

-- =====================================================
-- 3.12 検索ログ
-- =====================================================
CREATE TABLE search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  session_id UUID REFERENCES user_sessions(id),

  -- 検索情報
  query TEXT NOT NULL,
  filters JSONB,                    -- 検索フィルター
  results_count INTEGER,
  clicked_project_id UUID,          -- クリックされた結果

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_search_logs_query ON search_logs(query, created_at);

-- =====================================================
-- 3.13 通知
-- =====================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- 通知内容
  type TEXT NOT NULL,               -- 'like', 'follow', 'comment', 'mention', 'system'
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,                       -- リンク先等

  -- ステータス
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at)
  WHERE read_at IS NULL;
```

### Phase 3: 課金機能（将来）

```sql
-- =====================================================
-- 3.14 支払い履歴
-- =====================================================
CREATE TABLE payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  subscription_id UUID REFERENCES subscriptions(id),

  -- 金額
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'jpy',

  -- Stripe
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,

  -- ステータス
  status TEXT NOT NULL,             -- 'succeeded', 'failed', 'refunded', 'pending'
  failure_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_history_user ON payment_history(user_id, created_at);
CREATE INDEX idx_payment_history_status ON payment_history(status);
```

---

## 4. サーバーサイド実装

### 4.1 config.js への追加

```javascript
// server/config.js

// ==================== User Tier Limits ====================

const TIER_LIMITS = {
  free: {
    dailyProjectCreations: 3,
    dailyMessages: 20,
  },
  pro: {
    dailyProjectCreations: 100,
    dailyMessages: 500,
  },
  team: {
    dailyProjectCreations: -1,  // -1 = unlimited
    dailyMessages: -1,
  }
};

// ==================== Model Pricing (USD per 1M tokens) ====================

const MODEL_PRICING = {
  'claude-opus': { input: 15, output: 75 },
  'claude-sonnet': { input: 3, output: 15 },
  'claude-haiku': { input: 0.25, output: 1.25 },
  'gemini-pro': { input: 1.25, output: 5 },
  'gemini-flash': { input: 0.075, output: 0.3 },
};

module.exports = {
  // ... existing exports
  TIER_LIMITS,
  MODEL_PRICING,
};
```

### 4.2 quotaService.js

```javascript
// server/quotaService.js

const { supabaseAdmin } = require('./supabaseClient');
const { TIER_LIMITS } = require('./config');

/**
 * ユーザーのプランを取得
 */
async function getUserPlan(userId) {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .single();

  if (!data || data.status !== 'active') {
    return 'free';
  }
  return data.plan;
}

/**
 * 今日のクォータを取得（なければ作成）
 */
async function getTodayQuota(userId) {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabaseAdmin
    .from('usage_quotas')
    .select('*')
    .eq('user_id', userId)
    .eq('quota_date', today)
    .single();

  if (error && error.code === 'PGRST116') {
    // レコードがない場合は作成
    const { data: newQuota } = await supabaseAdmin
      .from('usage_quotas')
      .insert({ user_id: userId, quota_date: today })
      .select()
      .single();
    return newQuota;
  }

  return data;
}

/**
 * プロジェクト作成可能かチェック
 */
async function canCreateProject(userId) {
  const [plan, quota] = await Promise.all([
    getUserPlan(userId),
    getTodayQuota(userId)
  ]);

  const limit = TIER_LIMITS[plan].dailyProjectCreations;
  if (limit === -1) return { allowed: true, remaining: -1 };

  const remaining = limit - quota.projects_created;
  return {
    allowed: remaining > 0,
    remaining,
    limit,
    used: quota.projects_created
  };
}

/**
 * メッセージ送信可能かチェック
 */
async function canSendMessage(userId) {
  const [plan, quota] = await Promise.all([
    getUserPlan(userId),
    getTodayQuota(userId)
  ]);

  const limit = TIER_LIMITS[plan].dailyMessages;
  if (limit === -1) return { allowed: true, remaining: -1 };

  const remaining = limit - quota.messages_sent;
  return {
    allowed: remaining > 0,
    remaining,
    limit,
    used: quota.messages_sent
  };
}

/**
 * プロジェクト作成をカウント
 */
async function incrementProjectCount(userId) {
  const today = new Date().toISOString().split('T')[0];

  await supabaseAdmin.rpc('increment_quota', {
    p_user_id: userId,
    p_date: today,
    p_field: 'projects_created'
  });
}

/**
 * メッセージ送信をカウント
 */
async function incrementMessageCount(userId) {
  const today = new Date().toISOString().split('T')[0];

  await supabaseAdmin.rpc('increment_quota', {
    p_user_id: userId,
    p_date: today,
    p_field: 'messages_sent'
  });
}

module.exports = {
  getUserPlan,
  getTodayQuota,
  canCreateProject,
  canSendMessage,
  incrementProjectCount,
  incrementMessageCount
};
```

### 4.3 usageLogger.js

```javascript
// server/usageLogger.js

const { supabaseAdmin } = require('./supabaseClient');
const { MODEL_PRICING } = require('./config');

/**
 * トークン使用量からコストを計算
 */
function calculateCost(model, inputTokens, outputTokens) {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return null;

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * 使用量をログに記録
 */
async function logUsage({
  userId,
  sessionId,
  projectId,
  model,
  operation,
  inputTokens,
  outputTokens,
  durationMs,
  status,
  errorCode
}) {
  const costUsd = calculateCost(model, inputTokens, outputTokens);

  await supabaseAdmin
    .from('usage_logs')
    .insert({
      user_id: userId,
      session_id: sessionId,
      project_id: projectId,
      model,
      operation,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      duration_ms: durationMs,
      status,
      error_code: errorCode
    });
}

module.exports = {
  calculateCost,
  logUsage
};
```

### 4.4 analyticsMiddleware.js

```javascript
// server/analyticsMiddleware.js

const UAParser = require('ua-parser-js');
const { supabaseAdmin } = require('./supabaseClient');

/**
 * リクエスト情報を自動収集するミドルウェア
 */
function analyticsMiddleware(req, res, next) {
  req.startTime = Date.now();

  res.on('finish', async () => {
    // 静的ファイル、ヘルスチェック等は除外
    if (
      req.path.startsWith('/assets') ||
      req.path.startsWith('/analytics.js') ||
      req.path === '/health'
    ) {
      return;
    }

    try {
      const ua = new UAParser(req.headers['user-agent']);

      // APIリクエストのログ（必要に応じて）
      if (req.path.startsWith('/api/') && req.method !== 'GET') {
        await supabaseAdmin.from('analytics_events').insert({
          user_id: req.user?.id || null,
          session_id: req.headers['x-session-id'] || null,
          event_name: 'api_call',
          event_data: {
            method: req.method,
            path: req.path,
            status_code: res.statusCode,
            duration_ms: Date.now() - req.startTime
          },
          page_path: req.headers['referer']
        });
      }
    } catch (err) {
      console.error('Analytics middleware error:', err);
    }
  });

  next();
}

/**
 * セッション情報を解析
 */
function parseSessionInfo(req) {
  const ua = new UAParser(req.headers['user-agent']);

  return {
    ip_address: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
    user_agent: req.headers['user-agent'],
    device_type: ua.getDevice().type || 'desktop',
    browser: ua.getBrowser().name,
    os: ua.getOS().name,
    language: req.headers['accept-language']?.split(',')[0]?.split(';')[0]
  };
}

module.exports = {
  analyticsMiddleware,
  parseSessionInfo
};
```

### 4.5 routes/analytics.js

```javascript
// server/routes/analytics.js

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabaseClient');
const { parseSessionInfo } = require('../analyticsMiddleware');

/**
 * セッション開始/更新
 * POST /api/analytics/session
 */
router.post('/session', async (req, res) => {
  try {
    const { sessionId, screen, timezone, language, referrer, utm } = req.body;
    const serverInfo = parseSessionInfo(req);

    const sessionData = {
      id: sessionId,
      user_id: req.user?.id || null,
      ...serverInfo,
      timezone,
      language: language || serverInfo.language,
      screen_width: screen?.width,
      screen_height: screen?.height,
      referrer,
      utm_source: utm?.source,
      utm_medium: utm?.medium,
      utm_campaign: utm?.campaign,
      last_activity_at: new Date().toISOString()
    };

    await supabaseAdmin
      .from('user_sessions')
      .upsert(sessionData, { onConflict: 'id' });

    res.json({ success: true });
  } catch (err) {
    console.error('Session tracking error:', err);
    res.status(500).json({ error: 'Failed to track session' });
  }
});

/**
 * イベント記録
 * POST /api/analytics/event
 */
router.post('/event', async (req, res) => {
  // sendBeacon用: 即座に200を返す
  res.status(200).end();

  try {
    const { sessionId, event, data, timestamp } = req.body;

    await supabaseAdmin.from('analytics_events').insert({
      user_id: req.user?.id || null,
      session_id: sessionId,
      event_name: event,
      event_data: data,
      page_path: data?.path,
      created_at: new Date(timestamp).toISOString()
    });
  } catch (err) {
    console.error('Event tracking error:', err);
  }
});

/**
 * クォータ情報取得
 * GET /api/analytics/quota
 */
router.get('/quota', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const quotaService = require('../quotaService');

  const [projectQuota, messageQuota] = await Promise.all([
    quotaService.canCreateProject(req.user.id),
    quotaService.canSendMessage(req.user.id)
  ]);

  res.json({
    projects: projectQuota,
    messages: messageQuota
  });
});

module.exports = router;
```

---

## 5. フロントエンド実装

### 5.1 analytics.js（SDK）

```javascript
// public/analytics.js

(function() {
  'use strict';

  const DC = window.DreamCoreAnalytics = {
    sessionId: null,
    initialized: false,
    queue: [],

    /**
     * 初期化（自動実行）
     */
    init: async function() {
      if (this.initialized) return;
      this.initialized = true;

      // セッションID取得/生成
      this.sessionId = sessionStorage.getItem('dc_session_id');
      if (!this.sessionId) {
        this.sessionId = crypto.randomUUID();
        sessionStorage.setItem('dc_session_id', this.sessionId);
      }

      // セッション開始
      await this.startSession();

      // 初回ページビュー
      this.trackPageView();

      // SPA対応: history変更を監視
      const originalPushState = history.pushState;
      history.pushState = function() {
        originalPushState.apply(this, arguments);
        DC.trackPageView();
      };
      window.addEventListener('popstate', () => this.trackPageView());

      // キューに溜まったイベントを送信
      this.queue.forEach(item => this.track(item.event, item.data));
      this.queue = [];
    },

    /**
     * セッション開始
     */
    startSession: async function() {
      const data = {
        sessionId: this.sessionId,
        screen: {
          width: window.screen.width,
          height: window.screen.height
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        referrer: document.referrer,
        utm: this.getUTMParams()
      };

      try {
        await fetch('/api/analytics/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.getAuthHeader()
          },
          body: JSON.stringify(data)
        });
      } catch (err) {
        console.warn('Failed to start analytics session:', err);
      }
    },

    /**
     * ページビュー追跡
     */
    trackPageView: function() {
      this.track('pageview', {
        path: location.pathname,
        title: document.title,
        search: location.search
      });
    },

    /**
     * カスタムイベント追跡
     * @param {string} event - イベント名
     * @param {object} data - イベントデータ
     */
    track: function(event, data = {}) {
      if (!this.initialized) {
        this.queue.push({ event, data });
        return;
      }

      const payload = JSON.stringify({
        sessionId: this.sessionId,
        event,
        data,
        timestamp: Date.now()
      });

      // sendBeacon を優先（ページ離脱時も送信可能）
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/event', payload);
      } else {
        fetch('/api/analytics/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(() => {});
      }
    },

    /**
     * UTMパラメータ取得
     */
    getUTMParams: function() {
      const params = new URLSearchParams(location.search);
      return {
        source: params.get('utm_source'),
        medium: params.get('utm_medium'),
        campaign: params.get('utm_campaign'),
        term: params.get('utm_term'),
        content: params.get('utm_content')
      };
    },

    /**
     * 認証ヘッダー取得
     */
    getAuthHeader: function() {
      const token = localStorage.getItem('sb-access-token');
      return token ? `Bearer ${token}` : '';
    },

    /**
     * セッションIDを取得（外部から参照用）
     */
    getSessionId: function() {
      return this.sessionId;
    }
  };

  // DOM準備完了後に初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DC.init());
  } else {
    DC.init();
  }
})();
```

### 5.2 各ページでの使用例

```html
<!-- 全ページ共通: headに追加 -->
<script src="/analytics.js"></script>
```

```javascript
// カスタムイベントの例

// プロジェクト作成
DreamCoreAnalytics.track('project_create', {
  projectId: 'xxx',
  templateUsed: false
});

// 生成開始
DreamCoreAnalytics.track('generate_start', {
  projectId: 'xxx',
  promptLength: 150
});

// 生成完了
DreamCoreAnalytics.track('generate_complete', {
  projectId: 'xxx',
  duration: 5000,
  success: true
});

// エラー発生
DreamCoreAnalytics.track('error', {
  type: 'quota_exceeded',
  message: '本日の生成上限に達しました'
});
```

### 5.3 クォータ表示コンポーネント

```javascript
// public/quota-display.js

class QuotaDisplay {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.quota = null;
  }

  async fetch() {
    try {
      const res = await fetch('/api/analytics/quota', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sb-access-token')}`
        }
      });
      this.quota = await res.json();
      this.render();
    } catch (err) {
      console.error('Failed to fetch quota:', err);
    }
  }

  render() {
    if (!this.container || !this.quota) return;

    const { projects, messages } = this.quota;

    this.container.innerHTML = `
      <div class="quota-info">
        <div class="quota-item">
          <span class="quota-label">本日のプロジェクト作成</span>
          <span class="quota-value">${projects.used} / ${projects.limit}</span>
          <div class="quota-bar">
            <div class="quota-fill" style="width: ${(projects.used / projects.limit) * 100}%"></div>
          </div>
        </div>
        <div class="quota-item">
          <span class="quota-label">本日のメッセージ</span>
          <span class="quota-value">${messages.used} / ${messages.limit}</span>
          <div class="quota-bar">
            <div class="quota-fill" style="width: ${(messages.used / messages.limit) * 100}%"></div>
          </div>
        </div>
      </div>
    `;
  }
}
```

---

## 6. 実装フェーズ

### Phase 1: 制限機能 & 基本Analytics（今回）

| タスク | 優先度 |
|--------|--------|
| DBスキーマ作成（user_sessions, usage_logs, usage_quotas, subscriptions, analytics_events） | 必須 |
| config.js に TIER_LIMITS, MODEL_PRICING 追加 | 必須 |
| quotaService.js 実装 | 必須 |
| usageLogger.js 実装 | 必須 |
| claudeRunner.js にクォータチェック & 使用量ログ追加 | 必須 |
| analytics.js（SDK）作成 | 必須 |
| /api/analytics/* ルート追加 | 必須 |
| フロントエンドにクォータ表示追加 | 必須 |

### Phase 2: SNS/UGC機能（ゲーム公開時）

| タスク |
|--------|
| game_plays テーブル & プレイログ機能 |
| likes テーブル & いいね機能 |
| follows テーブル & フォロー機能 |
| comments テーブル & コメント機能 |
| reports, user_sanctions テーブル & モデレーション機能 |
| notifications テーブル & 通知機能 |

### Phase 3: 課金機能（将来）

| タスク |
|--------|
| Stripe連携 |
| payment_history テーブル |
| プラン変更UI |
| 請求書・領収書機能 |

---

## 7. 分析クエリ例

### 7.1 日次コスト集計

```sql
SELECT
  DATE(created_at) as date,
  model,
  COUNT(*) as calls,
  SUM(input_tokens) as total_input,
  SUM(output_tokens) as total_output,
  SUM(cost_usd) as total_cost
FROM usage_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), model
ORDER BY date DESC, total_cost DESC;
```

### 7.2 ユーザー別月間コスト

```sql
SELECT
  u.email,
  s.plan,
  COUNT(*) as operations,
  SUM(ul.cost_usd) as total_cost
FROM usage_logs ul
JOIN auth.users u ON ul.user_id = u.id
LEFT JOIN subscriptions s ON ul.user_id = s.user_id
WHERE ul.created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY u.email, s.plan
ORDER BY total_cost DESC
LIMIT 50;
```

### 7.3 国別ユーザー分布

```sql
SELECT
  country_code,
  COUNT(DISTINCT user_id) as users,
  COUNT(*) as sessions
FROM user_sessions
WHERE started_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY country_code
ORDER BY users DESC;
```

### 7.4 デバイス別利用状況

```sql
SELECT
  s.device_type,
  COUNT(DISTINCT s.user_id) as users,
  COUNT(*) as events
FROM analytics_events e
JOIN user_sessions s ON e.session_id = s.id
WHERE e.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY s.device_type;
```

### 7.5 制限到達率

```sql
SELECT
  quota_date,
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE projects_created >= 3) as hit_project_limit,
  COUNT(*) FILTER (WHERE messages_sent >= 20) as hit_message_limit
FROM usage_quotas
WHERE quota_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY quota_date
ORDER BY quota_date DESC;
```

---

## 8. 注意事項

### 8.1 プライバシー

- IPアドレスは一定期間後にマスキングまたは削除を検討
- GDPRやプライバシーポリシーへの記載が必要
- ユーザーにデータ収集の同意を得るUIが必要（Cookie同意バナー等）

### 8.2 パフォーマンス

- analytics.js は非同期で読み込み、メイン処理をブロックしない
- sendBeacon を使用してページ離脱時も確実に送信
- バックエンドのログ記録は非同期で実行

### 8.3 データ保持

- usage_logs: 1年間保持（課金根拠のため）
- analytics_events: 90日保持（集計後削除）
- user_sessions: 90日保持

---

## 9. 実装決定事項（2026-01-30 実装完了）

### 9.1 送信時消費（Pre-decrement）

クォータは**操作の開始時**に消費する方式を採用。

```
ユーザー操作 → クォータ消費 → 処理実行
```

**採用理由:**
- 処理失敗時のロールバック不要（失敗しても消費済み）
- 同時リクエストによる超過を防止
- シンプルな実装

**トレードオフ:**
- 処理が失敗しても1回分消費される
- ただし無料枠の範囲では許容可能

### 9.2 アトミック RPC（try_consume_quota）

クォータ消費は PostgreSQL の DB 関数で**アトミックに**実行。

```sql
CREATE OR REPLACE FUNCTION try_consume_quota(
  p_user_id UUID,
  p_field TEXT,
  p_limit INTEGER
) RETURNS TABLE(allowed BOOLEAN, current_count INTEGER)
```

**処理フロー:**
1. `usage_quotas` テーブルを UPSERT（当日分がなければ作成）
2. 現在のカウントを取得
3. `p_limit = -1`（無制限）または `current_count < p_limit` なら消費
4. `allowed` と `current_count` を返却

**レースコンディション対策:**
- `ON CONFLICT DO UPDATE` で同時挿入を処理
- 単一トランザクション内で判定と更新を実行

### 9.3 UTC ベースの日次リセット

`usage_quotas` テーブルは `quota_date DATE` カラムで日付を管理。

```sql
quota_date = CURRENT_DATE  -- PostgreSQL の UTC 日付
```

**採用理由:**
- サーバー/DBのタイムゾーン設定に依存しない
- 全ユーザーで同時にリセット（公平性）
- JST 09:00 は業務開始時間として自然

### 9.4 Fail-open 方針

クォータサービスでエラーが発生した場合は**操作を許可**する。

```javascript
try {
  const quotaResult = await quotaService.tryConsumeProjectQuota(userId);
  if (!quotaResult.allowed) { /* 制限 */ }
} catch (e) {
  console.error('[Quota] Check failed:', e);
  // エラー時は処理続行（UX 優先）
}
```

**採用理由:**
- DB障害時にサービス全体が停止するのを防止
- 無料枠の超過は致命的ではない
- ログで監視し、異常があれば対応

### 9.5 フロントエンド事前チェック

プロジェクト作成ボタン押下時、サーバー通信前に `currentQuota` をチェック。

```javascript
if (this.currentQuota && this.currentQuota.projects.remaining === 0) {
  this.showQuotaLimitModal(...);
  return;
}
```

**メリット:**
- 不要なサーバーリクエストを削減
- ユーザーへの即時フィードバック

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-01-30 | 初版作成 |
| 2026-01-30 | 実装決定事項（送信時消費・アトミックRPC・UTCリセット等）を追記 |
