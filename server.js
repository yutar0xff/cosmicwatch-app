/**
 * CosmicWatch Data Server
 * Web版でのファイル保存を可能にするためのNode.jsサーバー
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use(express.static('dist')); // Viteビルド成果物を配信

// データディレクトリの確保
async function ensureDataDirectory() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log('Data directory created:', DATA_DIR);
  }
}

// ハッシュ値生成
function generateSessionHash() {
  return crypto.randomBytes(16).toString('hex');
}

// API: 測定セッション開始（ハッシュ値でファイル作成）
app.post('/api/session/start', async (req, res) => {
  try {
    const { includeComments, comment, measurementStartTime } = req.body;
    const sessionHash = generateSessionHash();
    const filename = `${sessionHash}.dat`;
    const filepath = path.join(DATA_DIR, filename);

    let content = '';
    
    if (includeComments) {
      const startTime = new Date(measurementStartTime).toLocaleString('ja-JP');
      const comments = [
        '# CosmicWatch Data',
        `# Measurement Start: ${startTime}`,
        ...comment.split('\n')
          .filter(line => line.trim())
          .map(line => `# ${line}`)
      ].join('\n');
      content = comments + '\n';
    }

    await fs.writeFile(filepath, content, 'utf8');
    
    console.log(`Session started: ${sessionHash}`);
    res.json({ 
      sessionHash, 
      filename,
      message: 'Session started successfully' 
    });
  } catch (error) {
    console.error('Failed to start session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// API: データ追記保存
app.post('/api/session/:sessionHash/append', async (req, res) => {
  try {
    const { sessionHash } = req.params;
    const { rawData, parsedData } = req.body;
    
    const filename = `${sessionHash}.dat`;
    const filepath = path.join(DATA_DIR, filename);
    
    // ファイルの存在確認
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({ error: 'Session not found' });
    }

    let dataToWrite = '';
    
    if (parsedData) {
      // パース成功の場合：フォーマット済みデータ
      const timestamp = new Date().toISOString().replace('T', '-').replace(/\..+/, '').replace(/:/g, '-');
      dataToWrite = `${parsedData.event}\t${timestamp}\t${parsedData.adc}\t${parsedData.sipm}\t${parsedData.deadtime}\t${parsedData.temp}`;
    } else {
      // パース失敗の場合：生データ
      dataToWrite = rawData.trim();
    }

    await fs.appendFile(filepath, dataToWrite + '\n', 'utf8');
    
    res.json({ message: 'Data appended successfully' });
  } catch (error) {
    console.error('Failed to append data:', error);
    res.status(500).json({ error: 'Failed to append data' });
  }
});

// API: ファイルダウンロード
app.get('/api/session/:sessionHash/download', async (req, res) => {
  try {
    const { sessionHash } = req.params;
    const filename = `${sessionHash}.dat`;
    const filepath = path.join(DATA_DIR, filename);
    
    // ファイルの存在確認
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    // ファイル名を測定開始時刻ベースに変更
    const stats = await fs.stat(filepath);
    const createdTime = stats.birthtime;
    const downloadFilename = `cosmicwatch-${createdTime.toISOString().slice(0, 19).replace(/:/g, '-')}.dat`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    res.setHeader('Content-Type', 'text/plain');
    
    const fileContent = await fs.readFile(filepath, 'utf8');
    res.send(fileContent);
  } catch (error) {
    console.error('Failed to download file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// API: ファイル内容取得（グラフ描画用）
app.get('/api/session/:sessionHash/data', async (req, res) => {
  try {
    const { sessionHash } = req.params;
    const { limit } = req.query; // 最新N件取得
    
    const filename = `${sessionHash}.dat`;
    const filepath = path.join(DATA_DIR, filename);
    
    // ファイルの存在確認
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileContent = await fs.readFile(filepath, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    
    // 最新N件に制限
    const dataLines = limit ? lines.slice(-parseInt(limit)) : lines;
    
    res.json({ 
      lines: dataLines,
      totalLines: lines.length 
    });
  } catch (error) {
    console.error('Failed to get data:', error);
    res.status(500).json({ error: 'Failed to get data' });
  }
});

// API: セッション終了
app.post('/api/session/:sessionHash/stop', async (req, res) => {
  try {
    const { sessionHash } = req.params;
    const { measurementEndTime } = req.body;
    
    const filename = `${sessionHash}.dat`;
    const filepath = path.join(DATA_DIR, filename);
    
    // ファイルの存在確認
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({ error: 'Session not found' });
    }

    // 終了時刻をコメントとして追記
    const endTime = new Date(measurementEndTime).toLocaleString('ja-JP');
    const endComment = `\n# Measurement End: ${endTime}\n`;
    
    await fs.appendFile(filepath, endComment, 'utf8');
    
    console.log(`Session stopped: ${sessionHash}`);
    res.json({ message: 'Session stopped successfully' });
  } catch (error) {
    console.error('Failed to stop session:', error);
    res.status(500).json({ error: 'Failed to stop session' });
  }
});

// サーバー起動
async function startServer() {
  await ensureDataDirectory();
  
  app.listen(PORT, () => {
    console.log(`CosmicWatch Data Server running on http://localhost:${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
  });
}

startServer().catch(console.error);