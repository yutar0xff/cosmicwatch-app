import { useState, useCallback, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "../../store/hooks";
import {
  selectIndexedDBState,
  selectCurrentSession,
  selectSessions,
  selectDataStatistics,
  selectBatchState
} from "../../store/selectors";
import {
  initializeIndexedDB,
  createMeasurementSession,
  endMeasurementSession,
  loadSessions,
  persistDataToIndexedDB,
  setIndexedDBEnabled
} from "../../store/slices/measurementSlice";
import {
  // DatabaseIcon replaced with CircleStackIcon
  // import defaults per file to avoid bundler resolution issues
} from "react";
import CircleStackIcon from "@heroicons/react/24/outline/CircleStackIcon";
import PlayIcon from "@heroicons/react/24/outline/PlayIcon";
import StopIcon from "@heroicons/react/24/outline/StopIcon";
import ClockIcon from "@heroicons/react/24/outline/ClockIcon";
import ChartBarIcon from "@heroicons/react/24/outline/ChartBarIcon";
import CpuChipIcon from "@heroicons/react/24/outline/CpuChipIcon";
import ExclamationTriangleIcon from "@heroicons/react/24/outline/ExclamationTriangleIcon";
import CheckCircleIcon from "@heroicons/react/24/outline/CheckCircleIcon";
import { SectionTitle } from "./Layout";

export const SessionManager = () => {
  const dispatch = useAppDispatch();
  
  // Redux状態
  const indexedDBState = useAppSelector(selectIndexedDBState);
  const currentSession = useAppSelector(selectCurrentSession);
  const sessions = useAppSelector(selectSessions);
  const dataStats = useAppSelector(selectDataStatistics);
  const batchState = useAppSelector(selectBatchState);

  // ローカル状態
  const [sessionComment, setSessionComment] = useState("");
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);

  // IndexedDB初期化
  useEffect(() => {
    if (indexedDBState.isSupported && !indexedDBState.isInitialized) {
      dispatch(initializeIndexedDB());
    }
  }, [dispatch, indexedDBState.isSupported, indexedDBState.isInitialized]);

  // セッション一覧読み込み
  useEffect(() => {
    if (indexedDBState.isEnabled && indexedDBState.isInitialized) {
      dispatch(loadSessions());
    }
  }, [dispatch, indexedDBState.isEnabled, indexedDBState.isInitialized]);

  // バッチ自動保存
  useEffect(() => {
    if (batchState.shouldFlush && currentSession && indexedDBState.isEnabled) {
      dispatch(persistDataToIndexedDB({
        sessionId: currentSession.sessionId,
        data: batchState.pendingCount > 0 ? [] : [] // 実際のバッチデータはslice内で管理
      }));
    }
  }, [dispatch, batchState.shouldFlush, currentSession, indexedDBState.isEnabled]);

  // セッション開始
  const handleStartSession = useCallback(async () => {
    if (!indexedDBState.isEnabled) return;
    
    setIsCreatingSession(true);
    try {
      await dispatch(createMeasurementSession(sessionComment.trim() || "測定セッション"));
      setSessionComment("");
    } catch (error) {
      console.error("Failed to start session:", error);
    } finally {
      setIsCreatingSession(false);
    }
  }, [dispatch, sessionComment, indexedDBState.isEnabled]);

  // セッション終了
  const handleEndSession = useCallback(async () => {
    if (!currentSession) return;
    
    try {
      await dispatch(endMeasurementSession(currentSession.sessionId));
      // バッチに残ったデータがあれば保存
      if (batchState.pendingCount > 0) {
        await dispatch(persistDataToIndexedDB({
          sessionId: currentSession.sessionId,
          data: [] // 実際のデータはslice内で処理
        }));
      }
    } catch (error) {
      console.error("Failed to end session:", error);
    }
  }, [dispatch, currentSession, batchState.pendingCount]);

  // IndexedDB有効化切り替え
  const handleToggleIndexedDB = useCallback(() => {
    dispatch(setIndexedDBEnabled(!indexedDBState.isEnabled));
  }, [dispatch, indexedDBState.isEnabled]);

  // 時間のフォーマット
  const formatDuration = (startTime: string, endTime?: string | null) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const durationMs = end.getTime() - start.getTime();
    
    const minutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}時間${minutes % 60}分`;
    }
    return `${minutes}分`;
  };

  // IndexedDBが利用できない場合
  if (!indexedDBState.isSupported) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-800">
          <ExclamationTriangleIcon className="h-5 w-5" />
          <span className="font-medium">IndexedDBが利用できません</span>
        </div>
        <p className="text-sm text-yellow-700 mt-2">
          お使いのブラウザではIndexedDBがサポートされていないため、長期間測定機能は利用できません。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle>
        <div className="flex items-center">
          <CircleStackIcon className="h-6 w-6 mr-2 text-gray-600" />
          セッション管理
        </div>
      </SectionTitle>

      {/* IndexedDB状態表示 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CpuChipIcon className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-gray-900">長期間測定モード</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleIndexedDB}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  indexedDBState.isEnabled
                    ? "bg-blue-600"
                    : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    indexedDBState.isEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {indexedDBState.isEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-blue-800 font-medium">状態</div>
                <div className="text-blue-900">
                  {indexedDBState.isInitialized ? (
                    <span className="flex items-center gap-1">
                      <CheckCircleIcon className="h-4 w-4" />
                      利用可能
                    </span>
                  ) : (
                    "初期化中..."
                  )}
                </div>
              </div>
              
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-green-800 font-medium">メモリ内データ</div>
                <div className="text-green-900">
                  {dataStats.memoryCount.toLocaleString()}件
                </div>
              </div>

              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="text-purple-800 font-medium">総データ数</div>
                <div className="text-purple-900">
                  {dataStats.totalCount.toLocaleString()}件
                </div>
              </div>
            </div>
          )}

          {indexedDBState.lastError && (
            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <div className="text-red-800 text-sm">
                <strong>エラー:</strong> {indexedDBState.lastError}
              </div>
            </div>
          )}
        </div>
      </div>

      {indexedDBState.isEnabled && indexedDBState.isInitialized && (
        <>
          {/* バッチ処理状態 */}
          {batchState.pendingCount > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-yellow-800">
                <ClockIcon className="h-4 w-4" />
                <span>
                  {batchState.pendingCount}件のデータが保存待ちです
                  （バッチサイズ: {batchState.batchSize}件）
                </span>
              </div>
            </div>
          )}

          {/* 現在のセッション */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">現在のセッション</h3>
            
            {currentSession ? (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <PlayIcon className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-900">測定中</span>
                    </div>
                    {currentSession.isActive && (
                      <button
                        onClick={handleEndSession}
                        className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <StopIcon className="h-4 w-4" />
                        終了
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">セッションID</div>
                      <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {currentSession.sessionId}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">コメント</div>
                      <div className="text-gray-900">
                        {currentSession.comment || "なし"}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">開始時刻</div>
                      <div className="text-gray-900">
                        {new Date(currentSession.startTime).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">経過時間</div>
                      <div className="text-gray-900">
                        {formatDuration(currentSession.startTime, currentSession.endTime)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-gray-600 text-center py-4">
                  アクティブなセッションはありません
                </div>
                
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="セッションのコメント（オプション）"
                    value={sessionComment}
                    onChange={(e) => setSessionComment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    maxLength={100}
                  />
                  <button
                    onClick={handleStartSession}
                    disabled={isCreatingSession}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <PlayIcon className="h-4 w-4" />
                    {isCreatingSession ? "作成中..." : "新しいセッションを開始"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* セッション一覧 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">過去のセッション</h3>
              {sessions.length > 3 && (
                <button
                  onClick={() => setShowAllSessions(!showAllSessions)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {showAllSessions ? "少なく表示" : `全て表示 (${sessions.length}件)`}
                </button>
              )}
            </div>

            {sessions.length > 0 ? (
              <div className="space-y-3">
                {(showAllSessions ? sessions : sessions.slice(0, 3)).map((session) => (
                  <div
                    key={session.sessionId}
                    className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <div className="text-gray-600">開始</div>
                        <div className="text-gray-900">
                          {new Date(session.startTime).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600">期間</div>
                        <div className="text-gray-900">
                          {formatDuration(session.startTime, session.endTime)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600">イベント数</div>
                        <div className="text-gray-900">
                          {session.totalEvents.toLocaleString()}件
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600">状態</div>
                        <div className={`inline-flex items-center gap-1 ${
                          session.isActive ? "text-green-600" : "text-gray-600"
                        }`}>
                          {session.isActive ? (
                            <>
                              <PlayIcon className="h-3 w-3" />
                              実行中
                            </>
                          ) : (
                            <>
                              <StopIcon className="h-3 w-3" />
                              完了
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {session.comment && (
                      <div className="mt-2 text-sm text-gray-600 italic">
                        {session.comment}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ChartBarIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <div>まだセッションがありません</div>
                <div className="text-sm">新しいセッションを開始してください</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
