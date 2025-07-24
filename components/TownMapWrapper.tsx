"use client";

import dynamic from 'next/dynamic';

// 动态导入地图组件，避免SSR相关问题
const TownMap = dynamic(() => import('@/components/TownMap'), {
  ssr: false,
  loading: () => <div className="h-[500px] flex items-center justify-center bg-muted">加载小镇地图中...</div>
});

export default function TownMapWrapper() {
  return <TownMap />;
} 