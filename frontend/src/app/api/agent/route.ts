import Anthropic from "@anthropic-ai/sdk";
import { getMCPTools, callMCPTool } from "@/lib/mcp";

export const maxDuration = 60;

const client = new Anthropic();
const STRATEGY_INTENT = /\b(strategy|strategies|optimi[sz]e|yield plan|portfolio plan|loop|leverage)\b|chi[eế]n lược|tối ưu|lợi nhuận|đòn bẩy/i;
const STRATEGY_CONTINUATION = /previous strategy step has completed|continue (the )?(active )?strategy|tiếp tục.*chiến lược/i;

async function runAgent(req: Request) {
  const { messages, userAddress } = await req.json();
  const latestUserMessage = [...messages].reverse().find((m: any) => m.role === "user")?.content ?? "";
  const strategyExecution = STRATEGY_INTENT.test(latestUserMessage) || STRATEGY_CONTINUATION.test(latestUserMessage);

  let mcpUnavailable = false;
  const mcpToolsList = await getMCPTools().catch((error: unknown) => {
    mcpUnavailable = true;
    console.error("[agent] MCP tools unavailable", {
      message: error instanceof Error ? error.message : "Unknown MCP error",
    });
    return [];
  });

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
        "\n\nSTRATEGY EXECUTION: When the user asks for a strategy, optimisation, yield plan, loop, or portfolio plan, first use read/quote tools needed to assess the current position. State a concise ordered plan with objective, risk assumptions, and the next action. Then prepare only the next dependent write transaction. Do not generate several dependent write transactions at once: the UI automatically returns after each confirmed transaction so you can re-read state and prepare the following step. Never ask for chat confirmation between steps. If the strategy is complete, state that it is complete and do not call a write tool." +
        "\n\nIMPORTANT FORMATTING RULES:" +
        "\n- Make your messages visually appealing, incredibly concise, and highly professional." +
        "\n- Use Markdown tables ALWAYS when displaying lists of data, assets, or balances. Never just list them as plain text." +
        "\n- DO NOT use any emojis or icons." +
        "\n- Keep text to an absolute minimum while still conveying the necessary information." +
        "\n- If a tool call fails, silently fix the parameters and retry. Do NOT output raw JSON errors, stack traces, or technical error messages to the user." +
        "\n\nIMPORTANT FOR AMOUNTS: You MUST use the token's smallest unit (wei) for all tool arguments! (e.g. 1 USDC = 1000000, 1 EURC = 1000000, 1 cirBTC = 100000000). For example, if the user asks to swap 1 USDC, you must pass \"1000000\" as amountIn, NOT \"1\". If you are quoting the amount out, remember to convert the returned wei back to human readable format in your response (e.g. if expectedOut is 990000, tell the user 0.99 EURC)." +
        "\n\nThe default chain is 'arcTestnet' unless the user specifies otherwise. Always use 'arcTestnet' for the `chain` parameter in tools." +
        (mcpUnavailable
          ? "\n\nLIVE TOOLS ARE TEMPORARILY UNAVAILABLE. You may answer general educational questions, but clearly state that live portfolio data and transaction preparation are currently unavailable. Never invent balances, rates, quotes, or transaction data."
          : "") +
        (userAddress ? `\n\nThe user's connected wallet address is: ${userAddress}. Use this address by default for any queries or transactions that require a user address.` : "\n\nThe user has not connected their wallet yet."),
      messages: currentMessages,
      tools,
    });

    // Collect text from this step
    for (const block of response.content) {
      if (block.type === "text") {
        finalText += (finalText ? "\n\n" : "") + block.text;
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
    toolInvocations: allToolInvocations,
    strategyExecution,
    degraded: mcpUnavailable,
  }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: "AI model is not configured.", code: "ANTHROPIC_NOT_CONFIGURED" },
        { status: 503 },
      );
    }
    return await runAgent(req);
  } catch (error: unknown) {
    const details = error as { status?: number; name?: string; message?: string };
    console.error("[agent] request failed", {
      name: details.name,
      status: details.status,
      message: details.message,
    });

    if (details.status === 401 || details.status === 403) {
      return Response.json(
        { error: "AI model authentication failed. The server API key must be rotated or corrected.", code: "ANTHROPIC_AUTH_FAILED" },
        { status: 503 },
      );
    }
    if (details.status === 429) {
      return Response.json(
        { error: "The AI service is rate limited. Please try again shortly.", code: "ANTHROPIC_RATE_LIMITED" },
        { status: 503 },
      );
    }
    return Response.json(
      { error: "The Vitael agent is temporarily unavailable.", code: "AGENT_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
