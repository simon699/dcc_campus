// 用户活动监听器
import { checkTokenValidity } from '../services/api';
import { handleTokenExpired } from './tokenUtils';

class ActivityMonitor {
  private timeoutId: NodeJS.Timeout | null = null;
  private lastActivityTime: number = Date.now();
  private isMonitoring: boolean = false;
  private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30分钟无操作
  private readonly CHECK_INTERVAL = 10 * 60 * 1000; // 每10分钟检查一次，减少频率
  private lastTokenCheck: number = 0;
  private readonly TOKEN_CHECK_COOLDOWN = 5 * 60 * 1000; // 5分钟内不重复检查token

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // 监听用户活动事件
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, () => this.handleUserActivity(), { passive: true });
    });

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
  }

  private handleUserActivity() {
    this.lastActivityTime = Date.now();
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
    // 检查是否在冷却期内
    const now = Date.now();
    if (now - this.lastTokenCheck < this.TOKEN_CHECK_COOLDOWN) {
      console.log('活动监听器：Token检查在冷却期内，跳过');
      this.scheduleNextCheck();
      return;
    }

    try {
      console.log('活动监听器：检查token有效性...');
      this.lastTokenCheck = now;
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