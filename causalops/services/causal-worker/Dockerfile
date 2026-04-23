FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi==0.115.5 uvicorn[standard]==0.32.1

COPY . /app

EXPOSE 8000

CMD ["python", "-c", "from fastapi import FastAPI; import uvicorn; app=FastAPI(); app.get('/health')(lambda: {'status':'ok'}); uvicorn.run(app, host='0.0.0.0', port=8000)"]
