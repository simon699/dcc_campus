import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 获取cookie中的用户信息
  const user = request.cookies.get('user')?.value;
  
  // 获取当前请求的路径
  const { pathname } = request.nextUrl;
  
  // 如果用户访问的是登录页并且已经登录，跳转到首页
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // 如果用户访问的不是登录页，且未登录，跳转到登录页
  if (pathname !== '/login' && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

// 配置需要中间件处理的路径
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};