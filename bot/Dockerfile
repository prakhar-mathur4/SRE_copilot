# Use slim python image for lighter footprint
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Setup working directory in container
WORKDIR /app

# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy everything else from the bot directory
COPY . /app/bot

# Expose FastAPI port
EXPOSE 8000

# Run uvicorn server, note that we refer to bot.main:app
CMD ["uvicorn", "bot.main:app", "--host", "0.0.0.0", "--port", "8000"]
