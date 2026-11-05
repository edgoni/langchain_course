import os

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
'''
**Tasks**:
1. Create `chatbot.py` in the `02-chat-models/code/` folder
2. Implement an interactive chatbot that:
   - Accepts user input in a loop
   - Maintains conversation history
   - Allows users to type "quit" to exit
   - Shows the conversation history length after each exchange
3. Use a SystemMessage to give the bot a personality (you choose!)
'''

load_dotenv()

def chatbot():
        
    system_message = "You have to explain everithing like a teacher to a 10 years old kid"

    messages=[SystemMessage(content=system_message)]
    model = ChatOpenAI(model=os.getenv("AI_MODEL"), base_url=os.getenv("AI_ENDPOINT"), api_key=os.getenv("AI_API_KEY"))
    for i in range(10):
        
        prompt = input("You: /n")
        if prompt == "quit":
            break
        messages.append(HumanMessage(content=prompt))
        for chunk in model.stream(messages):
            print(chunk.content, end="", flush=True) 
            messages.append(AIMessage(content=chunk.content))
        if i == 9:
            print(f"You have reached your limit for this session, goodbye!")
            break

if __name__ == "__main__":
    chatbot()



