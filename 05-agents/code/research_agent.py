import os
from typing import Any, Callable

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, ModelRequest
from langchain.agents.middleware.types import ModelResponse
from langchain_core.messages import HumanMessage, ToolMessage
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage


# Load environment variables
load_dotenv()


@tool
def search_tool(query: str) -> str:
    '''
    Looks up the answer to the question in a list of known questions and answers.
    Args:
        query: The question to search for.
    Returns:
        The answer to the question.
    '''
    
    question_answers=[
        {'question':'What is the capital of France?', 'answer': 'Paris'},
        {'question':'Who is going to win thge elections on 10/11/2026 in Spain?', 'answer': 'The Popular Party'},
        {'question':'What is the population of Spain?', 'answer': '47 million'},
    ]

    for i in range(len(question_answers)):
        if question_answers[i]['question'] == query:
            return question_answers[i]['answer']
    return "I don't know the answer to that question"

@tool
def calculator_tool(expression: str) -> str:
    '''
    Calculate the result of the expression.
    Args:
        expression: The expression to calculate.
    Returns:
        The result of the expression.
    '''
    try:
        result = eval(expression, {"__builtins__": {}}, {})
        return f"The result is: {result}"
    except Exception as e:
        return f"Error: {e}"

class LogToolMiddleware(AgentMiddleware):
    def wrap_tool_call(self, request, handler):
        print("Usando:", request.tool_call.get("name"))
        return handler(request)

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

agent = create_agent(
        model,
        tools=[calculator_tool, search_tool],
        middleware=[LogToolMiddleware()],
            )

response = agent.invoke({
    "messages": [HumanMessage(content="What is the population of Spain * 3?")]
})
print(f'Tools used: {response["tool_calls"]}')
print(response["messages"])
#print(response["messages"][-1].content)
