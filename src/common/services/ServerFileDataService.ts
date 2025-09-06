/**
 * サーバー経由でのファイル操作を行うサービス
 * Web版で使用し、Node.jsサーバーAPIを呼び出してファイル操作を実行
 */

import { CosmicWatchData } from "../../shared/types";

export interface ServerFileDataService {
  /**
   * 測定セッションを開始（ハッシュ値でファイル作成）
   */
  startSession(options: {
    includeComments: boolean;
    comment: string;
    measurementStartTime: Date;
  }): Promise<string>; // sessionHashを返す

  /**
   * データを逐次追記保存
   */
  appendData(
    sessionHash: string,
    rawData: string,
    parsedData?: CosmicWatchData | null
  ): Promise<void>;

  /**
   * ファイル内容を取得（グラフ描画用）
   */
  getData(sessionHash: string, limit?: number): Promise<{
    lines: string[];
    totalLines: number;
  }>;

  /**
   * ファイルをダウンロード
   */
  downloadFile(sessionHash: string): Promise<void>;

  /**
   * セッションを終了
   */
  stopSession(sessionHash: string, measurementEndTime: Date): Promise<void>;
}

export class ServerFileDataServiceImpl implements ServerFileDataService {
  private readonly baseUrl: string;

  constructor(baseUrl: string = "/api/cosmic") {
    this.baseUrl = baseUrl;
  }

  async startSession(options: {
    includeComments: boolean;
    comment: string;
    measurementStartTime: Date;
  }): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/session/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          includeComments: options.includeComments,
          comment: options.comment,
          measurementStartTime: options.measurementStartTime.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      return result.sessionHash;
    } catch (error) {
      console.error("Failed to start session:", error);
      throw new Error(
        `セッション開始に失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async appendData(
    sessionHash: string,
    rawData: string,
    parsedData?: CosmicWatchData | null
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/session/${sessionHash}/append`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rawData,
            parsedData,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (error) {
      console.error("Failed to append data:", error);
      throw new Error(
        `データ追記に失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getData(
    sessionHash: string,
    limit?: number
  ): Promise<{
    lines: string[];
    totalLines: number;
  }> {
    try {
      const url = new URL(`${this.baseUrl}/api/session/${sessionHash}/data`);
      if (limit) {
        url.searchParams.set("limit", limit.toString());
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get data:", error);
      throw new Error(
        `データ取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async downloadFile(sessionHash: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/session/${sessionHash}/download`
      );

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      // ファイル名を取得
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `cosmicwatch-${sessionHash}.dat`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // ダウンロードを実行
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download file:", error);
      throw new Error(
        `ファイルダウンロードに失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async stopSession(
    sessionHash: string,
    measurementEndTime: Date
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/session/${sessionHash}/stop`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            measurementEndTime: measurementEndTime.toISOString(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (error) {
      console.error("Failed to stop session:", error);
      throw new Error(
        `セッション終了に失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * サーバーファイルデータサービスのファクトリー関数
 */
export function createServerFileDataService(): ServerFileDataService {
  // 環境に応じてbaseURLを変更可能
  // 本番環境では空文字でプロキシ経由アクセス
  const baseUrl = (import.meta as any).env?.DEV 
    ? "/api/cosmic" 
    : "";
    
  return new ServerFileDataServiceImpl(baseUrl);
}
