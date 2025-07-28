// test-agent-database.js - 测试数据库Agent个性获取函数
// 注意：此文件已更新为导入 TypeScript 模块

async function testAgentDatabase() {
  console.log('🧪 开始测试Agent数据库集成...');
  
  try {
    // 动态导入 TypeScript 模块
    const { getAgentPersonalityFromDB } = await import('./lib/agent-database.ts');
    
    // 测试获取Agent 1的信息
    console.log('\n📋 测试获取Agent 1的个性信息...');
    const agent1 = await getAgentPersonalityFromDB(1);
    console.log('✅ Agent 1 个性信息:', JSON.stringify(agent1, null, 2));
    
    // 测试获取不存在的Agent
    console.log('\n📋 测试获取不存在Agent的个性信息...');
    const agent999 = await getAgentPersonalityFromDB(999);
    console.log('✅ Agent 999 个性信息 (后备):', JSON.stringify(agent999, null, 2));
    
    console.log('\n🎉 所有测试通过！');
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  testAgentDatabase();
}

module.exports = { testAgentDatabase };