-- Cloudflare D1 Database Schema
-- Migration for hackthon-x WebSocket server

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  bg TEXT,
  tags TEXT DEFAULT '[]', -- JSON string
  chatbot_history TEXT DEFAULT '[]', -- JSON string
  avatarUrl TEXT,
  x REAL DEFAULT 5.0,
  y REAL DEFAULT 5.0,
  color TEXT DEFAULT '#FF5733',
  status TEXT DEFAULT 'idle',
  currentTask TEXT, -- JSON string for current task
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Thoughts table
CREATE TABLE IF NOT EXISTS thoughts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agentId INTEGER NOT NULL,
  agentName TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('inner_thought', 'decision', 'conversation')),
  content TEXT NOT NULL,
  confidence INTEGER,
  reasoning TEXT,
  shouldInitiateChat INTEGER DEFAULT 0, -- 0 = false, 1 = true
  emotion TEXT,
  conversationId TEXT,
  metadata TEXT, -- JSON string for additional metadata
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (agentId) REFERENCES agents(id)
);

-- Conversations table (for tracking active conversations)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  agent1Id INTEGER NOT NULL,
  agent2Id INTEGER NOT NULL,
  startTime DATETIME DEFAULT CURRENT_TIMESTAMP,
  endTime DATETIME,
  messageCount INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  FOREIGN KEY (agent1Id) REFERENCES agents(id),
  FOREIGN KEY (agent2Id) REFERENCES agents(id)
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agentId INTEGER,
  action TEXT NOT NULL,
  details TEXT, -- JSON string
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (agentId) REFERENCES agents(id)
);

-- Memories table (if needed)
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agentId INTEGER NOT NULL,
  content TEXT NOT NULL,
  importance INTEGER DEFAULT 5,
  embedding TEXT, -- JSON array of floats
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (agentId) REFERENCES agents(id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_thoughts_agent_id ON thoughts(agentId);
CREATE INDEX IF NOT EXISTS idx_thoughts_type ON thoughts(type);
CREATE INDEX IF NOT EXISTS idx_thoughts_created_at ON thoughts(createdAt);
CREATE INDEX IF NOT EXISTS idx_conversations_agents ON conversations(agent1Id, agent2Id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_agent_id ON activity_logs(agentId);
CREATE INDEX IF NOT EXISTS idx_memories_agent_id ON memories(agentId);

-- Insert default agents
INSERT OR IGNORE INTO agents (id, name, x, y, color, status) VALUES
(1, 'Mike', 5.0, 5.0, '#FF5733', 'idle'),
(2, 'Cassin', 15.0, 10.0, '#33A1FF', 'idle'),
(3, 'Dax', 40.0, 18.0, '#33FF57', 'idle'),
(4, 'Roland', 89.0, 18.0, '#FF33A1', 'idle'),
(5, 'Sue', 58.0, 18.0, '#A133FF', 'idle');