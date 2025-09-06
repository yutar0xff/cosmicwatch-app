import { useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { CosmicWatchData } from "../../shared/types";
import { SectionTitle } from "./Layout";
import { ClockIcon } from "@heroicons/react/24/outline";

interface CountRateChartProps {
  data: CosmicWatchData[];
  startTime: Date | null;
  dataPoints: number;
  setDataPoints: (points: number) => void;
  graphLayout?: "vertical" | "horizontal";
}

export const CountRateChart = ({
  data,
  startTime,
  dataPoints,
  setDataPoints,
  graphLayout = "vertical",
}: CountRateChartProps) => {
  // ズーム状態を保持
  const [zoomState, setZoomState] = useState<Record<string, unknown> | null>(null);

  // 日付文字列をDateオブジェクトに変換するヘルパー関数
  const parseCustomDateString = (dateString: string): Date => {
    
    let isoString = "";
    let date: Date;
    
    // パターン1: "2025-05-25-09-03-31.291" （ミリ秒付き）
    const patternWithMs = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.(\d{3})$/;
    const matchWithMs = dateString.match(patternWithMs);
    
    if (matchWithMs) {
      isoString = dateString.replace(patternWithMs, "$1-$2-$3T$4:$5:$6.$7Z");
    } else {
      // パターン2: "2025-05-25-09-03-31" （ミリ秒なし）
      const patternWithoutMs = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/;
      const matchWithoutMs = dateString.match(patternWithoutMs);
      
      if (matchWithoutMs) {
        isoString = dateString.replace(patternWithoutMs, "$1-$2-$3T$4:$5:$6.000Z");
      } else {
        // パターン3: 標準ISO形式を試行
        isoString = dateString;
      }
    }
    
    
    date = new Date(isoString);
    
    if (isNaN(date.getTime())) {
      
      // フォールバック: 現在時刻を使用
      date = new Date();
    }
    
    return date;
  };

  // カウントレートデータを計算
  const countRateData = useMemo(() => {
    
    if (!startTime || data.length === 0) {
      return { xData: [], yData: [], stats: null };
    }

    const currentTime = Date.now();
    const totalElapsedMs = currentTime - startTime.getTime();

    // データを時刻順にソート（念のため）し、有効な日付データのみを抽出
    const sortedData = data
      .map((event) => {
        if (!event.date) {
          return null;
        }
        try {
          const eventTime = parseCustomDateString(event.date).getTime();
          return { ...event, parsedTime: eventTime };
        } catch (error) {
          return null;
        }
      })
      .filter(
        (event): event is typeof event & { parsedTime: number } =>
          event !== null
      )
      .sort((a, b) => a.parsedTime - b.parsedTime);

    if (sortedData.length === 0) {
      return { xData: [], yData: [], stats: null };
    }


    // 実際のデータ範囲を計算
    const firstEventTime = sortedData[0].parsedTime;
    const lastEventTime = sortedData[sortedData.length - 1].parsedTime;
    const dataRangeMs = Math.max(
      lastEventTime - firstEventTime,
      totalElapsedMs
    );
    const windowSizeMs = dataRangeMs / dataPoints;

    const xData: (string | Date)[] = [];
    const yData: number[] = [];
    const rates: number[] = [];

    // 効率的なカウント（ポインタ方式）
    let dataIndex = 0; // 現在処理中のデータのインデックス

    for (let i = 0; i < dataPoints; i++) {
      const windowStart = firstEventTime + i * windowSizeMs;
      const windowEnd = windowStart + windowSizeMs;
      const windowCenter = windowStart + windowSizeMs / 2;

      // 現在の時間窓の開始位置まで進める
      while (
        dataIndex < sortedData.length &&
        sortedData[dataIndex].parsedTime < windowStart
      ) {
        dataIndex++;
      }

      // 時間窓内のイベントをカウント
      let eventsInWindow = 0;
      let tempIndex = dataIndex;
      while (
        tempIndex < sortedData.length &&
        sortedData[tempIndex].parsedTime < windowEnd
      ) {
        eventsInWindow++;
        tempIndex++;
      }

      // カウントレート（events/秒）を計算
      const rate = eventsInWindow / (windowSizeMs / 1000);

      // X軸は実際の日付時刻（ISO文字列として）
      const centerDate = new Date(windowCenter);
      xData.push(centerDate.toISOString());
      yData.push(rate);
      rates.push(rate);
    }

    // 時間範囲に応じた適切なフォーマットを決定
    const timeRangeMs = dataRangeMs;
    let tickFormat: string;
    let title: string;

    if (timeRangeMs < 3 * 60 * 1000) {
      // 3分未満: 秒表示
      tickFormat = "%H:%M:%S";
      title = "時刻 (HH:MM:SS)";
    } else if (timeRangeMs < 12 * 60 * 60 * 1000) {
      // 12時間未満: 分表示
      tickFormat = "%H:%M";
      title = "時刻 (HH:MM)";
    } else if (timeRangeMs < 7 * 24 * 60 * 60 * 1000) {
      // 7日未満: 時間表示
      tickFormat = "%m/%d %H:%M";
      title = "日時 (MM/DD HH:MM)";
    } else if (timeRangeMs < 6 * 30 * 24 * 60 * 60 * 1000) {
      // 6ヶ月未満: 日表示
      tickFormat = "%m/%d";
      title = "日付 (MM/DD)";
    } else {
      // 6ヶ月以上: 月表示
      tickFormat = "%Y/%m";
      title = "年月 (YYYY/MM)";
    }

    // 統計情報を計算
    const validRates = rates.filter((r) => !isNaN(r) && isFinite(r));
    const stats =
      validRates.length > 0
        ? {
            count: validRates.length,
            mean: (
              validRates.reduce((a, b) => a + b, 0) / validRates.length
            ).toFixed(4),
            min: Math.min(...validRates).toFixed(4),
            max: Math.max(...validRates).toFixed(4),
            totalEvents: data.length,
            validEvents: sortedData.length, // パース成功したイベント数
            avgRate:
              sortedData.length > 0 && dataRangeMs > 0
                ? (sortedData.length / (dataRangeMs / 1000)).toFixed(4)
                : "0",
          }
        : null;

    return { xData, yData, stats, tickFormat, xAxisTitle: title };
  }, [data, startTime, dataPoints]);

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
      type: "date",
      title: {
        text: countRateData.xAxisTitle || "時刻",
        font: { size: 14, color: "#555" },
      },
      tickformat: countRateData.tickFormat || "%H:%M:%S",
      tickangle:
        countRateData.tickFormat === "%m/%d %H:%M" ||
        countRateData.tickFormat === "%m/%d" ||
        countRateData.tickFormat === "%Y/%m"
          ? -45
          : 0,
      gridcolor: "#e2e8f0",
      tickfont: { size: 12 },
    },
    yaxis: {
      title: {
        text: "CPS (/s)",
        font: { size: 14, color: "#555" },
      },
      gridcolor: "#e2e8f0",
      tickfont: { size: 12 },
    },
  };

  // 統計情報がある場合は平均値の線を追加
  if (countRateData.stats && countRateData.xData.length > 0) {
    const firstDate = countRateData.xData[0];
    const lastDate = countRateData.xData[countRateData.xData.length - 1];

    layoutConfig.shapes = [
      {
        type: "line",
        x0: firstDate,
        y0: countRateData.stats.avgRate,
        x1: lastDate,
        y1: countRateData.stats.avgRate,
        line: {
          color: "rgba(139, 92, 246, 0.8)",
          width: 2,
          dash: "dash",
        },
      },
    ];

    layoutConfig.annotations = [
      {
        x: lastDate,
        y: countRateData.stats.avgRate,
        text: "平均値",
        showarrow: true,
        arrowhead: 2,
        ax: 40,
        ay: -20,
        font: { color: "rgba(139, 92, 246, 0.9)" },
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

  if (data.length === 0 || !startTime) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500 text-center">
          カウントレートデータ受信待ち...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle>
        <div className="flex items-center">
          <ClockIcon className="h-6 w-6 mr-2 text-gray-600" />
          カウントレート時間推移
        </div>
      </SectionTitle>

      {/* 統計情報 */}
      {countRateData.stats && (
        <>
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
              <div className="text-lg font-bold text-blue-900">
                {countRateData.stats.totalEvents}
              </div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg border border-green-200 flex flex-col items-center justify-center text-center">
              <div className="font-semibold text-green-800 text-xs">平均値</div>
              <div className="text-sm font-bold text-green-900">
                {countRateData.stats.mean} /s
              </div>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 flex flex-col items-center justify-center text-center">
              <div className="font-semibold text-orange-800 text-xs">
                最大値
              </div>
              <div className="text-sm font-bold text-orange-900">
                {countRateData.stats.max} /s
              </div>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 flex flex-col items-center justify-center text-center">
              <div className="font-semibold text-yellow-800 text-xs">
                最小値
              </div>
              <div className="text-sm font-bold text-yellow-900">
                {countRateData.stats.min} /s
              </div>
            </div>
          </div>
        </>
      )}

      {/* カウントレートグラフ */}
      <div className="bg-white p-4 rounded-lg">
        <Plot
          revision={data.length}
          data={[
            {
              x: countRateData.xData,
              y: countRateData.yData,
              type: "scatter",
              mode: "lines+markers",
              name: "カウントレート",
              line: {
                color: "#8b5cf6",
                width: 2,
              },
              marker: {
                color: "#8b5cf6",
                size: 4,
              },
              hoverlabel: {
                bgcolor: "#FFF",
                font: { color: "#333" },
                bordercolor: "#999",
              },
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
              filename: "count_rate_chart",
              height: 500,
              width: 700,
              scale: 2,
            },
          }}
          style={{ width: "100%", height: "100%" }}
          onRelayout={handleRelayout}
        />
      </div>

      {/* データ点数設定 */}
      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-purple-800">
              データ点数: {dataPoints}点
            </label>
          </div>
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max="4"
              step="1"
              value={[10, 20, 50, 100, 200].indexOf(dataPoints)}
              onChange={(e) => {
                const values = [10, 20, 50, 100, 200];
                const index = Number(e.target.value);
                setDataPoints(values[index]);
              }}
              className="w-full h-3 bg-purple-200 rounded-lg appearance-none cursor-pointer slider-thumb:bg-purple-600"
            />
            <div className="relative text-xs text-purple-600 pb-6">
              <span
                className="absolute"
                style={{ left: "0%", transform: "translateX(-50%)" }}
              >
                10
              </span>
              <span
                className="absolute"
                style={{ left: "25%", transform: "translateX(-50%)" }}
              >
                20
              </span>
              <span
                className="absolute"
                style={{ left: "50%", transform: "translateX(-50%)" }}
              >
                50
              </span>
              <span
                className="absolute"
                style={{ left: "75%", transform: "translateX(-50%)" }}
              >
                100
              </span>
              <span
                className="absolute"
                style={{ left: "100%", transform: "translateX(-50%)" }}
              >
                200
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
