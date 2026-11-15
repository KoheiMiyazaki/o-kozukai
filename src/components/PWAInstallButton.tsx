import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 active:scale-[0.98] whitespace-nowrap shrink-0"
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>アプリ追加</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-bold text-stone-700 transition-colors hover:bg-stone-100 active:scale-[0.98] whitespace-nowrap shrink-0 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
        >
          <Share className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span>ホームに追加</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/65 p-4 backdrop-blur-xs sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl dark:border-stone-800 dark:bg-stone-900">
              <div className="flex items-start justify-between gap-4">
                <h3
                  id="ios-install-title"
                  className="font-display text-lg font-bold text-stone-900 dark:text-stone-100"
                >
                  ホーム画面に追加する方法
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="閉じる"
                  className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ol className="mt-4 space-y-3 text-sm text-stone-700 dark:text-stone-300">
                <li className="flex items-start gap-2.5">
                  <span className="font-numeric font-bold text-emerald-700 dark:text-emerald-400">1.</span>
                  <span>
                    Safariの下部（または上部）にある <strong>共有ボタン</strong> をタップします。
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-numeric font-bold text-emerald-700 dark:text-emerald-400">2.</span>
                  <span>
                    メニューを下にスクロールし、<strong>「ホーム画面に追加」</strong> を選びます。
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-numeric font-bold text-emerald-700 dark:text-emerald-400">3.</span>
                  <span>
                    右上の <strong>「追加」</strong> をタップするとアプリとして使えます。
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-stone-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                わかりました
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
