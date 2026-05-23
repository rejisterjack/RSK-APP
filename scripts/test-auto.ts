import 'dotenv/config';

async function main() {
  // Test the streamChatCompletion function with 'auto' model (default)
  const { streamChatCompletion } = await import('../src/lib/ai/index');
  
  console.log('Testing streamChatCompletion with default "auto" model...');
  const result = await streamChatCompletion([
    { role: 'user', content: 'Say hello in one word.' },
  ], { maxTokens: 10 });

  let content = '';
  for await (const chunk of result.textStream) {
    content += chunk;
  }
  console.log(`Response: "${content.trim()}"`);
  console.log(`Model used: ${(result as any)._modelUsed}`);
  
  if (content.trim()) {
    console.log('✅ streamChatCompletion works with auto model!');
  } else {
    console.log('❌ streamChatCompletion returned empty content');
  }
}

main().catch(console.error);
