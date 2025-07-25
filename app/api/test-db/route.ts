// app/api/test-db/route.ts - 测试数据库连接

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { thoughts } from '@/db/schema/thoughts';

// GET /api/test-db - 测试数据库连接
export async function GET() {
  try {
    // 简单的数据库查询测试
    const result = await db.select().from(thoughts).limit(1);
    
    return NextResponse.json({
      success: true,
      message: '数据库连接正常',
      data: {
        thoughtsCount: result.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('数据库连接测试失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '数据库连接失败',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}