'use client';

interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ isOpen, onConfirm, onCancel }: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            确认重新发起分析
          </h3>
          <p className="text-gray-300">
            当前已有分析结果，重新发起分析将清空现有数据。是否继续？
          </p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-medium rounded-xl 
                     transition-all duration-200 hover:bg-white/20"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 
                     text-white font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            确认重新发起
          </button>
        </div>
      </div>
    </div>
  );
} 