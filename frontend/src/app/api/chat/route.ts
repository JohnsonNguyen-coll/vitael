import Anthropic from "@anthropic-ai/sdk";
import { getMCPTools, callMCPTool } from "@/lib/mcp";

export const maxDuration = 60;

const client = new Anthropic();

export async function POST(req: Request) {
  const { messages, userAddress } = await req.json();

  const mcpToolsList = await getMCPTools();

  const tools: Anthropic.Tool[] = mcpToolsList.map((mcpTool: any) => ({
    name: mcpTool.name,
    description: mcpTool.description,
    input_schema: {
      type: "object" as const,
      properties: mcpTool.inputSchema?.properties ?? {},
      required: mcpTool.inputSchema?.required ?? [],
    },
  }));

  // Run agentic loop (handle tool calls)
  let currentMessages: Anthropic.MessageParam[] = messages.map((m: any) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let finalText = "";
  const allToolInvocations: Array<{
    toolCallId: string;
    toolName: string;
    state: string;
    args: any;
    result?: any;
  }> = [];

  for (let step = 0; step < 5; step++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system:
        "You are Vitael, an expert DeFi AI agent. You assist users with reading state (APR, markets, portfolio) and proposing transactions (deposit, bridge, swap). For write actions, you will call the corresponding tool which will return raw transaction data. The user will be prompted to sign the transaction automatically by the UI. Never ask the user to manually send transactions. When the user's request contains the required action and parameters, call the relevant tool immediately. Do not ask for a conversational confirmation such as 'yes', 'confirm', or 'proceed' before preparing a transaction. The wallet signature shown by the UI is the only required user approval. Ask a follow-up only when a required parameter is genuinely missing or ambiguous. Never claim that a transaction has executed until the wallet/UI reports success." +
        "\n\nWhen the user asks about LP ownership or removing liquidity, call getLiquidityPosition first. A non-zero lpBalanceRaw is an active LP position. Report displayBalance, pool share, and redeemable underlying amounts; use lpBalanceRaw for removal transactions." +
        "\n\nThe default chain is 'arcTestnet' unless the user specifies otherwise. Always use 'arcTestnet' for the `chain` parameter in tools." +
        (userAddress ? `\n\nThe user's connected wallet address is: ${userAddress}. Use this address by default for any queries or transactions that require a user address (like getPosition, getHealthFactor, deposit, withdraw, borrow, repay, etc).` : "\n\nThe user has not connected their wallet yet."),
      messages: currentMessages,
      tools,
    });

    // Collect text from this step
    for (const block of response.content) {
      if (block.type === "text") {
        finalText += block.text;
      }
    }

    // If no tool calls, we're done
    if (response.stop_reason !== "tool_use") break;

    // Process tool calls
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      try {
        const result = await callMCPTool(toolUse.name, toolUse.input as Record<string, any>);
        const text =
          result.content.find((c: any) => c.type === "text")?.text || "{}";
          
        let parsedResult = null;
        try { parsedResult = JSON.parse(text); } catch(e) { parsedResult = text; }

        allToolInvocations.push({
          toolCallId: toolUse.id,
          toolName: toolUse.name,
          state: "result",
          args: toolUse.input,
          result: parsedResult,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: text,
        });
      } catch (err) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify({ error: (err as Error).message }),
          is_error: true,
        });
      }
    }

    // Append assistant response + tool results to history
    currentMessages = [
      ...currentMessages,
      { role: "assistant", content: response.content },
      { role: "user", content: toolResults },
    ];
  }

  return new Response(JSON.stringify({
    text: finalText,
    toolInvocations: allToolInvocations
  }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
