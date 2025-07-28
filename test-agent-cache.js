// test-agent-cache.js - 测试Agent缓存系统
import useAgentCacheStore from './lib/agent-cache-store.js';

const testAgentCache = async () => {
  console.log('🧪 开始测试Agent缓存系统...\n');
  
  const { getAgent, clearAll } = useAgentCacheStore.getState();
  
  // 清空缓存
  clearAll();
  
  // 测试1: 首次获取Agent - 应该从API获取
  console.log('📝 测试1: 首次获取Agent 1');
  const start1 = Date.now();
  const agent1_first = await getAgent(1);
  const time1 = Date.now() - start1;
  console.log(`   结果: ${agent1_first.name}, 耗时: ${time1}ms`);
  
  // 测试2: 再次获取同一Agent - 应该从缓存获取
  console.log('\n📝 测试2: 再次获取Agent 1 (缓存)');
  const start2 = Date.now();
  const agent1_cached = await getAgent(1);
  const time2 = Date.now() - start2;
  console.log(`   结果: ${agent1_cached.name}, 耗时: ${time2}ms`);
  console.log(`   缓存效果: ${time2 < time1 ? '✅ 加速' : '❌ 未加速'} (${time1 - time2}ms)`);
  
  // 测试3: 获取不同Agent
  console.log('\n📝 测试3: 获取Agent 2');
  const start3 = Date.now();
  const agent2 = await getAgent(2);
  const time3 = Date.now() - start3;
  console.log(`   结果: ${agent2.name}, 耗时: ${time3}ms`);
  
  // 测试4: 批量预加载
  console.log('\n📝 测试4: 批量预加载Agent 3-5');
  const { preloadAgents } = useAgentCacheStore.getState();
  const preloadStart = Date.now();
  preloadAgents([3, 4, 5]);
  
  // 等待预加载完成
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 测试预加载效果
  const start4 = Date.now();
  const agent3 = await getAgent(3);
  const time4 = Date.now() - start4;
  console.log(`   Agent 3 获取耗时: ${time4}ms (预加载效果: ${time4 < 50 ? '✅' : '❌'})`);
  
  // 测试5: 缓存过期模拟（需要等待缓存过期时间，这里只是演示）
  console.log('\n📝 测试5: 查看当前缓存状态');
  const cache = useAgentCacheStore.getState().cache;
  const cachedIds = Object.keys(cache);
  console.log(`   当前缓存的Agent IDs: [${cachedIds.join(', ')}]`);
  
  console.log('\n✅ Agent缓存系统测试完成');
  console.log('\n📊 性能统计:');
  console.log(`   首次获取: ${time1}ms`);
  console.log(`   缓存获取: ${time2}ms`);
  console.log(`   性能提升: ${((time1 - time2) / time1 * 100).toFixed(1)}%`);
};

// 如果是浏览器环境，导出测试函数到全局
if (typeof window !== 'undefined') {
  window.testAgentCache = testAgentCache;
  console.log('🔧 Agent缓存测试函数已加载到 window.testAgentCache()');
} else {
  // Node.js环境下直接运行
  testAgentCache().catch(console.error);
}

export { testAgentCache };