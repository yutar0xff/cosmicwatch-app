import { useMemo, useState } from "react";
import { CosmicWatchData } from "../../shared/types";
import { SectionTitle } from "./Layout";
import Plot from "react-plotly.js";
import { ChartBarIcon } from "@heroicons/react/24/outline";

interface ADCHistogramProps {
  data: CosmicWatchData[];
  binSize: number;
  setBinSize: (size: number) => void;
  startTime: Date | null;
  graphLayout?: "vertical" | "horizontal";
}

interface OptimizedStats {
  count: number;
  mean: string;
  median: string;
  stdDev: string;
  min: number;
  max: number;
  countRate: string;
  sampleSize: number;
  totalSize: number;
  isSampled: boolean;
}

export const ADCHistogram = ({
  data,
  binSize,
  setBinSize,
  startTime,
  graphLayout = "vertical",
}: ADCHistogramProps) => {
  // ズーム状態とサンプリング設定を保持
  const [zoomState, setZoomState] = useState<Record<string, unknown> | null>(null);
  const [maxSampleSize, setMaxSampleSize] = useState(10000);
  const [useSmartSampling, setUseSmartSampling] = useState(true);

  // データサンプリング（大量データ対策）
  const sampledData = useMemo(() => {
    if (data.length <= maxSampleSize) {
      return {
        sampled: data,
        isSampled: false,
        sampleSize: data.length,
        totalSize: data.length
      };
    }

    if (useSmartSampling) {
      // 時系列を考慮したスマートサンプリング
      const step = Math.ceil(data.length / maxSampleSize);
      const sampled = data.filter((_, index) => index % step === 0);
      
      // 最新データも確実に含める
      const latestData = data.slice(-Math.min(1000, maxSampleSize / 4));
      const combinedSampled = [...sampled, ...latestData]
        .filter((item, index, array) => 
          array.findIndex(other => other.event === item.event) === index
        )
        .slice(0, maxSampleSize);

      return {
        sampled: combinedSampled,
        isSampled: true,
        sampleSize: combinedSampled.length,
        totalSize: data.length
      };
    } else {
      // ランダムサンプリング
      const indices = Array.from({ length: data.length }, (_, i) => i)
        .sort(() => Math.random() - 0.5)
        .slice(0, maxSampleSize);
      
      const sampled = indices.map(i => data[i]);
      return {
        sampled,
        isSampled: true,
        sampleSize: sampled.length,
        totalSize: data.length
      };
    }
  }, [data, maxSampleSize, useSmartSampling]);

  const adcVals = useMemo(() => sampledData.sampled.map((d) => d.adc), [sampledData]);

  // 統計情報を計算（最適化版）
  const stats = useMemo((): OptimizedStats | null => {
    if (adcVals.length === 0) return null;

    // 基本統計値を効率的に計算
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    
    for (let i = 0; i < adcVals.length; i++) {
      const val = adcVals[i];
      sum += val;
      if (val < min) min = val;
      if (val > max) max = val;
    }
    
    const mean = sum / adcVals.length;

    // 分散を効率的に計算
    let squaredSum = 0;
    for (let i = 0; i < adcVals.length; i++) {
      const diff = adcVals[i] - mean;
      squaredSum += diff * diff;
    }
    const variance = squaredSum / adcVals.length;
    const stdDev = Math.sqrt(variance);

    // メディアン計算（サンプル数が多い場合は近似値）
    let median: number;
    if (sampledData.isSampled && adcVals.length > 1000) {
      // サンプリング時は近似メディアン（パーセンタイル使用）
      const sorted = [...adcVals].sort((a, b) => a - b);
      median = sorted[Math.floor(sorted.length / 2)];
    } else {
      // 正確なメディアン
      const sortedData = [...adcVals].sort((a, b) => a - b);
      median = sortedData.length % 2 === 0
        ? (sortedData[sortedData.length / 2 - 1] + sortedData[sortedData.length / 2]) / 2
        : sortedData[Math.floor(sortedData.length / 2)];
    }

    // カウントレートを計算（実際の総データ数を使用）
    let countRate = 0;
    if (startTime) {
      const elapsedSeconds = (Date.now() - startTime.getTime()) / 1000;
      countRate = elapsedSeconds > 0 ? sampledData.totalSize / elapsedSeconds : 0;
    }

    return {
      count: sampledData.totalSize, // 実際の総数
      mean: mean.toFixed(2),
      median: median.toFixed(2),
      stdDev: stdDev.toFixed(2),
      min,
      max,
      countRate: countRate.toFixed(4),
      sampleSize: sampledData.sampleSize,
      totalSize: sampledData.totalSize,
      isSampled: sampledData.isSampled,
    };
  }, [adcVals, startTime, sampledData]);

  // グラフのズーム状態が変更されたときのハンドラ
  const handleRelayout = (event: Record<string, unknown>) => {
    if (
      (event["xaxis.range[0]"] !== undefined &&
        event["xaxis.range[1]"] !== undefined) ||
      (event["yaxis.range[0]"] !== undefined &&
        event["yaxis.range[1]"] !== undefined)
    ) {
      setZoomState({
        "xaxis.range[0]": event["xaxis.range[0]"],
        "xaxis.range[1]": event["xaxis.range[1]"],
        "yaxis.range[0]": event["yaxis.range[0]"],
        "yaxis.range[1]": event["yaxis.range[1]"],
      });
    } else if (
      event.autosize ||
      event["xaxis.autorange"] ||
      event["yaxis.autorange"]
    ) {
      setZoomState(null);
    }
  };

  // レイアウト設定を作成（ズーム状態を反映）
  const layoutConfig: any = {
    width: undefined,
    height: 380,
    autosize: true,
    margin: { t: 40, r: 30, l: 50, b: 60 },
    paper_bgcolor: "#fff",
    plot_bgcolor: "#f8fafc",
    title: {
      text: "",
      font: { size: 16, color: "#374151" },
    },
    xaxis: {
      title: {
        text: "ADC",
        font: { size: 14, color: "#555" },
      },
      gridcolor: "#e2e8f0",
      tickangle: -45,
      tickfont: { size: 12 },
    },
    yaxis: {
      title: {
        text: "Count",
        font: { size: 14, color: "#555" },
      },
      gridcolor: "#e2e8f0",
      tickfont: { size: 12 },
    },
    bargap: 0.02,
  };

  // 統計情報がある場合は平均値の線とアノテーションを追加
  if (stats) {
    layoutConfig.shapes = [
      {
        type: "line",
        x0: stats.mean,
        y0: 0,
        x1: stats.mean,
        y1: 1,
        yref: "paper",
        line: {
          color: "rgba(75, 192, 192, 0.8)",
          width: 2,
          dash: "dash",
        },
      },
    ];

    layoutConfig.annotations = [
      {
        x: stats.mean,
        y: 1,
        yref: "paper",
        text: "平均値",
        showarrow: true,
        arrowhead: 2,
        ax: 40,
        ay: -20,
        font: { color: "rgba(75, 192, 192, 0.9)" },
      },
    ];
  }

  // ズーム状態があれば適用
  if (zoomState) {
    layoutConfig.xaxis.range = [
      zoomState["xaxis.range[0]"],
      zoomState["xaxis.range[1]"],
    ];
    layoutConfig.yaxis.range = [
      zoomState["yaxis.range[0]"],
      zoomState["yaxis.range[1]"],
    ];
  }

  if (data.length === 0) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500 text-center">ADCデータ受信待ち...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle>
        <div className="flex items-center">
          <ChartBarIcon className="h-6 w-6 mr-2 text-gray-600" />
          ADC(エネルギー)ヒストグラム
        </div>
      </SectionTitle>

      {/* 統計情報 */}
      {stats && (
        <div className="space-y-3">
          {/* サンプリング情報（サンプル時のみ表示） */}
          {stats.isSampled && (
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-2 text-sm text-yellow-800">
                <ChartBarIcon className="h-4 w-4" />
                <span className="font-medium">パフォーマンス最適化:</span>
                <span>{stats.sampleSize.toLocaleString()}件のサンプル表示 (全体: {stats.totalSize.toLocaleString()}件)</span>
              </div>
            </div>
          )}

          <div
            className={`grid gap-2 text-sm ${
              graphLayout === "horizontal"
                ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
                : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
            }`}
          >
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 flex flex-col items-center justify-center text-center">
              <div className="font-semibold text-blue-800 text-xs">
                総イベント数
              </div>
              <div className="text-lg font-bold text-blue-900">{stats.count.toLocaleString()}</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg border border-green-200 flex flex-col items-center justify-center text-center">
              <div className="font-semibold text-green-800 text-xs">レート</div>
              <div className="text-sm font-bold text-green-900">
                {stats.countRate} /s
              </div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 flex flex-col items-center justify-center text-center">
              <div className="font-semibold text-purple-800 text-xs">平均値</div>
              <div className="text-sm font-bold text-purple-900">
                {stats.mean}
              </div>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 flex flex-col items-center justify-center text-center">
              <div className="font-semibold text-orange-800 text-xs">標準偏差</div>
              <div className="text-sm font-bold text-orange-900">
                {stats.stdDev}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ヒストグラム */}
      <div className="bg-white p-4 rounded-lg">
        <Plot
          revision={data.length}
          data={[
            {
              x: adcVals,
              type: "histogram",
              autobinx: false,
              xbins: { start: 0, end: 1023, size: binSize },
              marker: {
                color: "rgba(75, 192, 192, 0.6)",
                line: {
                  color: "rgba(75, 192, 192, 1)",
                  width: 1,
                },
              },
              hoverlabel: {
                bgcolor: "#FFF",
                font: { color: "#333" },
                bordercolor: "#999",
              },
              name: "ADC",
              opacity: 0.85,
            },
          ]}
          layout={layoutConfig}
          config={{
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ["lasso2d", "select2d"],
            toImageButtonOptions: {
              format: "png",
              filename: "adc_histogram",
              height: 500,
              width: 700,
              scale: 2,
            },
          }}
          style={{ width: "100%", height: "100%" }}
          onRelayout={handleRelayout}
        />
      </div>

      {/* ADCビン幅設定 */}
      <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-teal-800">
              ADC ビン幅:
            </label>
            <input
              id="adcBinInput"
              type="number"
              min="1"
              max="100"
              value={binSize}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value >= 1 && value <= 100) {
                  setBinSize(value);
                }
              }}
              className="w-20 px-2 py-1 text-sm border border-teal-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div className="space-y-2">
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={binSize}
              onChange={(e) => setBinSize(Number(e.target.value))}
              className="w-full h-3 bg-teal-200 rounded-lg appearance-none cursor-pointer slider-thumb:bg-teal-600"
            />
            <div className="flex justify-between text-xs text-teal-600">
              <span>1</span>
              <span>100</span>
            </div>
          </div>
        </div>
      </div>

      {/* パフォーマンス設定（大量データ時のみ表示） */}
      {data.length > 1000 && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-800">パフォーマンス設定</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-700">
                  最大表示データ数: {maxSampleSize.toLocaleString()}件
                </label>
                <input
                  type="range"
                  min="1000"
                  max="50000"
                  step="1000"
                  value={maxSampleSize}
                  onChange={(e) => setMaxSampleSize(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>1K</span>
                  <span>50K</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    id="smartSampling"
                    type="checkbox"
                    checked={useSmartSampling}
                    onChange={(e) => setUseSmartSampling(e.target.checked)}
                    className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                  />
                  <label htmlFor="smartSampling" className="text-sm text-gray-700">
                    スマートサンプリング
                  </label>
                </div>
                <div className="text-xs text-gray-500">
                  {useSmartSampling 
                    ? "時系列を考慮した効率的なサンプリング" 
                    : "ランダムサンプリング"}
                </div>
              </div>
            </div>

            {/* データ情報 */}
            <div className="pt-2 border-t border-gray-200 text-xs text-gray-600">
              総データ数: {data.length.toLocaleString()}件
              {stats?.isSampled && (
                <span className="ml-2">
                  (表示: {stats.sampleSize.toLocaleString()}件、{((stats.sampleSize / stats.totalSize) * 100).toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
