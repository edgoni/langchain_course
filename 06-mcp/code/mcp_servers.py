import asyncio
import os

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()



async def main():

    google_key = os.getenv("GOOGLE_API_KEY") or os.getenv("AI_API_KEY")
    model_name = (
            os.getenv("GEMINI_MODEL")
            or os.getenv("AI_MODEL")
            or "gemini-3.8-flash"
        )
    model = ChatGoogleGenerativeAI(
            model=model_name,
            api_key=google_key,
        )

    mcp_connection = {
                "context7": {
                    "transport": "streamable_http",
                    "url": "https://mcp.context7.com/mcp",
                }
            }

    mcp_client = MultiServerMCPClient(mcp_connection)

    tools = await mcp_client.get_tools()
    for t in tools:
        print(f'tool_name:{t.name}\n')
        print(f'tool_description:{t.description}\n')

    server_agent = create_agent(
        model=model,
        tools=tools,
    )

    query = "How do I use Express.js middleware?"
    result = await server_agent.ainvoke({"messages": [("human", query)]})
    last_message = result["messages"][-1]
    print(f"🤖 Agent: {last_message.content[0]['text']}\n")

if __name__ == "__main__":
    asyncio.run(main())