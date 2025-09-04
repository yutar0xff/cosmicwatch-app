import { useState, useEffect, useRef, useMemo } from "react";
import { CosmicWatchData } from "../../shared/types";
import { SectionTitle } from "./Layout";
import {
  ChartBarIcon,
  ClockIcon,
  CogIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { ADCHistogram } from "./ADCHistogram";
import { CountRateChart } from "./CountRateChart";
import { CosmicWatchDataService } from "../services/CosmicWatchDataService";
import { ServerPlatformService, createPlatformService } from "../services/PlatformService";

// Redux関連のimport
import { useAppSelector } from "../../store/hooks";
import {
  selectDataHistogramsData,
  selectMeasurementDuration,
  selectIsRecording,
} from "../../store/selectors";

type GraphLayoutType = "auto" | "vertical" | "horizontal";

export const DataHistograms = () => {
  // Redux storeからデータを取得 - 統合selectorを使用
  const {
    parsedData: data,
    histogramData,
    measurementTimes,
    statistics,
  } = useAppSelector(selectDataHistogramsData);
  
  const { startTime } = measurementTimes;
  const measurementDuration = useAppSelector(selectMeasurementDuration);
  const isRecording = useAppSelector(selectIsRecording);

  const [samples, setSamples] = useState<CosmicWatchData[]>([]);
  const lastRef = useRef<number>(Date.now());
  const timerRef = useRef<number | null>(null);
  const [updateInterval, setUpdateInterval] = useState<number>(0); // 秒単位（0=常時）
  
  // プラットフォームサービス
  const [platformService, setPlatformService] = useState<ServerPlatformService | null>(null);
  const [isServerPlatform, setIsServerPlatform] = useState<boolean>(false);

  // ヒストグラム/チャート設定の状態
  const [adcBinSize, setAdcBinSize] = useState(20);
  const [countRateDataPoints, setCountRateDataPoints] = useState(10); // カウントレートのデータ点数
  const [graphLayout, setGraphLayout] = useState<GraphLayoutType>("auto"); // グラフレイアウト
  const [effectiveLayout, setEffectiveLayout] = useState<
    "vertical" | "horizontal"
  >("vertical");

  // 測定時間が5分を経過したかチェック（リアルタイム更新）
  const [currentTime, setCurrentTime] = useState(Date.now());

  // 測定中の場合のみ1秒ごとに現在時刻を更新
  useEffect(() => {
    if (!isRecording) {
      return; // 測定停止中は更新しない
    }

    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [isRecording]);

  const isMeasurementOver5Minutes = useMemo(() => {
    if (!startTime) return false;
    const elapsed = (currentTime - startTime.getTime()) / 1000;
    return elapsed > 5 * 60; // 5分 = 300秒
  }, [startTime, currentTime]);

  // 測定時間が5分を経過したら「常時」から「10秒」に自動変更
  useEffect(() => {
    if (isMeasurementOver5Minutes && updateInterval === 0) {
      setUpdateInterval(10);
    }
  }, [isMeasurementOver5Minutes, updateInterval]);

  // PlatformService初期化
  useEffect(() => {
    const initPlatformService = async () => {
      try {
        const service = await createPlatformService();
        if (service instanceof ServerPlatformService) {
          setPlatformService(service);
          setIsServerPlatform(true);
        }
      } catch (error) {
        console.error("Failed to initialize platform service:", error);
      }
    };
    initPlatformService();
  }, []);

  // サーバーファイル取得ロジックを削除（Reduxデータを直接使用）

  // 自動レイアウト判定（画面サイズに応じて縦横を決定）
  const getAutoLayout = (): "vertical" | "horizontal" => {
    const { innerWidth } = window;
    return innerWidth >= 768 ? "horizontal" : "vertical"; // md:768pxから横並び
  };

  // 画面サイズ変更を監視して自動モードの場合は動的に更新
  useEffect(() => {
    const updateLayout = () => {
      if (graphLayout === "auto") {
        const newLayout = getAutoLayout();
        setEffectiveLayout(newLayout);
      }
    };

    updateLayout(); // 初回実行
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, [graphLayout]);

  // レイアウト設定が変更された時の処理
  useEffect(() => {
    if (graphLayout === "auto") {
      const newLayout = getAutoLayout();
      setEffectiveLayout(newLayout);
    } else {
      setEffectiveLayout(graphLayout);
    }
  }, [graphLayout]);

  // グラフレイアウトに応じたグリッドクラスを決定
  const getGraphLayoutClasses = () => {
    switch (effectiveLayout) {
      case "horizontal":
        return "grid grid-cols-1 md:grid-cols-2 gap-6 divide-y-2 md:divide-y-0 md:divide-x-2 divide-gray-200";
      case "vertical":
        return "grid grid-cols-1 gap-6 divide-y-2 divide-gray-200";
      default:
        return "grid grid-cols-1 gap-6 divide-y-2 divide-gray-200";
    }
  };

  const getGraphLayoutContainerClasses = (isFirst: boolean) => {
    if (effectiveLayout === "horizontal") {
      return isFirst
        ? "min-w-0 pb-6 md:pb-0 md:pr-6"
        : "min-w-0 pt-6 md:pt-0 md:pl-6";
    } else {
      return isFirst ? "min-w-0 pb-6" : "min-w-0 pt-6";
    }
  };

  // データ更新処理（Reduxデータを直接使用）
  useEffect(() => {
    
    if (timerRef.current) clearTimeout(timerRef.current);

    // 常時更新モード（updateInterval = 0）の場合は即座に更新
    if (updateInterval === 0) {
      setSamples(data || []);
      lastRef.current = Date.now();
      return;
    }

    // 定期更新モード
    const now = Date.now();
    const intervalMs = updateInterval * 1000;
    if (now - lastRef.current >= intervalMs) {
      setSamples(data || []);
      lastRef.current = now;
    }
    
    timerRef.current = window.setTimeout(() => {
      setSamples(data || []);
      lastRef.current = Date.now();
    }, intervalMs);
    
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, updateInterval]);


  if (!samples.length) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <SectionTitle>
          <div className="flex items-center">
            <ChartBarIcon className="h-6 w-6 mr-2 text-gray-600" />
            データ解析
          </div>
        </SectionTitle>
        <div className="p-8 text-gray-500 text-center h-40 flex flex-col items-center justify-center space-y-2">
          <ChartBarIcon className="h-12 w-12 text-gray-300" />
          <p className="text-lg">データ受信待ち...</p>
          <p className="text-sm">
            CosmicWatchからデータを受信すると、ここにヒストグラムとチャートが表示されます
          </p>
        </div>
      </div>
    );
  }

  const formatElapsedTime = () => {
    if (!startTime) return "---";
    // Redux selectorから取得した測定時間を使用（停止時は固定値）
    const elapsed = measurementDuration;

    const months = Math.floor(elapsed / (30 * 24 * 3600));
    const days = Math.floor((elapsed % (30 * 24 * 3600)) / (24 * 3600));
    const hours = Math.floor((elapsed % (24 * 3600)) / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = Math.floor(elapsed % 60);

    const parts = [];
    if (months > 0) parts.push(`${months}か月`);
    if (days > 0) parts.push(`${days}日`);
    if (hours > 0) parts.push(`${hours}時間`);
    if (minutes > 0) parts.push(`${minutes}分`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}秒`);

    return parts.join("");
  };

  return (
    <div className="flex-1 overflow-hidden">
      {/* ヘッダーセクション */}
      <div className="p-4 pb-2">
        <SectionTitle>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <ChartBarIcon className="h-6 w-6 mr-2 text-gray-600" />
              データ解析
            </div>
            <div className="flex items-center space-x-8">
              {/* 測定時間 */}
              <div className="flex items-center space-x-3">
                <ClockIcon className="h-5 w-5 text-gray-500" />
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">測定時間:</span>
                  <span className="text-2xl font-bold text-gray-800">
                    {formatElapsedTime()}
                  </span>
                </div>
              </div>

              {/* 更新間隔設定 */}
              <div className="flex items-center space-x-3">
                <CogIcon className="h-5 w-5 text-gray-500" />
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">更新間隔:</span>
                  <select
                    id="updateInterval"
                    value={updateInterval}
                    onChange={(e) => setUpdateInterval(Number(e.target.value))}
                    className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={0} disabled={isMeasurementOver5Minutes}>
                      常時
                      {isMeasurementOver5Minutes ? " (無効)" : ""}
                    </option>
                    <option value={10}>10秒</option>
                    <option value={60}>1分</option>
                    <option value={600}>10分</option>
                  </select>
                </div>
              </div>

              {/* グラフレイアウト設定 */}
              <div className="flex items-center space-x-3">
                <Squares2X2Icon className="h-5 w-5 text-gray-500" />
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">レイアウト:</span>
                  <select
                    id="graphLayout"
                    value={graphLayout}
                    onChange={(e) =>
                      setGraphLayout(e.target.value as GraphLayoutType)
                    }
                    className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="auto">
                      自動 ({effectiveLayout === "horizontal" ? "横" : "縦"})
                    </option>
                    <option value="vertical">縦</option>
                    <option value="horizontal">横</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </SectionTitle>
      </div>

      {/* ヒストグラム表示エリア - レスポンシブグリッド */}
      <div className="p-4">
        <div className={getGraphLayoutClasses()}>
          {/* ADC ヒストグラム */}
          <div className={getGraphLayoutContainerClasses(true)}>
            <ADCHistogram
              data={samples}
              binSize={adcBinSize}
              setBinSize={setAdcBinSize}
              startTime={startTime}
              graphLayout={effectiveLayout}
            />
          </div>

          {/* カウントレートチャート */}
          <div className={getGraphLayoutContainerClasses(false)}>
            <CountRateChart
              data={samples}
              dataPoints={countRateDataPoints}
              setDataPoints={setCountRateDataPoints}
              startTime={startTime}
              graphLayout={effectiveLayout}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
