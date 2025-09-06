import { useState, useRef, useEffect } from "react";
import DevicePhoneMobileIcon from "@heroicons/react/24/outline/DevicePhoneMobileIcon";
import ComputerDesktopIcon from "@heroicons/react/24/outline/ComputerDesktopIcon";
import CogIcon from "@heroicons/react/24/outline/CogIcon";
import ChevronDownIcon from "@heroicons/react/24/outline/ChevronDownIcon";
import { LayoutType } from "../hooks/useResponsiveLayout";

interface LayoutSelectorProps {
  currentLayout: LayoutType;
  userPreference: "auto" | LayoutType;
  isAuto: boolean;
  onLayoutChange: (preference: "auto" | LayoutType) => void;
}

export const LayoutSelector = ({
  currentLayout,
  userPreference,
  isAuto,
  onLayoutChange,
}: LayoutSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const getLayoutIcon = (layout: LayoutType | "auto") => {
    switch (layout) {
      case "mobile":
        return <DevicePhoneMobileIcon className="h-4 w-4" />;
      case "full-sidebar":
        return <ComputerDesktopIcon className="h-4 w-4" />;
      case "auto":
        return <CogIcon className="h-4 w-4" />;
      default:
        return <CogIcon className="h-4 w-4" />;
    }
  };

  const getLayoutName = (layout: LayoutType | "auto") => {
    switch (layout) {
      case "mobile":
        return "縦積み";
      case "full-sidebar":
        return "フルサイズ";
      case "auto":
        return "自動";
      default:
        return "自動";
    }
  };

  const options: ("auto" | LayoutType)[] = ["auto", "mobile", "full-sidebar"];

  // 外部クリックでメニューを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleOptionClick = (option: "auto" | LayoutType) => {
    onLayoutChange(option);
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        title="レイアウトを変更"
      >
        {getLayoutIcon(userPreference)}
        <span className="hidden sm:inline">
          {getLayoutName(userPreference)}
          {isAuto && (
            <span className="text-xs text-gray-500 ml-1">
              ({getLayoutName(currentLayout)})
            </span>
          )}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-56 origin-top-right bg-white border border-gray-200 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => handleOptionClick(option)}
                className={`${
                  userPreference === option
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-900 hover:bg-gray-100"
                } group flex items-center w-full px-4 py-2 text-sm transition-colors`}
              >
                <div className="mr-3 flex-shrink-0">
                  {getLayoutIcon(option)}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">{getLayoutName(option)}</div>
                  {option === "auto" && (
                    <div className="text-xs text-gray-500">
                      画面サイズに応じて自動選択
                    </div>
                  )}
                  {option === "mobile" && (
                    <div className="text-xs text-gray-500">
                      縦積みレイアウト
                    </div>
                  )}
                  {option === "full-sidebar" && (
                    <div className="text-xs text-gray-500">サイドバー表示</div>
                  )}
                </div>
                {userPreference === option && (
                  <div className="ml-2 flex-shrink-0">
                    <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
