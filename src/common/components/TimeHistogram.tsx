import { useMemo, useState } from "react";
import { CosmicWatchData } from "../../shared/types";
import { SectionTitle } from "./Layout";
import Plot from "react-plotly.js";
import { ClockIcon } from "@heroicons/react/24/outline";

interface TimeHistogramProps {
  data: CosmicWatchData[];
  binSize: number;
  setBinSize: (size: number) => void;
  startTime: Date | null;
}

export const TimeHistogram = ({
  data,
  binSize,
  setBinSize,
  startTime,
}: TimeHistogramProps) => {
  // ズーム状態を保持
  const [zoomState, setZoomState] = useState<Record<string, unknown> | null>(null);

  // 到来間隔を計算（前のイベントとの時間差）
  const intervalVals = useMemo(() => {
    if (data.length < 2) return [];
    const intervals = [];
    for (let i = 1; i < data.length; i++) {
      const prevTime = data[i - 1].time ?? 0;
      const currentTime = data[i].time ?? 0;
      const interval = currentTime - prevTime; // ミリ秒単位
      if (interval >= 0) intervals.push(interval);
    }
    return intervals;
  }, [data]);

  // 統計情報を計算
  const stats = useMemo(() => {
    if (intervalVals.length === 0) return null;

    const sum = intervalVals.reduce((a, b) => a + b, 0);
    const mean = sum / intervalVals.length;

    const squaredDiffs = intervalVals.map((value) => Math.pow(value - mean, 2));
    const variance =
      squaredDiffs.reduce((a, b) => a + b, 0) / intervalVals.length;
    const stdDev = Math.sqrt(variance);

    const sortedData = [...intervalVals].sort((a, b) => a - b);
    const median =
      sortedData.length % 2 === 0
        ? (sortedData[sortedData.length / 2 - 1] +
            sortedData[sortedData.length / 2]) /
          2
        : sortedData[Math.floor(sortedData.length / 2)];

    // カウントレートを計算（件/秒）
    let countRate = 0;
    if (startTime) {
      const elapsedSeconds = (Date.now() - startTime.getTime()) / 1000;
      countRate = elapsedSeconds > 0 ? data.length / elapsedSeconds : 0;
    }

    return {
      count: data.length, // 総イベント数は元のデータ数
      mean: mean.toFixed(2),
      median: median.toFixed(2),
      stdDev: stdDev.toFixed(2),
      min: Math.min(...intervalVals).toFixed(2),
      max: Math.max(...intervalVals).toFixed(2),
      countRate: countRate.toFixed(4),
    };
  }, [intervalVals, data.length, startTime]);

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
        text: "到来間隔 (ms)",
        font: { size: 14, color: "#555" },
      },
      gridcolor: "#e2e8f0",
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
          color: "rgba(153, 102, 255, 0.7)",
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
        font: { color: "rgba(153, 102, 255, 0.8)" },
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
        <p className="text-gray-500 text-center">到来間隔データ受信待ち...</p>
      </div>
    );
  }

  if (intervalVals.length === 0) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500 text-center">
          到来間隔計算中...（最低2イベント必要）
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle>
        <div className="flex items-center">
          <ClockIcon className="h-6 w-6 mr-2 text-gray-600" />
          Time(到来間隔)ヒストグラム
        </div>
      </SectionTitle>

      {/* 統計情報 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-center text-sm">
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 h-16 flex flex-col justify-center">
            <div className="font-semibold text-blue-800 text-xs">
              総イベント数
            </div>
            <div className="text-lg font-bold text-blue-900">{stats.count}</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg border border-green-200 h-16 flex flex-col justify-center">
            <div className="font-semibold text-green-800 text-xs">レート</div>
            <div className="text-sm font-bold text-green-900">
              {stats.countRate} /s
            </div>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 h-16 flex flex-col justify-center">
            <div className="font-semibold text-purple-800 text-xs">平均値</div>
            <div className="text-sm font-bold text-purple-900">
              {stats.mean}ms
            </div>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 h-16 flex flex-col justify-center">
            <div className="font-semibold text-orange-800 text-xs">中央値</div>
            <div className="text-sm font-bold text-orange-900">
              {stats.median}ms
            </div>
          </div>
          <div className="bg-pink-50 p-3 rounded-lg border border-pink-200 h-16 flex flex-col justify-center">
            <div className="font-semibold text-pink-800 text-xs">最小値</div>
            <div className="text-sm font-bold text-pink-900">{stats.min}ms</div>
          </div>
          <div className="bg-red-50 p-3 rounded-lg border border-red-200 h-16 flex flex-col justify-center">
            <div className="font-semibold text-red-800 text-xs">最大値</div>
            <div className="text-sm font-bold text-red-900">{stats.max}ms</div>
          </div>
        </div>
      )}

      {/* ヒストグラム */}
      <div className="bg-white p-4 rounded-lg">
        <Plot
          revision={data.length}
          data={[
            {
              x: intervalVals,
              type: "histogram",
              autobinx: false,
              xbins: {
                start: 0,
                end: Math.max(...intervalVals),
                size: binSize,
              },
              marker: {
                color: "rgba(153, 102, 255, 0.6)",
                line: {
                  color: "rgba(153, 102, 255, 1)",
                  width: 1,
                },
              },
              hoverlabel: {
                bgcolor: "#FFF",
                font: { color: "#333" },
                bordercolor: "#999",
              },
              name: "Time",
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
              filename: "time_histogram",
              height: 500,
              width: 700,
              scale: 2,
            },
          }}
          style={{ width: "100%", height: "100%" }}
          onRelayout={handleRelayout}
        />
      </div>

      {/* 時間ビン幅設定 */}
      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-purple-800">
              時間ビン幅:
            </label>
            <input
              id="timeBinInput"
              type="number"
              min="1"
              max="200"
              value={binSize}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value >= 1 && value <= 200) {
                  setBinSize(value);
                }
              }}
              className="w-20 px-2 py-1 text-sm border border-purple-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <span className="text-xs text-purple-600">ms</span>
          </div>
          <div className="space-y-2">
            <input
              type="range"
              min="1"
              max="200"
              step="1"
              value={binSize}
              onChange={(e) => setBinSize(Number(e.target.value))}
              className="w-full h-3 bg-purple-200 rounded-lg appearance-none cursor-pointer slider-thumb:bg-purple-600"
            />
            <div className="flex justify-between text-xs text-purple-600">
              <span>1</span>
              <span>200</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
