from google import genai

client = genai.Client(api_key="YOUR_API_KEY_HERE")

models = client.models.list()

for m in models:
    print(m.name)