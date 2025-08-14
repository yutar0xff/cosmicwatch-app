// TypeScript 型定義ファイル

// JSON ファイルをモジュールとしてインポートできるようにする
declare module "*.json" {
  const value: {
    name: string;
    version: string;
    repository: {
      type: string;
      url: string;
    };
    [key: string]: any;
  };
  export default value;
}

// Heroicons型定義
declare module '@heroicons/react/24/solid' {
  export const PlayIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const PauseIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const StopIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const CheckIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const XMarkIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const ExclamationTriangleIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const InformationCircleIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  [key: string]: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

declare module '@heroicons/react/24/outline' {
  export const PlayIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const PauseIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const StopIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const ArrowDownTrayIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const FolderOpenIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const Cog6ToothIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const ChartBarIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const ClockIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const ComputerDesktopIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const DeviceTabletIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const DevicePhoneMobileIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const InformationCircleIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const ExclamationTriangleIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const CheckCircleIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const XCircleIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const ArrowPathIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  [key: string]: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}
