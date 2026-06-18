const { anthropic } = require("@ai-sdk/anthropic");
const { streamText, tool, jsonSchema } = require("ai");

const mcpTool = {
  name: "getMarkets",
  description: "Get active markets for a given chain",
  inputSchema: {
    type: "object",
    properties: {
      chain: {
        type: "string"
      }
    },
    required: ["chain"]
  }
};

const aiTools = {
  [mcpTool.name]: tool({
    description: mcpTool.description,
    parameters: jsonSchema({
      type: "object",
      properties: mcpTool.inputSchema.properties || {},
      required: mcpTool.inputSchema.required || []
    }),
    execute: async (args) => { return args; }
  })
};

console.log("JSON SCHEMA OUTPUT:", JSON.stringify(aiTools["getMarkets"].parameters));
