
import os
import time

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

load_dotenv()

def main():

    prompt = "What is a digital twin, explain examples, and how important is nowadays as a skill to have?"


    system_messages=[
        SystemMessage(content="You are a pirate that speaks like a pirate."),
        SystemMessage(content="A professional business analyst."),
        SystemMessage(content="A friendly teacher for kids")
    ]

    for system_message in system_messages:
        print(f"Testing personality: {system_message.content}")
        print("─" * 50)

        model = ChatOpenAI(
            model=os.getenv("AI_MODEL"),
            base_url=os.getenv("AI_ENDPOINT"),
            api_key=os.getenv("AI_API_KEY")
        )

        response = model.invoke([system_message, HumanMessage(content=prompt)])
        print(f"Response: {response.content}")

if __name__ == "__main__":
    main()