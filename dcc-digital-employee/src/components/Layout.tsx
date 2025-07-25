'use client';

import { ReactNode } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
  activeMenu: string;
}

export default function Layout({ children, activeMenu }: LayoutProps) {
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      <Header />
      <div className="flex">
        <Sidebar activeMenu={activeMenu} />
        <main className="flex-1 ml-64 transition-all duration-200" style={{ minWidth: '1440px', maxWidth: '100vw' }}>
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}