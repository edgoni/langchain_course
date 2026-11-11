# Model Context Protocol (MCP)
> [!master]- Mi Aportación
> El MCP es un estándar de código abierto para unificar la forma en que los asistentes de inteligencia artificial acceden a datos externos y sistemas de software. MCP resuelve el problema de la fragmentación en la integración de herramientas.

In this chapter, you'll learn how to connect AI agents to external services using the **Model Context Protocol (MCP)**—an open standard that provides a universal interface for AI applications to access tools and data sources. You'll discover how MCP simplifies integration with services like GitHub, databases, and documentation systems, and how to use MCP tools seamlessly with the agents you built in [Getting Started with Agents](../05-agents/README.md).

## Prerequisites

- Completed [Getting Started with Agents](../05-agents/README.md)

## 🎯 Learning Objectives

By the end of this chapter, you'll be able to:

- ✅ Understand what Model Context Protocol (MCP) is and why it matters
- ✅ Connect to external MCP servers using **Streamable HTTP transport**
- ✅ Use **stdio transport** for subprocess communication
- ✅ Integrate MCP tools with LangChain agents (same `create_agent()` pattern!)
- ✅ Work with **multiple MCP servers simultaneously** in one agent
- ✅ Implement **robust error handling** (retries, timeouts, fallbacks)
- ✅ Choose the right transport type for your use case
- ✅ Build and deploy **custom MCP servers** to expose your own tools
- ✅ Troubleshoot common MCP connection and integration issues
---
## 📌 About the Code Examples
The code snippets shown in this README are simplified for clarity and focus on core concepts. The actual code files in the `code/`, `solution/`, and `samples/` folders include:
- ✨ **Enhanced console output** with detailed logging and formatting
- 🛡️ **Production-ready error handling** with comprehensive try-except blocks
- 🔧 **Environment variable support** for flexible configuration
- 💡 **Extended educational comments** explaining MCP concepts
When you run the actual files, you'll see more detailed output than shown in the examples below.
---
## 📖 The USB-C for AI Analogy
**Imagine building a laptop that needs to connect to various peripherals:**
### Before USB-C (Custom Integrations)
- 🔌 Different port for each device (HDMI, DisplayPort, USB-A, Ethernet, power)
- 🔧 Custom drivers and protocols for each
- 📦 Bulky laptop with many specialized ports
- ⏱️ A lot of work to add support for new devices
### With USB-C (MCP Standard)
- ⚡ One universal port for everything
- 🔄 Standardized protocol all devices understand
- ✨ Slim laptop with fewer ports
- ⏰ Quicker to add support for new devices

<img src="images/usb-c-analogy.png" alt="MCP is like USB-C for AI" width="800"/>

*MCP provides a standardized way for AI agents to connect to tools - like USB-C for AI applications.*

---
## 🌐 Model Context Protocol (MCP)

**You've built agents with manually created tools, but what about connecting to external services?**

In [Getting Started with Agents](../05-agents/README.md), you created tools (calculator, weather, search) by writing the implementation code yourself. This works great for custom tools specific to your application.

**But what about connecting to existing services or cases where tools need to be used across different AI applications?** Imagine needing tools for:
- GitHub (create issues, search code, manage PRs)
- Calendar (check availability, create events)
- Your company database (query data, get schemas)
- Documentation systems (fetch docs, resolve references)

Writing custom integrations for each service means dealing with different APIs, authentication methods, and data formats. This is where **Model Context Protocol (MCP)** comes in.
### What is MCP?
**Model Context Protocol (MCP)** is an open standard that lets AI applications connect to external tools and data sources through a universal interface. It's like USB-C for AI applications.

**The Problem**: Building an AI assistant that needs to access Calendar details, databases, GitHub, and more means writing custom integrations for each service with different APIs, auth methods, and data formats.

**The MCP Solution**: Services expose their capabilities through a standard protocol. Your agent connects once and gets access to everything.
### Architecture

<img src="images/mcp-architecture.png" alt="Model Context Protocol Architecture" width="800"/>

*MCP provides a standardized way for AI agents to connect to external services - like USB-C for AI applications.*

Each **MCP Server** is a program that exposes tools through the protocol. Your agent connects and can use all available tools.
### Transport Types
> [!master]- Mi Aportación
> Cuando tu agente LangChain entra en el ciclo ReAct y decide ejecutar una herramienta (Action), necesita enviar los parámetros de esa acción al servidor MCP y esperar la respuesta empírica (Observation). Esto se logra mediante uno de estos dos canales de comunicación:
> 1. stdio (Process-based / Subprocesos locales)** Imagina que tu agente de LangChain arranca un programa secundario en su misma computadora.
> - **Cómo funciona (`stdin` y `stdout`):** Todos los programas informáticos tienen canales de texto básicos. `stdin` (Standard Input) es por donde el programa "escucha" o recibe datos, y `stdout` (Standard Output) es por donde "habla" o escupe resultados. Con este transporte, el agente y el servidor MCP se conectan directamente por estas tuberías en la memoria del sistema operativo, sin usar internet.
> - **Cuándo usarlo:** Es ideal para desarrollo local, pruebas rápidas, o cuando la herramienta es un script de Python ligero que debe ejecutarse en la misma máquina que el agente.
> - **Limitación empresarial:** Está fuertemente acoplado. Si tienes 50 agentes distribuidos en distintos servidores, no pueden conectarse a este servidor MCP porque solo existe dentro del proceso del agente original
> 1. Streamable HTTP (Network-based / Red)** Este es el modelo cliente-servidor clásico que sostiene internet, optimizado para flujos de datos continuos.
> -**Cómo funciona:** El agente se comunica con el servidor MCP a través de una URL en una red local (Intranet) o pública (Internet). Mantiene la conexión abierta para transmitir información de manera bidireccional, lo cual es vital para enviar los "pensamientos" generados por un LLM token a token.
> - **Por qué es clave para empresas:** Es la base para sistemas distribuidos reales y escalables. Puedes tener un único Servidor MCP robusto alojado en la nube que exponga tu base de datos corporativa de forma segura. A partir de ahí, múltiples agentes especializados (un chatbot de ventas, un agente supervisor de soporte) pueden consultar esa misma URL de forma simultánea.
> - **El rol de LangChain:** Al usar la configuración `transport: "streamable_http"`, LangChain se encarga automáticamente de formatear las peticiones HTTP y gestionar las caídas de red bajo el capó. Si hay un error de conexión, el `AgentExecutor` lo captura y se lo entrega al modelo como un texto descriptivo para que intente recuperarse sin que la aplicación colapse.

MCP defines two standard transport mechanisms for client-server communication:

| Transport           | Communication Method                         | When to Use                                            | Example                                                                    |
| ------------------- | -------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| **Streamable HTTP** | Network-based (client → server over network) | When MCP server is accessed via URL (local or remote)  | `{"transport": "streamable_http", "url": "https://api.mycompany.com/mcp"}` |
| **stdio**           | Process-based (parent ↔ child via streams)   | When MCP server runs as subprocess of your application | `{"transport": "stdio", "command": "python", "args": ["server.py"]}`       |

> **📝 Note on Transport Evolution**: The current MCP specification uses **Streamable HTTP** as the standard network transport. In LangChain Python code, you use `transport: "streamable_http"` - the library handles the protocol automatically.

**Understanding stdin and stdout**:
- **stdin** (standard input): Where a program reads input - like text from keyboard or piped data
- **stdout** (standard output): Where a program writes output - like text to console or screen
- With stdio transport, the client and server talk to each other through these streams, like two programs connected by a pipe

<img src="images/http-stdio-comparison.png" alt="Streamable HTTP vs stdio Transport Comparison" width="800"/>

*Streamable HTTP transport uses network-based communication, while stdio uses process-based communication.*

> **💡 Architecture Choice**: Streamable HTTP is for *network-accessible* servers (think: web service). stdio is for *process-integrated* tools (think: subprocess).
### Why MCP Matters

| Without MCP | With MCP |
|-------------|----------|
| Custom integration per service | One standard protocol |
| Separate auth for each | Unified approach |
| Time intensive to add services | Quicker to add services |

**The key insight**: In [Getting Started with Agents](../05-agents/README.md), you built the tool *implementations*. With MCP, you connect to tool *providers* that expose their capabilities through a standard protocol. Same `create_agent()` pattern, different tool source!
### Using MCP in LangChain

LangChain provides the `langchain-mcp-adapters` package for MCP integration:

```bash
pip install langchain-mcp-adapters
```

Now let's see how to connect to an MCP server and use its tools with `create_agent()`.

> [!master]- Cuando usar cada cosa
> El protocolo de Context7 (Streamable HTTP) y el protocolo de subprocesos locales (stdio) son dos formas distintas de conectar tu agente LangChain con herramientas (Tools) externas mediante el estándar MCP. Ambos mecanismos exponen el mismo catálogo de herramientas y permiten la misma interacción ReAct (Pensamiento, Acción, Observación), pero difieren en su arquitectura técnica y en su idoneidad para entornos empresariales.
> Utilizarás uno u otro basándote principalmente en los requisitos de arquitectura de tu sistema empresarial:
> - **Utiliza Streamable HTTP (Ej: Context7) cuando:**
> 	- **Necesitas escalar:** Quieres que múltiples agentes diferentes (por ejemplo, un chatbot de ventas y un supervisor de soporte) se conecten simultáneamente a un único servidor centralizado en la nube o en la intranet corporativa.
> 	- **Buscas desacoplamiento:** Quieres que el servidor MCP exista independientemente de los clientes; si tu agente se detiene o se reinicia, el servidor debe seguir activo para otros usuarios.
> 	-  **La comunicación es por red:** El servidor y el agente se encuentran en máquinas o servidores distintos, comunicándose a través de peticiones HTTP web.
> 	-  **Manejas sistemas heredados compartidos:** Vas a conectar bases de datos corporativas, CRMs o sistemas backend que son críticos para la empresa y deben mantenerse en una arquitectura centralizada.
> - **Utiliza `stdio` (Subprocesos Locales) cuando:**
> 	- **Requieres herramientas íntimamente ligadas al entorno:** La herramienta o script necesita operar en la misma máquina física o contenedor virtual que el agente.
> 	- **La comunicación debe ser interna:** No requieres conexión de red (ni internet ni intranet); el agente y el servidor se comunican mediante los canales internos de memoria del sistema operativo (las tuberías de entrada y salida estándar).
> 	- **El servidor y el agente comparten el mismo ciclo de vida:** Está bien que el servidor MCP se inicie, funcione y se detenga exactamente al mismo tiempo que el agente que lo invoca (fuerte acoplamiento).
> 	- **Desarrollo en contenedores (Docker):** Estás creando un contenedor autónomo donde el agente LangChain y sus herramientas MCP específicas residen en la misma imagen, y puedes escalar simplemente añadiendo más contenedores completos.

---
## 🚀 Building Agents with MCP Tools

### Example 1: Agent with MCP Server Integration (Context7)

This example shows how to use `MultiServerMCPClient` to connect to Context7 (a documentation MCP server) and use its tools with `create_agent()`. It's the same agent pattern you've learned, but tools can be accessed and used in a more standardized way.

**Key code you'll work with:**
```python
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "context7": {
        "transport": "streamable_http",  # Uses Streamable HTTP protocol
        "url": "https://mcp.context7.com/mcp"  # Remote MCP server
    }
})

# Get tools from MCP server - that's it!
tools = await client.get_tools()

# Same create_agent() pattern, different tool source
agent = create_agent(model, tools)  # Tools from MCP server instead of manually created
```

**Code**: [`code/01_mcp_integration.py`](./code/01_mcp_integration.py)  
**Run**: `python 06-mcp/code/01_mcp_integration.py`

**About Context7**: A documentation MCP server that provides current library docs. It offers two tools:
- `resolve-library-id`: Converts library names (e.g., "React") to Context7 IDs
- `get-library-docs`: Retrieves documentation with optional topic filtering

**Example code:**
```python
import asyncio
import os

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_openai import ChatOpenAI

load_dotenv()


async def main():
    # Context7 MCP Server - provides documentation for libraries
    mcp_server_url = os.getenv("MCP_SERVER_URL", "https://mcp.context7.com/mcp")

    # Create MCP client with HTTP transport to Context7
    client = MultiServerMCPClient({
        "context7": {
            "transport": "streamable_http",
            "url": mcp_server_url,
        }
    })

    try:
        # 1. Get all available tools from Context7
        print("🔧 Fetching tools from Context7 MCP server...")
        tools = await client.get_tools()

        print(f"✅ Retrieved {len(tools)} tools from Context7:")
        for tool in tools:
            print(f"   • {tool.name}: {tool.description}")

        # 2. Create model
        model = ChatOpenAI(
            model=os.getenv("AI_MODEL"),
            base_url=os.getenv("AI_ENDPOINT"),
            api_key=os.getenv("AI_API_KEY"),
        )

        # 3. Create agent with MCP tools - same create_agent() pattern!
        agent = create_agent(model, tools)

        # 4. Use the agent to get documentation
        query = "How do I use Python requests library to make HTTP GET requests? Get the latest documentation."
        print(f"👤 User: {query}\n")

        response = await agent.ainvoke({"messages": [("human", query)]})
        last_message = response["messages"][-1]

        print(f"🤖 Agent: {last_message.content}\n")

    finally:
        print("✅ MCP client connection closed")


if __name__ == "__main__":
    asyncio.run(main())
```

> **💡 Simplification Note**: The actual code file uses `os.getenv("MCP_SERVER_URL", "https://mcp.context7.com/mcp")` with environment variable support. The snippet above is simplified to show the core concept. See the full file for production patterns.

> **🤖 Try with [GitHub Copilot](../docs/copilot.md) Chat:** Want to explore this code further? Open this file in your editor and ask Copilot:
> - "How does MultiServerMCPClient differ from manually creating tools?"
> - "Can I connect to multiple MCP servers simultaneously?"

### Expected Output
```
🔌 MCP Integration Demo - Context7 Documentation Server

📡 Connecting to MCP server at: https://mcp.context7.com/mcp

🔧 Fetching tools from Context7 MCP server...
✅ Retrieved 2 tools from Context7:
   • resolve-library-id: Converts library names to Context7-compatible IDs
   • get-library-docs: Retrieves documentation with optional topic filtering

🤖 Creating agent with MCP tools...

👤 User: How do I use Python requests library to make HTTP GET requests? Get the latest documentation.

🤖 Agent: The `requests` library is Python's most popular HTTP client. 
Here's how to make a GET request...

💡 Key Concepts:
   • MCP provides standardized access to external tools
   • Same create_agent() pattern, different tool source!

✅ MCP client connection closed
```
---
### Example 2: MCP with stdio Transport

This example shows how to use **stdio transport** to ==run an MCP ==server as a sub
process. Unlike HTTP (which communicates over network), stdio uses standard input/output streams for communication.

**Key code you'll work with:**
```python
from pathlib import Path

# Run MCP server as a local subprocess
client = MultiServerMCPClient({
    "localCalculator": {
        "transport": "stdio",  # Local subprocess, not HTTP!
        "command": "python",
        "args": [str(Path(__file__).parent / "servers" / "stdio_calculator_server.py")]
    }
})

# Same agent pattern, different transport type
tools = await client.get_tools()
agent = create_agent(model, tools)
```
**Server**: [`code/servers/stdio_calculator_server.py`](./code/servers/stdio_calculator_server.py)  
**Code**: [`code/02_mcp_stdio_local.py`](./code/02_mcp_stdio_local.py)  
**Run**: `python 06-mcp/code/02_mcp_stdio_local.py`

**Transport Comparison**:

| Feature | Streamable HTTP (Example 1) | stdio (Example 2) |
|---------|-----------------|-------------------|
| **Communication** | Network-based (HTTP requests) | Process-based (stdin/stdout streams) |
| **Server Deployment** | Runs independent of client | Runs as subprocess of client |
| **Connection** | Client connects via URL | Client spawns and manages process |
| **Lifecycle** | Server runs independently | Server lifecycle tied to client |
| **Best For** | Network-accessible services (local or remote) | Process-integrated tools (tight coupling) |

**Both transports can**:
- ✅ Authenticate users (Streamable HTTP: tokens/keys, stdio: subprocess credentials)
- ✅ Access network resources (Streamable HTTP: directly, stdio: subprocess can make network calls)
- ✅ Be used in production (choice depends on architecture and needs)

> **💡 The Real Difference**:
> - **Streamable HTTP**: MCP server is a separate web service that clients connect to
> - **stdio**: MCP server is a subprocess accessed directly by the client
>
> Think: Streamable HTTP = calling a web API, stdio = running a program and talking to it.

> **🤖 Try with [GitHub Copilot](../docs/copilot.md) Chat:** Want to explore this code further?
> Open this file in your editor and ask Copilot:
> - "When should I use stdio transport vs HTTP transport?"
> - "How does the calculator server communicate with the agent?"

### Expected Output

```
🔧 Starting local MCP server via stdio...

📟 Connecting to stdio MCP server...
✅ Connected! Retrieved 2 tools from local server:
   • calculate: Perform mathematical calculations using Python's math module
   • convert_temperature: Convert temperature between Celsius and Fahrenheit

🧮 Testing calculator tool...

👤 User: What is 15 * 23 + 100?
🤖 Agent: 15 * 23 + 100 = 445

🌡️  Testing temperature conversion...

👤 User: Convert 100 degrees Fahrenheit to Celsius
🤖 Agent: 100°F = 37.78°C

💡 Key Concepts:
   • stdio transport runs MCP server as a subprocess
   • Communicates via standard input/output streams

✅ MCP client connection closed
```
> [!master]- Diferencia entre los dos ejemplos
> Que diferencia hay entre stdio y Context7? Entre los ejemplos 1 y 2?
> La diferencia fundamental entre "Context7" (HTTP) y el ejemplo local (stdio) no radica en las herramientas que ofrecen, sino en **dónde se ejecuta el servidor y cómo se comunica el agente con él**.
>- **Context7 (Streamable HTTP): El modelo "Web API"**:
>	- **Ejecución independiente:** El servidor MCP existe por su cuenta en una máquina remota (en internet o en la intranet de una empresa).
>	- **Comunicación por red:** Tu agente se conecta a él mediante una dirección web (URL), enviando peticiones a través de la red.
>	- **Ciclo de vida desacoplado:** Si detienes la ejecución de tu agente de LangChain, el servidor de Context7 sigue activo y disponible para que otros agentes o usuarios se conecten.
>- **Calculadora Local (stdio): El modelo "Subproceso"**
>	- **Ejecución integrada:** Tu agente es quien "arranca" el servidor MCP directamente en tu propia computadora mediante un comando de terminal (en el ejemplo, ejecutando el archivo `stdio_calculator_server.py` con Python).
>	- **Comunicación interna:** No utiliza internet ni red local. El agente y el servidor "hablan" a través de los canales internos de memoria de tu sistema operativo (las entradas y salidas estándar o _stdin/stdout_).
>	- **Ciclo de vida acoplado:** El servidor nace y muere exactamente al mismo tiempo que tu agente. Está encapsulado dentro de tu aplicación.

En una arquitectura a nivel industrial, usarías `streamable_http` para conectar tus agentes a los sistemas centrales compartidos de la empresa (CRMs, bases de datos, sistemas de tickets), y reservarías `stdio` únicamente si el agente necesita ejecutar un script muy específico que reside físicamente en la misma máquina donde el agente está operando.

---
### Example 3: Multi-Server Agent Integration
This example demonstrates the real power of MCP: connecting to **multiple MCP servers simultaneously**. The agent gets tools from all servers and intelligently chooses which to use based on the query!

**Key code you'll work with:**
```python
# Connect to multiple servers at once!
client = MultiServerMCPClient({
    "context7": {
        "transport": "streamable_http",
        "url": "https://mcp.context7.com/mcp"  # Remote docs server
    },
    "calculator": {
        "transport": "stdio",
        "command": "python",
        "args": [str(server_path)]  # Local math server
    }
})

# Agent gets tools from BOTH servers
tools = await client.get_tools()  # Combines tools from all servers
agent = create_agent(model, tools)

# Agent chooses the right tool for each task automatically!
```

<img src="images/multi-server-pattern.png" alt="Multi-Server MCP Pattern" width="800"/>

*One AI Agent connecting to multiple MCP servers simultaneously - Context7 for documentation, Calculator for math, GitHub for code, and Filesystem for file operations.*

**Code**: [`code/03_mcp_multi_server.py`](./code/03_mcp_multi_server.py)  
**Run**: `python 06-mcp/code/03_mcp_multi_server.py`

**What makes this powerful:**
- ✅ Mix different transport types (Streamable HTTP + stdio)
- ✅ Combine tools from different services
- ✅ Agent automatically routes queries to appropriate tools
- ✅ Scale to dozens of servers without changing agent code
- ✅ Real-world example: GitHub + Calendar + Database + Documentation in one agent

**Real-World Use Cases:**
- Documentation (Context7) + Math (Calculator) + Weather (API)
- GitHub (code) + Calendar (scheduling) + Database (data queries)
- Internal company tools + External services in unified interface

> **🤖 Try with [GitHub Copilot](../docs/copilot.md) Chat:** Want to explore this code further?
> Open this file in your editor and ask Copilot:
> - "How does the agent decide which server's tool to use?"
> - "What happens if two servers have tools with the same name?"

### Expected Output

```
🌐 Connecting to multiple MCP servers...

🔧 Fetching tools from all servers...
✅ Retrieved 4 total tools from 2 servers:

📚 From Context7 (Documentation):
   • resolve-library-id: Convert library names to Context7 IDs
   • get-library-docs: Retrieve library documentation

🧮 From Local Calculator:
   • calculate: Perform mathematical calculations
   • convert_temperature: Convert temperature between units

Test 1: Math question (should use calculator)

👤 User: What is 25 * 4 + 100?
🤖 Agent: 25 * 4 + 100 = 200

Test 2: Documentation question (should use Context7)

👤 User: How do I use FastAPI to create a REST API? Get documentation.
🤖 Agent: FastAPI is a modern, fast web framework for building APIs with Python...

💡 Key Concepts:
   • Agent receives tools from ALL connected servers
   • Agent automatically chooses the right tool for each task

✅ All MCP connections closed
```

---
> [!master]- asyncio
> `asyncio` es una biblioteca estándar de Python que permite escribir código concurrente utilizando la sintaxis `async` y `await`. Su propósito principal es gestionar operaciones de entrada/salida (I/O) que tardan tiempo en resolverse, como leer bases de datos, hacer peticiones web o comunicarse con APIs externas, sin bloquear el resto del programa.
> El funcionamiento de `asyncio` se basa en los siguientes componentes clave:
> - **El Bucle de Eventos (Event Loop):** Es el motor central que ejecuta las rutinas asíncronas. Funciona como un director de orquesta que supervisa todas las tareas pendientes y decide cuál debe ejecutarse en cada momento.
> - **Operaciones no bloqueantes (Non-blocking):** En la programación tradicional (síncrona), si tu código hace una petición HTTP, todo el programa se congela hasta que llega la respuesta. Con `asyncio`, el programa le dice al sistema: "Voy a esperar esta respuesta de red; mientras tanto, puedes usar el procesador para hacer otras cosas".
> - **Corutinas (`async def`):** Son funciones especiales declaradas con `async`. Cuando llamas a una corutina, no se ejecuta inmediatamente, sino que devuelve un objeto que debe ser programado en el bucle de eventos.
> - **Puntos de pausa (`await`):** Se utiliza dentro de las corutinas para indicar el punto exacto donde la función necesita esperar un resultado externo. Al llegar a un `await`, la corutina cede el control temporalmente de vuelta al bucle de eventos.
> En la arquitectura de agentes empresariales que estás desarrollando, `asyncio` es fundamental para la escalabilidad. Cuando tu agente de LangChain entra en un bucle ReAct y necesita consultar herramientas a través de servidores MCP mediante red (`streamable_http`), usar las versiones asíncronas de los métodos (como `ainvoke` en lugar del tradicional `invoke`) permite que el servidor donde está alojado tu agente procese decenas o cientos de solicitudes de usuarios simultáneamente, maximizando la eficiencia de los recursos sin necesidad de crear procesos pesados adicionales.

### Example 4: Error Handling & Production Patterns

This example shows **best practices** for handling MCP failures, using LangChain's built-in retry capabilities.

**Key code you'll work with:**
```python
import asyncio

# Create model
model = ChatOpenAI(
    model=os.getenv("AI_MODEL"),
    base_url=os.getenv("AI_ENDPOINT"),
    api_key=os.getenv("AI_API_KEY"),
)

agent = create_agent(model, tools)

# Execute with timeout - prevent indefinite hangs
timeout_seconds = 30
response = await asyncio.wait_for(
    agent.ainvoke({"messages": [("human", query)]}),
    timeout=timeout_seconds
)
```

**Code**: [`code/04_mcp_error_handling.py`](./code/04_mcp_error_handling.py)  
**Run**: `python 06-mcp/code/04_mcp_error_handling.py`

**Patterns covered:**
1. **LangChain's with_retry()** - Built-in exponential backoff (no custom code!)
2. **Connection health checks** - Monitor MCP server availability
3. **Timeout handling** - Prevent indefinite hangs
4. **Graceful degradation** - Continue operating when MCP is down
5. **Fallback strategies** - Use alternative servers or cached data
6. **Proper cleanup** - Always close connections in finally blocks

**Why use with_retry()?**
- ✅ No custom retry loops needed
- ✅ Production-tested exponential backoff
- ✅ Works with all LangChain components
- ✅ Simpler code, fewer bugs

**Production Checklist:**
- ✅ Use model.with_retry() for automatic retries
- ✅ Request timeouts
- ✅ Fallback strategies
- ✅ Health monitoring
- ✅ Error logging/metrics
- ✅ Graceful degradation

> **🤖 Try with [GitHub Copilot](../docs/copilot.md) Chat:** Want to explore this code further?
> Open this file in your editor and ask Copilot:
> - "How does with_retry() implement exponential backoff?"
> - "What other production patterns should I consider for MCP?"

### Expected Output

```
🛡️  MCP Error Handling & Retry Patterns

Pattern 1: Primary + Fallback Strategy

📡 Trying primary server (Context7)...
🔄 Attempting to connect to MCP server...
✅ Connected! Retrieved 2 tools

🔧 Fetching tools from MCP server...
✅ Retrieved 2 tools successfully

Pattern 2: Using LangChain's Built-In with_retry()

✅ Model configured with automatic retry (max 3 attempts)
   - LangChain handles exponential backoff automatically
   - No custom retry loops needed!

Pattern 3: Query Execution with Timeout

👤 User: How do I use Python's asyncio library? Get the latest documentation.
🤖 Agent: Python's asyncio library provides infrastructure for writing single-threaded
concurrent code using coroutines...

Pattern 4: MCP Server Health Check

✅ MCP server is healthy

🏥 Health status: HEALTHY

💡 Error Handling Best Practices:
   ✅ Use LangChain's with_retry() for automatic exponential backoff
   ✅ Implement fallback servers for high availability

✅ MCP connection closed gracefully
```

---

## 🔧 Additional Agent Patterns

### Example 5: Creating Custom MCP Servers

Want to build your own MCP server to expose custom tools? This example shows how to create a production-ready MCP server that any MCP client can connect to!

**Why create custom servers?**
- Expose your company's internal tools to AI agents
- Wrap existing APIs in MCP standard
- Create reusable tools for your team
- Share your tools with the MCP ecosystem

**Key code you'll work with:**
```python
from mcp.server.fastmcp import FastMCP

# Create MCP server
mcp = FastMCP("my-calculator")

@mcp.tool()
def calculate(expression: str) -> str:
    """
    Perform mathematical calculations.
    
    Args:
        expression: Math expression to evaluate, e.g., '2 + 2', 'sqrt(16)'
    
    Returns:
        The result of the calculation.
    """
    result = eval(expression, {"__builtins__": {}}, safe_namespace)
    return str(result)

# Run with HTTP transport
mcp.run(transport="streamable-http", port=3000)
```

**Complete Implementation**: [`samples/basic_mcp_server.py`](./samples/basic_mcp_server.py) - A production-ready calculator MCP server with:
- Streamable HTTP transport for network access
- Safe expression evaluation with math functions
- Proper error handling

**Run the server**:
```bash
python 06-mcp/samples/basic_mcp_server.py
# Server starts on http://localhost:3000/mcp
```

**Connect to your custom server**:
```python
client = MultiServerMCPClient({
    "myCalculator": {
        "transport": "streamable_http",
        "url": "http://localhost:3000/mcp"
    }
})
```

**Best Practices**:
- ✅ Use descriptive tool names and descriptions
- ✅ Validate input parameters
- ✅ Handle errors gracefully and return helpful messages
- ✅ Add logging for debugging and monitoring
- ✅ Support graceful shutdown (signal handling)

**Learn More**:
- [MCP SDK Documentation](https://modelcontextprotocol.io/docs) - Official SDK reference
- [MCP Registry](https://github.com/mcp) - MCP server implementations

---

### How It Works

**What's Different from Getting Started with Agents**:
1. **Tool Source**: Instead of creating tools manually, you get them from an MCP server
2. **Tool Discovery**: `client.get_tools()` fetches all available tools from the server
3. **Tool Execution**: The MCP client handles communication with the remote server
4. **Same create_agent() Pattern**: The agent works identically - only the tool source changed!

**Benefits of MCP Integration**:
- ✅ **No custom integration code** - MCP handles the connection
- ✅ **Dynamic tool discovery** - Server can add/remove tools without code changes
- ✅ **Standard protocol** - Works with any MCP-compliant server
- ✅ **Production-ready** - Streamable HTTP transport scales for remote deployments

**Setting Up Context7**:

The example works out of the box with the public Context7 server - no configuration needed! The code automatically connects to `https://mcp.context7.com/mcp`.

**Optional customization**:
- To use a local Context7 server instead, set `MCP_SERVER_URL=http://localhost:3000/mcp` in your `.env` file, then run:
  ```bash
  npx -y @upstash/context7-mcp --transport http --port 3000
  ```
- For higher rate limits with the public server, get an API key at [context7.com](https://context7.com) and uncomment the `headers` section in the code

---

## 🎓 Key Takeaways

- **MCP is a universal standard** - Like USB-C for AI applications, one protocol for all services
- **Two transport types serve different needs**:
  - **Streamable HTTP**: Network-based communication, works with local or remote servers
  - **stdio**: Process-based communication via standard input/output streams
- **Works seamlessly with agents** - Same `create_agent()` pattern you've already learned about, just a different tool source
- **Multi-server power** - Connect to dozens of servers, agent intelligently chooses right tools
- **Production patterns matter** - Always implement error handling, retries, timeouts, and fallbacks
- **Dynamic tool discovery** - Servers can add/remove tools without client code changes
- **Create your own servers** - Expose company tools, wrap APIs, share with MCP ecosystem
- **Troubleshooting is key** - Know how to debug connection issues, transport problems, and tool failures

---

## 🗺️ Concept Map

This chapter taught you how MCP standardizes AI tool integration:

```mermaid
graph LR
    A[Your Agent] --> B[MCP Client]
    B --> C[Context7 Server]
    B --> D[GitHub Server]
    B --> E[Custom Server]
    C --> F[Documentation Tools]
    D --> G[GitHub Tools]
    E --> H[Your Tools]
```

*One client, multiple servers, standardized protocol - that's the power of MCP.*

---

## 🏆 Assignment

Ready to practice? Complete the challenges in [assignment.md](./assignment.md)!

The assignment includes:
1. **Connect to MCP Server** - Set up Context7 integration
2. **Build Multi-Server Agent** - Connect to multiple MCP servers
3. **Custom Tool Integration** (Bonus) - Combine MCP tools with manual tools

---

## 📚 Additional Resources

- [MCP for Beginners](https://github.com/microsoft/mcp-for-beginners) - Complete course on MCP
- [Model Context Protocol](https://modelcontextprotocol.io/) - Official MCP specification and documentation
- [LangChain MCP Adapters](https://pypi.org/project/langchain-mcp-adapters/) - LangChain Python MCP integration package
- [MCP Registry](https://github.com/mcp) - Explore available MCP servers
- [Context7 MCP Server](https://github.com/upstash/context7) - Documentation server used in this chapter

---

## 🚀 What's Next?

Great work! You've learned how to connect AI agents to external services using the **Model Context Protocol (MCP)**—a standardized way to integrate tools without writing custom implementations for each service.

### Building on MCP

**Your agents can now use tools from external services, but what about searching through your own documents and knowledge bases?** In the next chapters, you'll learn:

1. **Documents, Embeddings & Semantic Search** - Process documents, create embeddings, and build semantic search capabilities
2. **Building Agentic RAG Systems** - Combine agents with document retrieval to build intelligent question-answering systems

---

## 🐛 Troubleshooting

Common issues you might encounter when working with MCP:

### "Failed to connect to MCP server" or Connection Timeout

**Cause**: MCP server is not running, unreachable, or behind a firewall

**Fixes**:

1. **For Streamable HTTP transport**: Verify the URL is correct and server is running:
```python
# Test the endpoint manually first
url = "https://mcp.context7.com/mcp"
print(f"Testing connection to {url}...")
```

2. **For stdio transport**: Check that the server file path is correct:
```python
# Use absolute path or verify relative path
from pathlib import Path
server_path = Path(__file__).parent / "servers" / "stdio_calculator_server.py"
print(f"Server path: {server_path}")
# Ensure file exists before connecting
```

3. **Add connection timeout and retry logic** (see Example 4):
```python
# Implement timeout with asyncio
import asyncio
tools = await asyncio.wait_for(client.get_tools(), timeout=10.0)
```

---

### "No tools returned from MCP server"

**Cause**: Server is running but not exposing any tools, or authorization failed

**Fixes**:

1. **Check server logs** for errors in tool registration
2. **Verify authentication** if server requires API keys:
```python
client = MultiServerMCPClient({
    "context7": {
        "transport": "streamable_http",
        "url": "https://mcp.context7.com/mcp",
        "headers": {
            "Authorization": f"Bearer {os.getenv('CONTEXT7_API_KEY')}"  # Add auth header
        }
    }
})
```

3. **Test server directly** using a simple MCP client to isolate the issue

---

### "Module not found" for stdio server

**Cause**: Server file path is incorrect or server dependencies not installed

**Fixes**:

1. **Verify path resolution**:
```python
from pathlib import Path

server_path = Path(__file__).parent / "servers" / "stdio_calculator_server.py"
print(f"Server exists: {server_path.exists()}")
```

2. **Check that server file exists**:
```bash
# Verify server file exists
ls 06-mcp/code/servers/stdio_calculator_server.py

# Note: stdio servers run via transport, not manually.
# They communicate via stdin/stdout pipes.
```

3. **Ensure all server dependencies are installed** in your project

---

### Agent doesn't use MCP tools

**Cause**: Tools not properly passed to agent, or tool descriptions unclear

**Fixes**:

1. **Verify tools are retrieved and passed to agent**:
```python
tools = await client.get_tools()
print(f"Retrieved {len(tools)} tools:", [t.name for t in tools])

agent = create_agent(model, tools)  # Ensure tools array is passed here
```

2. **Check tool descriptions are clear** - vague descriptions confuse the agent:
```python
# Tools should have clear, specific descriptions
# MCP server should expose well-described tools
```

3. **Test with explicit tool request** in your query:
```python
query = "Use the calculate tool to compute 5 * 10"
# Being explicit helps verify tools are accessible
```

---

### "Session terminated" or "Transport closed" errors

**Cause**: MCP connection was closed unexpectedly or timeout occurred

**Fixes**:

1. **Implement proper cleanup** with try/finally:
```python
client = MultiServerMCPClient(config)
try:
    # Use MCP client
    tools = await client.get_tools()
    # ... use agent ...
finally:
    # Python MCP client handles cleanup automatically
    pass
```

2. **Handle connection failures gracefully** (see Example 4 for retry patterns)

3. **For stdio transport**: Ensure subprocess doesn't crash:
```bash
# Check server logs for errors
# Servers log to stderr with stdio transport
```

---

### Multiple MCP servers conflict or tools have same name

**Cause**: Different servers exposing tools with identical names

**Fixes**:

1. **MCP automatically namespaces tools** by server, but if conflicts occur:
```python
# Check which server provides which tool
for tool in tools:
    print(f"Tool: {tool.name}, Description: {tool.description}")
```

2. **Rely on tool descriptions** - agent uses descriptions to choose the right tool

3. **Consider renaming tools** in your MCP server implementation if conflicts are problematic

---

### Performance issues with stdio transport

**Cause**: Subprocess startup overhead or communication latency

**Fixes**:

1. **Choose transport based on architecture needs**:
```python
# If MCP server needs to be network-accessible (shared across processes/machines):
http_config = {"transport": "streamable_http", "url": "https://api.myserver.com/mcp"}

# If MCP server is tightly integrated with client process:
stdio_config = {"transport": "stdio", "command": "python", "args": ["server.py"]}
```

2. **Consider keeping server process alive** for repeated calls (advanced)

3. **Cache tool lists** if they don't change between calls

---

## 📦 Dependencies

```bash
pip install langchain langchain-openai langchain-mcp-adapters mcp python-dotenv
```

---

## 🗺️ Navigation

[← Previous: Getting Started with Agents](../05-agents/README.md) | [Back to Main](../README.md) | [Next: Documents, Embeddings & Semantic Search →](../07-documents-embeddings-semantic-search/README.md)

---

## 💬 Questions or stuck?

If you get stuck or have any questions about building AI apps, join:

[![Microsoft Foundry Discord](https://img.shields.io/badge/Discord-Microsoft_Foundry_Community_Discord-blue?style=for-the-badge&logo=discord&color=5865f2&logoColor=fff)](https://aka.ms/foundry/discord)

If you have product feedback or errors while building visit:

[![Microsoft Foundry Developer Forum](https://img.shields.io/badge/GitHub-Microsoft_Foundry_Developer_Forum-blue?style=for-the-badge&logo=github&color=000000&logoColor=fff)](https://aka.ms/foundry/forum)
