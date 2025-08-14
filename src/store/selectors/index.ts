/**
 * Redux Selectors統合エクスポート
 *
 * 各ドメイン別のselectorファイルから必要なselectorsを再エクスポート
 * 既存のimport文を変更せずに済むよう、後方互換性を保持
 */

// =============================================================================
// ユーティリティ
// =============================================================================
export * from "./utils";

// =============================================================================
// ドメイン別selectors
// =============================================================================

// 測定関連
export {
  selectMeasurementData,
  selectRawData,
  selectParsedData,
  selectMeasurementTimes,
  selectLatestData,
  selectDisplayData,
  selectCanDownload,
  selectIsRecording,
  selectMeasurementDuration,
  selectStatistics,
  selectHistogramData,
  selectPaginatedData,
} from "./measurement.selectors";

// シリアルポート関連
export {
  selectSerialPortState,
  selectConnectionStatus,
  selectSerialAsyncStates,
} from "./serialPort.selectors";

// ファイル設定関連
export {
  selectFileSettings,
  selectAutoSaveSettings,
  selectAutoSaveData,
} from "./fileSettings.selectors";

// アプリ設定関連
export {
  selectAppState,
  selectPlatformInfo,
  selectAppAsyncStates,
} from "./app.selectors";

// オンラインデータ関連
export {
  selectIsOnlineEnabled,
  selectOnlineConfig,
  selectIsOnlineConnected,
  selectIsOnlineConnecting,
  selectOnlineConnectionStatus,
  selectOnlineStatistics,
  selectOnlineQueueStatus,
  selectOnlineBatchSettings,
  selectOnlineUploadStatus,
  selectIsOnlineReadyToUpload,
  selectOnlineDataBatch,
  selectOnlineServiceConfig,
} from "./onlineData.selectors";

// =============================================================================
// UI統合selectors（コンポーネント用）
// =============================================================================
export {
  selectErrorStates,
  selectAsyncStates,
  selectAppData,
  selectSerialConnectionData,
  selectFileControlsData,
  selectDataHistogramsData,
  selectDataTableData,
} from "./ui.selectors";
