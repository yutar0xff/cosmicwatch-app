import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { PortInfo } from "../../shared/types";

// Redux管理用の状態（シリアライズ可能なもののみ）
export interface SerialPortState {
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  error: string | null;
  portInfo: PortInfo | null;
  hasLastConnectedPort: boolean; // 前回接続したポートがあるかの状態のみ
  connectionId: string | null; // 接続セッションID
}

const initialState: SerialPortState = {
  isConnected: false,
  isConnecting: false,
  isDisconnecting: false,
  error: null,
  portInfo: null,
  hasLastConnectedPort: false,
  connectionId: null,
};

// 非同期アクション: シリアルポート接続状態更新（状態管理専用）
export const connectSerialPort = createAsyncThunk(
  "serialPort/connect",
  async (
    params: {
      portInfo: SerialPortInfo;
      connectionId?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const connectionId =
        params.connectionId ||
        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      return {
        portInfo: params.portInfo,
        connectionId,
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

// 非同期アクション: シリアルポート再接続状態更新（状態管理専用）
export const reconnectSerialPort = createAsyncThunk(
  "serialPort/reconnect",
  async (
    params: {
      portInfo: SerialPortInfo;
      connectionId?: string;
    },
    { getState, rejectWithValue }
  ) => {
    try {
      const state = getState() as { serialPort: SerialPortState };
      if (!state.serialPort.hasLastConnectedPort) {
        throw new Error("前回の接続情報がありません");
      }

      const connectionId =
        params.connectionId ||
        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      return {
        portInfo: params.portInfo,
        connectionId,
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

// 非同期アクション: シリアルポート切断
export const disconnectSerialPort = createAsyncThunk(
  "serialPort/disconnect",
  async (
    params: {
      port?: SerialPort;
      reader?: ReadableStreamDefaultReader;
      writer?: WritableStreamDefaultWriter;
    },
    { rejectWithValue }
  ) => {
    try {
      const { port, reader, writer } = params;

      // リーダーをクローズ
      if (reader) {
        try {
          await reader.cancel();
          reader.releaseLock();
        } catch (error) {
          console.warn("リーダーのクローズ中にエラー:", error);
        }
      }

      // ライターをクローズ
      if (writer) {
        try {
          await writer.close();
        } catch (error) {
          console.warn("ライターのクローズ中にエラー:", error);
        }
      }

      // ポートをクローズ
      if (port) {
        try {
          await port.close();
        } catch (error) {
          console.warn("ポートのクローズ中にエラー:", error);
        }
      }

      return {};
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

const serialPortSlice = createSlice({
  name: "serialPort",
  initialState,
  reducers: {
    // 【統一アーキテクチャ】手動操作は非推奨 - createAsyncThunkを使用してください

    // エラークリア（ユーザー操作用）
    clearError: (state) => {
      state.error = null;
    },

    // 完全リセット（アプリ終了時など）
    resetSerialPort: (state) => {
      state.isConnected = false;
      state.isConnecting = false;
      state.isDisconnecting = false;
      state.error = null;
      state.portInfo = null;
      state.hasLastConnectedPort = false;
      state.connectionId = null;
    },
  },
  extraReducers: (builder) => {
    // connectSerialPort
    builder
      .addCase(connectSerialPort.pending, (state) => {
        state.isConnecting = true;
        state.error = null;
      })
      .addCase(connectSerialPort.fulfilled, (state, action) => {
        state.portInfo = action.payload.portInfo;
        state.connectionId = action.payload.connectionId;
        state.hasLastConnectedPort = true;
        state.isConnected = true;
        state.isConnecting = false;
        state.isDisconnecting = false;
        state.error = null;
      })
      .addCase(connectSerialPort.rejected, (state, action) => {
        state.isConnecting = false;
        state.error = action.payload as string;
      });

    // reconnectSerialPort
    builder
      .addCase(reconnectSerialPort.pending, (state) => {
        state.isConnecting = true;
        state.error = null;
      })
      .addCase(reconnectSerialPort.fulfilled, (state, action) => {
        state.portInfo = action.payload.portInfo;
        state.connectionId = action.payload.connectionId;
        state.isConnected = true;
        state.isConnecting = false;
        state.isDisconnecting = false;
        state.error = null;
      })
      .addCase(reconnectSerialPort.rejected, (state, action) => {
        state.isConnecting = false;
        state.error = action.payload as string;
      });

    // disconnectSerialPort
    builder
      .addCase(disconnectSerialPort.pending, (state) => {
        state.isDisconnecting = true;
      })
      .addCase(disconnectSerialPort.fulfilled, (state) => {
        state.isConnected = false;
        state.isConnecting = false;
        state.isDisconnecting = false;
        state.error = null;
        state.connectionId = null;
      })
      .addCase(disconnectSerialPort.rejected, (state, action) => {
        state.isDisconnecting = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, resetSerialPort } = serialPortSlice.actions;

export default serialPortSlice.reducer;
