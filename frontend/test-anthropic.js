const { createAnthropic } = require("@ai-sdk/anthropic");
const { streamText, tool } = require("ai");
const { z } = require("zod");

const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  console.log("ANTHROPIC PAYLOAD:", options.body);
  process.exit(0);
};

const anthropic = createAnthropic({ apiKey: "fake" });

const aiTools = {
  getMarkets: tool({
    description: "Get active markets for a given chain",
    inputSchema: z.object({
      chain: z.string()
    }),
    parameters: z.object({
      chain: z.string()
    }),
    execute: async (args) => { return args; }
  })
};

async function test() {
  await streamText({
    model: anthropic("claude-3-5-sonnet-20241022"),
    messages: [{ role: "user", content: "hello" }],
    tools: aiTools,
  });
}

test().catch(console.error);
