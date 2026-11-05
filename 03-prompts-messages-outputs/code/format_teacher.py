import os
from typing import Literal

from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate, FewShotChatMessagePromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

# Load environment variables
load_dotenv()

class Product(BaseModel):
    """Information about a product."""
    name: str = Field(description="Name of the product"),
    price: float = Field(description="Price of the product"),
    category: str = Field(description="Category of the product"),
    highlight: str= Field(description="Key feature of the product")

def extract_information_from_description(description: str):
    model = ChatOpenAI(model=os.getenv("AI_MODEL"),
        api_key=os.getenv("AI_API_KEY"),
        base_url=os.getenv("AI_ENDPOINT"))
    
    structured_model = model.with_structured_output(Product)
    result = structured_model.invoke(f"Extract info from: {description}")
    print(result.name)
    print(result.price)
    print(result.category)
    print(result.highlight)
    print(result)


def retrieve_json_few_shot():
    model = ChatOpenAI(model=os.getenv("AI_MODEL"),
        api_key=os.getenv("AI_API_KEY"),
        base_url=os.getenv("AI_ENDPOINT"))
    examples = [{
        'input': "0213784 F has a price of 69 Euros is a Tapered Roller Bearing and has a thermal treatment",
        'output': """{
            'name': '0213784 F',
            'price': 69,
            'category': 'Tapered Roller Bearing',
            'highlight': 'thermal treatment'
        }"""
        },
    {"input": "34783 S is a Spherical Roller Bearing and has a thermal treatment",
        'output': """{
            'name': '34783 S',
            'price': 100,
            'category': 'Spherical Roller Bearing',
            'highlight': 'thermal treatment'
        }"""
    }]

    example_template = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful assistant that extracts information from product descriptions."),
        ("human", "{input}"),
        ("ai", "{output}")
    ])
    
    few_shot = FewShotChatMessagePromptTemplate(
        examples=examples,
        example_prompt=example_template
    )
    final = ChatPromptTemplate.from_messages([
    ("system", "You are product information extractor."),
    few_shot,
    ("human", "{input}"),
    ])
    chain = final|model

    return chain

def main():
    few_shot_chain = retrieve_json_few_shot()
    result = few_shot_chain.invoke({"input": "23423g has a price of 0.2 Euros is a Stupid Roller Bearing and has a thermal treatment"})
    print(result.content)
    
if __name__ == "__main__":
    main()