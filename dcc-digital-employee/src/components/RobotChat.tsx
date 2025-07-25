'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function RobotChat() {
  const [robotMessage, setRobotMessage] = useState("欢迎来到DCC数字员工平台！我是您的智能助手，有什么可以帮您？");
  const [isVisible, setIsVisible] = useState(false);
  const [robotAnimation, setRobotAnimation] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // 强制使用动画机器人（调试用）
  // 如果GIF加载还有问题，可以设置为true
  const [useAnimatedRobot, setUseAnimatedRobot] = useState(true);

  useEffect(() => {
    // 页面加载后开始机器人动画
    setRobotAnimation(true);
    
    // 延迟显示气泡，产生打字效果
    setTimeout(() => {
      setIsVisible(true);
    }, 500);
  }, []);

  return (
    <div className="flex items-center gap-0 mb-4 w-full">
      <div className="w-auto flex justify-center mr-2">
        {/* 机器人容器，添加动画效果和背景 */}
        <div 
          className={`rounded-lg overflow-hidden w-24 h-32 flex items-center justify-center transition-all duration-700 ease-in-out ${
            robotAnimation ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
          }`}
        >
          <Image 
              src="/images/51_1744852109.gif" 
              alt="Robot Animation" 
              width={100} 
              height={128} 
              className="animate-float"
              onError={() => setImageError(true)}
              priority
              style={{ background: 'transparent' }}
            />
        </div>
      </div>
      <div className="w-auto max-w-[70%]">
        {/* 气泡容器，修改背景色确保文字可见 */}
        <div 
          className={`bg-white p-3 rounded-xl relative shadow-md transition-all duration-700 ease-in-out inline-block ${
            isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
          }`}
        >
          <div className="absolute w-3 h-3 bg-white transform rotate-45 left-0 top-1/2 -ml-1.5"></div>
          <p className="text-gray-800 text-sm font-medium typing-effect">
            {isVisible && robotMessage.split('').map((char, index) => (
              <span 
                key={index} 
                className="inline-block"
                style={{ 
                  animation: `fadeIn 0.05s forwards`,
                  animationDelay: `${index * 0.05}s`,
                  opacity: 0
                }}
              >
                {char}
              </span>
            ))}
          </p>
        </div>
      </div>
      
      {/* 添加必要的动画样式 */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
          100% { transform: translateY(0px); }
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
} 