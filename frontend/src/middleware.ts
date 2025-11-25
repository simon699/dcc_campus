import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 获取cookie中的用户信息和token
  const user = request.cookies.get('user')?.value;
  const accessToken = request.cookies.get('access_token')?.value;
  
  // 获取当前请求的路径
  const { pathname } = request.nextUrl;
  
  // 跳过静态资源和API路由的中间件处理
  if (pathname.startsWith('/_next/') || pathname.startsWith('/api/') || pathname.includes('.')) {
    return NextResponse.next();
  }
  
  // 如果用户访问的是登录页并且已经登录，跳转到首页
  if (pathname === '/login' && user && accessToken) {
    console.log('中间件：用户已登录，从登录页跳转到首页');
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // 如果用户访问的不是登录页，且未登录，跳转到登录页
  if (pathname !== '/login' && (!user || !accessToken)) {
    console.log('中间件：用户未登录，跳转到登录页面');
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // 如果用户已登录但token可能已失效，让前端处理token验证
  if (pathname !== '/login' && user && accessToken) {
    console.log('中间件：用户已登录，允许访问');
  }
  
  return NextResponse.next();
}

// 配置需要中间件处理的路径
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};