import 'dotenv/config';

async function main() {
  // Import the actual resolveModel from index.ts
  const ai = await import('../src/lib/ai/index');
  const { streamText } = await import('ai');
  
  // Test resolving Groq model via the index.ts resolveModel
  console.log('Testing resolveModel from index.ts...');
  const groqModel = ai.resolveModel('groq/llama-3.3-70b-versatile');
  console.log('groqModel:', groqModel ? 'OK' : 'NULL');
  
  if (groqModel) {
    console.log('\nTesting streamText with groqModel...');
    try {
      const result = streamText({
        model: groqModel as any,
        messages: [{ role: 'user', content: 'Say hi' }] as any,
        temperature: 0.7,
        maxTokens: 5,
      });
      console.log('streamText returned:', typeof result);
      
      let content = '';
      for await (const chunk of result.textStream) {
        content += chunk;
      }
      console.log('Content:', JSON.stringify(content));
    } catch (err) {
      console.log('streamText THREW:', err);
    }
  }
  
  // Now test with OpenRouter model
  console.log('\nTesting resolveModel for google/gemma-3-12b-it:free...');
  const orModel = ai.resolveModel('google/gemma-3-12b-it:free');
  console.log('orModel:', orModel ? 'OK' : 'NULL');
}

main().catch(console.error);
