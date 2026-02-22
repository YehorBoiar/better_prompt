to run backend in dev

```
uvicorn app.main:app --host 0.0.0.0 --port 3000
```

on eduroam run though `ngrok`

```
ngrok http 3000
```

## API endpoints

replace `localhost:3000` with your `IP:3000` or your `ngrok` link

HELATH

```
  curl -s http://localhost:3000/health
```

LOGIN

```
  curl -s -X POST http://localhost:3000/login \
    -H "Content-Type: application/json" \
    -d '{"username":"aaa","password":"aaa"}' | jq -r '.session_token'
```

CARD REGISTER

```
  curl -s -X POST http://localhost:3000/card/register \
    -H "Content-Type: application/json" \
    -H "Authorisation: $SESSION_TOKEN" \
    -d '{"card_id":"aaa"}'
```

BLOCK

```
  curl -s -X POST http://localhost:3000/block \
    -H "Authorisation: $SESSION_TOKEN"
```

ngrok start --all --config ngrok.yml
