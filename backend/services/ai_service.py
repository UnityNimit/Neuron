# backend/services/ai_service.py
import httpx

async def fetch_ast_summary(code_string: str) -> str:
    url = "http://127.0.0.1:11434/api/generate"
    pruned_code = code_string[:1500]
    prompt = f"Analyze this Python code. Explain its core business logic in exactly two concise sentences. No markdown, no greetings.\n\nCode:\n{code_string}"
    
    payload = {
        "model": "qwen2.5-coder:3b",
        "prompt": prompt,
        "stream": False,
        "keep_alive": -1,
        "options": {
            "temperature": 0.0,
            "num_predict": 40,
            "num_ctx": 1024 # Cap context to save your 6GB VRAM
        }
    }
    
    async with httpx.AsyncClient() as client:
        try:
            # Increased timeout to 15s to allow Ollama to load the model into VRAM
            url = "http://127.0.0.1:11434/api/generate"
            response = await client.post(url, json=payload, timeout=15.0)
            return response.json().get("response", "").strip()
        except Exception as e:
            # Print the actual error to your backend console so we can see if it's a timeout or connection refusal
            print(f"❌ LLM Error: {repr(e)}") 
            return "AI Summary unavailable (Local Engine Offline)."