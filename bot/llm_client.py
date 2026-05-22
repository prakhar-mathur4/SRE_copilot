"""
Multi-provider LLM client. Provider and model are selected via env vars:
  LLM_PROVIDER  — openai | anthropic | gemini | groq  (default: openai)
  LLM_MODEL     — optional model override; falls back to provider default
"""
import os
import logging

logger = logging.getLogger("sre_copilot")

_PROVIDER_DEFAULTS = {
    "openai":    {"model": "gpt-4o",                  "key_env": "OPENAI_API_KEY"},
    "anthropic": {"model": "claude-sonnet-4-6",        "key_env": "ANTHROPIC_API_KEY"},
    "gemini":    {"model": "gemini-2.0-flash",         "key_env": "GEMINI_API_KEY"},
    "groq":      {"model": "llama-3.3-70b-versatile",  "key_env": "GROQ_API_KEY"},
}


def is_llm_configured() -> bool:
    """Return True if the active provider has its API key set."""
    provider = os.getenv("LLM_PROVIDER", "openai").lower()
    config = _PROVIDER_DEFAULTS.get(provider)
    if not config:
        return False
    return bool(os.getenv(config["key_env"]))


def active_provider_info() -> dict:
    """Return the active provider name, model, and key env var name."""
    provider = os.getenv("LLM_PROVIDER", "openai").lower()
    config = _PROVIDER_DEFAULTS.get(provider, _PROVIDER_DEFAULTS["openai"])
    model = os.getenv("LLM_MODEL") or config["model"]
    return {"provider": provider, "model": model, "key_env": config["key_env"]}


async def call_llm(system_prompt: str, user_prompt: str) -> str:
    """Call the configured LLM and return the response text.

    Raises EnvironmentError if the API key is missing.
    Raises ValueError for unknown providers.
    """
    provider = os.getenv("LLM_PROVIDER", "openai").lower()
    config = _PROVIDER_DEFAULTS.get(provider)
    if not config:
        raise ValueError(f"Unknown LLM_PROVIDER: '{provider}'. Valid: {list(_PROVIDER_DEFAULTS)}")

    model = os.getenv("LLM_MODEL") or config["model"]
    api_key = os.getenv(config["key_env"])
    if not api_key:
        raise EnvironmentError(f"{config['key_env']} is not set")

    logger.info(f"LLM call → provider={provider} model={model}")

    if provider == "openai":
        return await _call_openai(api_key, model, system_prompt, user_prompt)
    elif provider == "anthropic":
        return await _call_anthropic(api_key, model, system_prompt, user_prompt)
    elif provider == "gemini":
        return await _call_gemini(api_key, model, system_prompt, user_prompt)
    elif provider == "groq":
        return await _call_groq(api_key, model, system_prompt, user_prompt)


async def _call_openai(api_key: str, model: str, system_prompt: str, user_prompt: str) -> str:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        temperature=0.2,
        max_tokens=500,
    )
    return response.choices[0].message.content.strip()


async def _call_anthropic(api_key: str, model: str, system_prompt: str, user_prompt: str) -> str:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=api_key)
    response = await client.messages.create(
        model=model,
        max_tokens=500,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return response.content[0].text.strip()


async def _call_gemini(api_key: str, model: str, system_prompt: str, user_prompt: str) -> str:
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=api_key)
    response = await client.aio.models.generate_content(
        model=model,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.2,
            max_output_tokens=500,
        ),
    )
    return response.text.strip()


async def _call_groq(api_key: str, model: str, system_prompt: str, user_prompt: str) -> str:
    from groq import AsyncGroq
    client = AsyncGroq(api_key=api_key)
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        temperature=0.2,
        max_tokens=500,
    )
    return response.choices[0].message.content.strip()
