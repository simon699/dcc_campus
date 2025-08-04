// 用户活动监听器
import { checkTokenValidity } from '../services/api';
import { handleTokenExpired } from './tokenUtils';

class ActivityMonitor {
  private timeoutId: NodeJS.Timeout | null = null;
  private lastActivityTime: number = Date.now();
  private isMonitoring: boolean = false;
  private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30分钟无操作
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 每5分钟检查一次

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // 监听用户活动事件
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, this.handleUserActivity.bind(this), true);
    });

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
  }

  private handleUserActivity() {
    this.lastActivityTime = Date.now();
    
    // 如果之前没有在监控，现在开始监控
    if (!this.isMonitoring) {
      this.startMonitoring();
    }
  }

  private handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      // 页面变为可见时，检查是否长时间无操作
      const timeSinceLastActivity = Date.now() - this.lastActivityTime;
      if (timeSinceLastActivity > this.INACTIVITY_TIMEOUT) {
        this.checkTokenValidity();
      }
    }
  }

  private startMonitoring() {
    this.isMonitoring = true;
    this.scheduleNextCheck();
  }

  private scheduleNextCheck() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      this.checkInactivity();
    }, this.CHECK_INTERVAL);
  }

  private checkInactivity() {
    const timeSinceLastActivity = Date.now() - this.lastActivityTime;
    
    if (timeSinceLastActivity > this.INACTIVITY_TIMEOUT) {
      // 用户长时间无操作，检查token有效性
      this.checkTokenValidity();
    } else {
      // 继续监控
      this.scheduleNextCheck();
    }
  }

  private async checkTokenValidity() {
    try {
      console.log('活动监听器：检查token有效性...');
      const isValid = await checkTokenValidity();
      if (!isValid) {
        console.log('活动监听器：Token无效，处理token失效');
        this.handleTokenExpired();
        return;
      }

      console.log('活动监听器：Token有效，继续监控');
      // Token有效，继续监控
      this.scheduleNextCheck();
    } catch (error) {
      console.error('活动监听器：Token验证失败:', error);
      this.handleTokenExpired();
    }
  }

  private handleTokenExpired() {
    console.log('活动监听器：Token已失效，正在跳转到登录页面...');
    
    // 停止监控
    this.stopMonitoring();
    
    // 使用统一的token失效处理函数
    handleTokenExpired();
  }

  public stopMonitoring() {
    console.log('活动监听器：停止监控');
    this.isMonitoring = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  public resetActivity() {
    this.lastActivityTime = Date.now();
  }

  public start() {
    console.log('活动监听器：开始监控');
    this.lastActivityTime = Date.now();
    this.startMonitoring();
  }
}

// 创建全局实例
let activityMonitor: ActivityMonitor | null = null;

export const getActivityMonitor = (): ActivityMonitor => {
  if (!activityMonitor) {
    activityMonitor = new ActivityMonitor();
  }
  return activityMonitor;
};

export default ActivityMonitor; 