import { CosmicWatchData } from "../../shared/types";
import { ServerFileDataService, createServerFileDataService } from "./ServerFileDataService";

/**
 * プラットフォーム固有の操作を抽象化するインターフェース
 */
export interface PlatformService {
  /**
   * プラットフォームがデスクトップアプリかどうかを判定（同期的）
   */
  isDesktop(): boolean;

  /**
   * ファイルを保存する
   */
  saveFile(content: string, filename: string): Promise<void>;

  /**
   * ディレクトリを選択する
   */
  selectDirectory(): Promise<string | null>;

  /**
   * 指定されたパスにファイルを書き込む（デスクトップ版のみ）
   */
  writeFile(
    path: string,
    content: string,
    options?: { append?: boolean }
  ): Promise<void>;

  /**
   * パスを結合する（デスクトップ版のみ）
   */
  joinPath(...paths: string[]): Promise<string>;

  /**
   * デフォルトのダウンロードディレクトリを取得（デスクトップ版のみ）
   */
  getDownloadDirectory(): Promise<string>;

  /**
   * サーバー版用のセッション管理（オプショナル）
   */
  startSession?(options: {
    includeComments: boolean;
    comment: string;
    measurementStartTime: Date;
  }): Promise<string>;

  appendData?(
    sessionHash: string,
    rawData: string,
    parsedData?: CosmicWatchData | null
  ): Promise<void>;

  getData?(sessionHash: string, limit?: number): Promise<{
    lines: string[];
    totalLines: number;
  }>;

  stopSession?(sessionHash: string, measurementEndTime: Date): Promise<void>;
}

/**
 * Web版のプラットフォームサービス実装（従来のダウンロード版）
 */
export class WebPlatformService implements PlatformService {
  isDesktop(): boolean {
    return false;
  }

  async saveFile(content: string, filename: string): Promise<void> {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async selectDirectory(): Promise<string | null> {
    // Web版では実装不可
    throw new Error("Directory selection is not supported in web version");
  }

  async writeFile(
    _path: string,
    _content: string,
    _options?: { append?: boolean }
  ): Promise<void> {
    // Web版では実装不可
    throw new Error("File writing is not supported in web version");
  }

  async joinPath(..._paths: string[]): Promise<string> {
    // Web版では実装不可
    throw new Error("Path joining is not supported in web version");
  }

  async getDownloadDirectory(): Promise<string> {
    // Web版では実装不可
    throw new Error(
      "Download directory access is not supported in web version"
    );
  }
}

/**
 * サーバー版のプラットフォームサービス実装
 * サーバーAPIを使用してファイル操作を行う
 */
export class ServerPlatformService implements PlatformService {
  private serverService: ServerFileDataService;
  private currentSessionHash: string | null = null;

  constructor() {
    this.serverService = createServerFileDataService();
  }

  isDesktop(): boolean {
    return false; // サーバー版でもブラウザ環境
  }

  async saveFile(content: string, filename: string): Promise<void> {
    // サーバー版では現在のセッションファイルをダウンロード
    if (this.currentSessionHash) {
      await this.serverService.downloadFile(this.currentSessionHash);
    } else {
      // フォールバック：従来のダウンロード方式
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  async selectDirectory(): Promise<string | null> {
    // サーバー版では固定パス
    return "./data/";
  }

  async writeFile(
    path: string,
    content: string,
    options?: { append?: boolean }
  ): Promise<void> {
    // サーバー版では appendData を使用
    if (this.currentSessionHash && options?.append) {
      await this.serverService.appendData(this.currentSessionHash, content);
    } else {
      throw new Error("File writing requires an active session");
    }
  }

  async joinPath(...paths: string[]): Promise<string> {
    return paths.join("/");
  }

  async getDownloadDirectory(): Promise<string> {
    return "./data/";
  }

  // サーバー版固有のメソッド
  async startSession(options: {
    includeComments: boolean;
    comment: string;
    measurementStartTime: Date;
  }): Promise<string> {
    this.currentSessionHash = await this.serverService.startSession(options);
    return this.currentSessionHash;
  }

  async appendData(
    sessionHash: string,
    rawData: string,
    parsedData?: CosmicWatchData | null
  ): Promise<void> {
    await this.serverService.appendData(sessionHash, rawData, parsedData);
  }

  async getData(sessionHash: string, limit?: number): Promise<{
    lines: string[];
    totalLines: number;
  }> {
    return await this.serverService.getData(sessionHash, limit);
  }

  async stopSession(sessionHash: string, measurementEndTime: Date): Promise<void> {
    await this.serverService.stopSession(sessionHash, measurementEndTime);
    this.currentSessionHash = null;
  }

  // セッションハッシュの取得
  getCurrentSessionHash(): string | null {
    return this.currentSessionHash;
  }

  // セッションハッシュの設定
  setCurrentSessionHash(sessionHash: string | null): void {
    this.currentSessionHash = sessionHash;
  }
}

/**
 * Tauri（デスクトップ）版のプラットフォームサービス実装
 */
export class TauriPlatformService implements PlatformService {
  isDesktop(): boolean {
    return true;
  }

  async saveFile(content: string, filename: string): Promise<void> {
    // デスクトップ版では通常のファイル保存ダイアログを使用
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");

    const filePath = await save({
      defaultPath: filename,
      filters: [
        {
          name: "Data files",
          extensions: ["dat"],
        },
        {
          name: "All files",
          extensions: ["*"],
        },
      ],
    });

    if (filePath) {
      await writeTextFile(filePath, content);
    }
  }

  async selectDirectory(): Promise<string | null> {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ directory: true, multiple: false });
    return typeof selected === "string" ? selected : null;
  }

  async writeFile(
    path: string,
    content: string,
    options?: { append?: boolean }
  ): Promise<void> {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(path, content, { append: options?.append || false });
  }

  async joinPath(...paths: string[]): Promise<string> {
    const { path } = await import("@tauri-apps/api");
    return await path.join(...paths);
  }

  async getDownloadDirectory(): Promise<string> {
    const { downloadDir } = await import("@tauri-apps/api/path");
    return await downloadDir();
  }
}

/**
 * プラットフォームサービスのファクトリー関数
 */
export async function createPlatformService(): Promise<PlatformService> {
  try {
    // Tauriが利用可能かチェック
    const { getVersion } = await import("@tauri-apps/api/app");
    await getVersion();
    console.log("Running as Tauri desktop app");
    return new TauriPlatformService();
  } catch (error) {
    // Tauriが利用できない場合はWeb版またはサーバー版を使用
    console.log("Running as web app");
    
    // サーバー版を使用するかチェック
    const useServer = checkUseServerMode();
    
    if (useServer) {
      console.log("Using server-based file storage");
      return new ServerPlatformService();
    } else {
      console.log("Using traditional web download");
      return new WebPlatformService();
    }
  }
}

/**
 * サーバー版を使用するかどうかを判定
 */
function checkUseServerMode(): boolean {
  // URL クエリパラメータでチェック
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mode') === 'server') {
    return true;
  }
  
  // 環境変数でチェック
  if (process.env.VITE_FILE_MODE === 'server') {
    return true;
  }
  
  // localhost:3001 でサーバーが動いているかチェック（非同期だが簡易的に判定）
  const isServerAvailable = checkServerAvailability();
  
  return isServerAvailable;
}

/**
 * サーバーが利用可能かチェック（同期的）
 */
function checkServerAvailability(): boolean {
  // 本来は非同期でサーバーの生存確認をすべきだが、
  // ファクトリー関数の設計上、簡易的にポート番号から推測
  const currentUrl = window.location;
  
  // localhost:3001 or 本番環境でサーバーAPIが利用可能な場合
  return currentUrl.hostname === 'localhost' || 
         process.env.NODE_ENV === 'production';
}
