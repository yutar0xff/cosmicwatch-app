# Cosmic Watch Measurement System

宇宙線検出データの収集・管理システムです。検出器からのデータをサーバーにアップロードし、リアルタイムで可視化できます。

## システム構成

- **検出器クライアント**: Pythonスクリプトで宇宙線データを収集
- **Webサーバー**: Node.jsベースのREST APIサーバー
- **データビューア**: ブラウザベースの可視化ツール

## 外部アプリケーションからのデータ送信

他のアプリケーションからも宇宙線データを送信できます。以下の仕様に従ってください。

### 1. 認証

#### ログイン
```http
POST /auth/login
Content-Type: application/json

{
  "id": "your_user_id",
  "password": "your_password"
}
```

**レスポンス:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "your_user_id",
    "role": "user"
  }
}
```

#### ユーザー登録
```http
POST /auth/register
Content-Type: application/json

{
  "id": "your_user_id",
  "password": "your_password",
  "comment": "測定場所の説明（任意）",
  "gps_latitude": "35.6762", 
  "gps_longitude": "139.6503"
}
```

#### トークン検証
```http
GET /auth/validate
Authorization: Bearer <your_token>
```

#### トークン更新
```http
POST /auth/refresh
Content-Type: application/json

{
  "user_id": "your_user_id"
}
```

### 2. 測定セットアップ

測定を開始する前に、サーバー上にIDディレクトリを作成します：

```http
POST /setup-id
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "id": "your_user_id",
  "comment": "測定場所・目的の説明",
  "gps_latitude": "35.6762",
  "gps_longitude": "139.6503",
  "created_at": "2025-06-18T12:00:00.000Z"
}
```

### 3. データ送信

#### データフォーマット
各宇宙線イベントを以下の形式で送信：

```http
POST /upload-data/{user_id}
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "timestamp": "2025-06-18-14-30-25.123456",
  "adc": "1024",
  "vol": "3.3", 
  "deadtime": "100"
}
```

#### データ項目説明
- **timestamp**: イベント発生時刻（YYYY-MM-DD-HH-MM-SS.microseconds形式）
- **adc**: ADC値（文字列、検出器の信号強度）
- **vol**: 電圧値（文字列、V）
- **deadtime**: デッドタイム（文字列、μs）

#### バッチ送信の推奨
リアルタイム送信ではなく、複数のデータをバッファリングして定期的に送信することを推奨します。

### 4. エラーハンドリング

#### 認証エラー
- **401**: トークンが無効または期限切れ → トークンを更新
- **403**: アクセス権限なし → 自分のIDにのみアップロード可能

#### データエラー  
- **400**: 必須項目が不足
- **404**: ユーザーIDが見つからない

#### ネットワークエラー
- 接続タイムアウト時は指数バックオフでリトライ
- オフラインモードでローカル保存を検討

### 5. 実装例（Python）

```python
import requests
import json
import time

class CosmicRayClient:
    def __init__(self, server_url, user_id, password):
        self.server_url = server_url
        self.user_id = user_id
        self.token = None
        
        # ログイン
        self.login(user_id, password)
        
        # 測定セットアップ
        self.setup_measurement()
    
    def login(self, user_id, password):
        """ユーザー認証"""
        response = requests.post(
            f"{self.server_url}/auth/login",
            json={"id": user_id, "password": password},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            self.token = data['token']
            print(f"✓ Login successful: {user_id}")
        else:
            raise Exception(f"Login failed: {response.json()}")
    
    def setup_measurement(self):
        """測定セットアップ"""
        headers = {'Authorization': f'Bearer {self.token}'}
        config = {
            "id": self.user_id,
            "comment": "External app measurement",
            "gps_latitude": "35.6762",
            "gps_longitude": "139.6503",
            "created_at": time.strftime('%Y-%m-%dT%H:%M:%S.000Z')
        }
        
        response = requests.post(
            f"{self.server_url}/setup-id",
            json=config,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            print("✓ Measurement setup complete")
        else:
            print(f"⚠ Setup warning: {response.json()}")
    
    def send_data(self, timestamp, adc, voltage, deadtime):
        """宇宙線データ送信"""
        headers = {'Authorization': f'Bearer {self.token}'}
        data = {
            "timestamp": timestamp,
            "adc": str(adc),
            "vol": str(voltage),
            "deadtime": str(deadtime)
        }
        
        response = requests.post(
            f"{self.server_url}/upload-data/{self.user_id}",
            json=data,
            headers=headers,
            timeout=5
        )
        
        if response.status_code == 200:
            return True
        elif response.status_code == 401:
            # トークン更新が必要
            self.refresh_token()
            return self.send_data(timestamp, adc, voltage, deadtime)
        else:
            print(f"Upload failed: {response.json()}")
            return False
    
    def refresh_token(self):
        """トークン更新"""
        response = requests.post(
            f"{self.server_url}/auth/refresh",
            json={"user_id": self.user_id},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            self.token = data['token']
            print("✓ Token refreshed")
        else:
            raise Exception("Token refresh failed")

# 使用例
client = CosmicRayClient("http://accel-kitchen.com:3000", "your_id", "your_password")

# データ送信
timestamp = time.strftime('%Y-%m-%d-%H-%M-%S.%f')[:-3]  # microseconds
client.send_data(timestamp, 1024, 3.3, 100)
```

### 6. データ確認

#### 最新データ取得
```http
GET /latest-data/{user_id}
```

#### ファイル一覧
```http
GET /api/files/{user_id}
```

#### データダウンロード
```http
GET /api/download/{user_id}/{filename}
```

## サーバー設定

- **デフォルトURL**: `http://accel-kitchen.com:3000`
- **トークン有効期限**: 24時間
- **アップロード制限**: ユーザーは自分のIDにのみアップロード可能

## データ保存形式

サーバー側では日付ごとにタブ区切りファイルで保存：
```
ADC値	タイムスタンプ	電圧値	デッドタイム
1024	2025-06-18-14-30-25.123456	3.3	100
```

## 注意事項

1. **セキュリティ**: 認証トークンを安全に管理してください
2. **レート制限**: 過度な頻度での送信は避けてください  
3. **データ精度**: タイムスタンプはマイクロ秒まで記録
4. **バックアップ**: ネットワーク障害に備えてローカル保存も実装してください