import { useEffect, useRef, useMemo } from "react";
import { SectionTitle } from "./common/components/Layout";
import { SerialConnection } from "./common/components/SerialConnection";
import { DataTable } from "./common/components/DataTable";
import { FileControls } from "./common/components/FileControls";
import { DataHistograms } from "./common/components/DataHistograms";
import { generateDemoData, resetDemoDataState } from "./common/utils/demoData";
import { UpdateChecker } from "./common/components/UpdateChecker";
import { LayoutSelector } from "./common/components/LayoutSelector";
import { useResponsiveLayout } from "./common/hooks/useResponsiveLayout";
import { CosmicWatchDataService } from "./common/services/CosmicWatchDataService";
import {
  ExclamationTriangleIcon,
  PlayIcon,
  StopIcon,
  LightBulbIcon,
} from "@heroicons/react/24/solid";
import {
  TableCellsIcon,
  CodeBracketIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { MarkGithubIcon } from "@primer/octicons-react";

// Redux関連のimport
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { clearData, processSerialData, processServerData } from "./store/slices/measurementSlice";
import { setAutoSavePath } from "./store/slices/fileSettingsSlice";
import {
  initializePlatformService,
  setDemoMode,
} from "./store/slices/appSlice";
import {
  selectAppData,
  selectMeasurementTimes,
  selectErrorStates,
} from "./store/selectors";

function App() {
  // Redux hooks - 統合selectorを使用
  const dispatch = useAppDispatch();
  const { measurementData, platformInfo, latestData } =
    useAppSelector(selectAppData);
  const { startTime, endTime } = useAppSelector(selectMeasurementTimes);
  const { initializationError } = useAppSelector(selectErrorStates);
  const { isDesktop, platformService, isDemoMode, isInitialized } =
    platformInfo;
  const { rawData: latestRawData, parsedData: latestParsedData } = latestData;

  // レスポンシブレイアウト管理
  const { layout, userPreference, setUserPreference, isAuto } =
    useResponsiveLayout();

  // デモモード制御
  const demoIntervalRef = useRef<number | null>(null);

  // プラットフォームサービスを初期化（アプリ全体で共有）
  useEffect(() => {
    if (!isInitialized && !initializationError) {
      dispatch(initializePlatformService());
    }
  }, [dispatch, isInitialized, initializationError]);

  // 自動保存パス更新ハンドラー（Redux版）
  const handleAutoSavePathChange = (path: string | null) => {
    dispatch(setAutoSavePath(path));
  };

  // デモモード開始
  const startDemoMode = () => {
    // アプリの状態をクリア
    dispatch(clearData());
    dispatch(setAutoSavePath(null));
    resetDemoDataState(); // デモデータのカウンターと時間をリセット
    dispatch(setDemoMode(true));
  };

  // デモモード終了
  const stopDemoMode = () => {
    dispatch(setDemoMode(false));
    // デモ終了時にもデータをクリアする場合 (任意)
    // handleClearData();
  };

  // デモデータ自動生成（createAsyncThunk統一版）
  useEffect(() => {
    if (isDemoMode) {
      demoIntervalRef.current = setInterval(async () => {
        try {
          const demoData = generateDemoData();
          console.log("🎭 [Demo] Generated data:", demoData);
          console.log("🎭 [Demo] Platform:", isDesktop ? "Desktop" : "Web");
          
          // プラットフォームに応じて適切なアクションを使用
          const action = isDesktop ? processSerialData : processServerData;
          const result = await dispatch(
            action({
              rawData: demoData,
              parseFunction: CosmicWatchDataService.parseRawData,
            })
          ).unwrap();
          
          console.log("🎭 [Demo] Processed result:", result);
        } catch (error) {
          console.error("デモデータ処理エラー:", error);
        }
      }, 1000) as unknown as number;
    } else if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    return () => {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    };
  }, [isDemoMode, dispatch]);

  // レイアウトに応じたクラス名を生成（メモ化で最適化）
  const layoutClasses = useMemo(() => {
    switch (layout) {
      case "full-sidebar":
        return {
          container: "flex flex-1 flex-row overflow-hidden",
          sidebar:
            "w-96 bg-white border-r border-gray-200 flex flex-col overflow-hidden",
          mainContent: "flex-1 overflow-y-auto",
        };
      case "mobile":
      default:
        return {
          container: "flex flex-1 flex-col",
          sidebar:
            "bg-gray-50 border-b border-gray-200 flex flex-col flex-shrink-0",
          mainContent: "flex-1 overflow-y-auto bg-gray-50",
        };
    }
  }, [layout]);

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* 上部固定ヘッダー */}
      <div className="bg-white shadow-[0_2px_8px_2px_rgba(0,0,0,0.1)] border-b border-gray-200 px-6 py-4 flex-shrink-0 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <img
              src={`${import.meta.env.BASE_URL}icon.png`}
              alt="CosmicWatch icon"
              className="h-10 w-10 mr-3 rounded-lg shadow-md"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                CosmicWatch Recorder
              </h1>
              <p className="text-sm text-gray-600">
                宇宙線検出器データ記録・解析アプリ
              </p>
            </div>
          </div>

          {/* 右上のコントロール */}
          <div className="flex items-center space-x-3">
            {isDemoMode && (
              <span className="text-red-600 font-bold text-sm bg-red-50 px-3 py-1 rounded-full border border-red-200">
                デモモード中
              </span>
            )}
            <div className="flex items-center space-x-2">
              <Squares2X2Icon className="h-5 w-5 text-gray-500" />
              <span className="text-xs text-gray-500 hidden sm:inline">
                レイアウト:
              </span>
              <LayoutSelector
                currentLayout={layout}
                userPreference={userPreference}
                isAuto={isAuto}
                onLayoutChange={setUserPreference}
              />
            </div>
            <button
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isDemoMode
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-green-500 hover:bg-green-600"
              } text-white shadow-[2px_2px_8px_rgba(0,0,0,0.15)]`}
              onClick={isDemoMode ? stopDemoMode : startDemoMode}
              title={isDemoMode ? "デモモードを停止" : "デモモードを開始"}
            >
              {isDemoMode ? (
                <StopIcon className="h-4 w-4" />
              ) : (
                <PlayIcon className="h-4 w-4" />
              )}
              <span>{isDemoMode ? "停止" : "デモ"}</span>
            </button>
            <a
              href="https://github.com/accel-kitchen/cosmicwatch-app"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHubリポジトリを開く"
              className="text-gray-600 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-100"
            >
              <MarkGithubIcon size={20} />
            </a>
          </div>
        </div>
      </div>

      {/* メインコンテンツエリア */}
      <div className={layoutClasses.container}>
        {/* 左側サイドバー（レスポンシブ） */}
        <div className={layoutClasses.sidebar}>
          <div
            className={`${
              layout === "mobile" ? "p-6" : "flex-1 overflow-y-auto p-6"
            } space-y-6`}
          >
            {/* 注意・ヒント */}
            <div className="p-6 bg-white rounded-lg shadow-[2px_2px_10px_rgba(0,0,0,0.1)]">
              <SectionTitle>
                <div className="flex items-center">
                  {!isDesktop ? (
                    <ExclamationTriangleIcon className="h-6 w-6 mr-2 text-gray-600" />
                  ) : (
                    <LightBulbIcon className="h-6 w-6 mr-2 text-gray-600" />
                  )}
                  注意・ヒント
                </div>
              </SectionTitle>
              {!isDesktop ? (
                <div className="text-sm space-y-3">
                  <div>
                    <p className="font-medium text-red-700 mb-1">⚠️ 注意</p>
                    <div className="text-red-600 space-y-1 ml-4">
                      <p>• Chrome, Edge対応（Safari非対応）</p>
                      <p>• データはダウンロードをしないと保存されません</p>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-blue-700 mb-1">💡 ヒント</p>
                    <div className="text-blue-600 ml-4">
                      <p>• 複数タブ使用で複数の検出器を接続可能</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm">
                  <p className="font-medium text-green-700 mb-1">💡 ヒント</p>
                  <div className="text-green-600 space-y-1 ml-4">
                    <p>• 自動上書き保存可能、保存先変更可能</p>
                    <p>• アプリを複数起動で複数の検出器を接続可能</p>
                  </div>
                </div>
              )}
            </div>

            {/* 1. ファイル設定 */}
            <div className="p-6 bg-white rounded-lg shadow-[2px_2px_10px_rgba(0,0,0,0.1)]">
              <FileControls
                rawData={measurementData.rawData}
                measurementStartTime={startTime}
                measurementEndTime={endTime}
                isDesktop={isDesktop}
                platformService={platformService}
                setFileHandle={handleAutoSavePathChange}
                latestRawData={latestRawData}
                parsedData={latestParsedData}
              />
            </div>

            {/* 2. CosmicWatch接続 */}
            <div className="p-4 bg-white rounded-lg shadow-[2px_2px_10px_rgba(0,0,0,0.1)]">
              <SerialConnection />
            </div>
          </div>
        </div>

        {/* 右側メインコンテンツエリア（スクロール可能） */}
        <div className={layoutClasses.mainContent}>
          <div className="p-6 space-y-6">
            {/* 3. データ解析（ヒストグラム） */}
            <div className="bg-white rounded-lg shadow-[2px_2px_10px_rgba(0,0,0,0.1)] overflow-hidden">
              <DataHistograms />
            </div>

            {/* 4. 測定データテーブル */}
            <div className="bg-white rounded-lg shadow-[2px_2px_10px_rgba(0,0,0,0.1)] overflow-hidden">
              <div className="p-4">
                <SectionTitle>
                  <div className="flex items-center">
                    <TableCellsIcon className="h-6 w-6 mr-2 text-gray-600" />
                    測定データ
                  </div>
                </SectionTitle>
                <p className="text-sm text-gray-600 mt-2 mb-4">
                  最新100件のイベントデータ
                </p>
                <div className="bg-white overflow-hidden max-h-80 overflow-y-auto rounded-lg">
                  {measurementData.parsedData.length > 0 ? (
                    <DataTable />
                  ) : (
                    <div className="p-8 text-gray-500 text-center flex flex-col items-center justify-center space-y-2">
                      <TableCellsIcon className="h-12 w-12 text-gray-300" />
                      <p className="text-lg">データ受信待ち...</p>
                      <p className="text-sm">
                        CosmicWatchからデータを受信すると、ここにテーブルが表示されます
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 5. 生データ表示 */}
            <div className="bg-white rounded-lg shadow-[2px_2px_10px_rgba(0,0,0,0.1)] overflow-hidden">
              <div className="p-4">
                <SectionTitle>
                  <div className="flex items-center">
                    <CodeBracketIcon className="h-6 w-6 mr-2 text-gray-600" />
                    生データ
                  </div>
                </SectionTitle>
                <p className="text-sm text-gray-600 mt-2 mb-4">
                  CosmicWatchから受信した生データ（最新100行）
                </p>
                {measurementData.rawData.length > 0 ? (
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-80 text-sm font-mono">
                    {measurementData.rawData.slice(-100).join("\n")}
                  </pre>
                ) : (
                  <div className="p-8 text-gray-500 text-center flex flex-col items-center justify-center space-y-2 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <CodeBracketIcon className="h-12 w-12 text-gray-300" />
                    <p className="text-lg">生データ受信待ち...</p>
                    <p className="text-sm">
                      CosmicWatchからのデータが受信されると、ここに表示されます
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* アップデートチェッカー（固定位置スナックバー） */}
      <UpdateChecker platformService={platformService} />
    </div>
  );
}

export default App;
