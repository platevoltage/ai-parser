#!/usr/bin/env bash

# parser.sh
# Usage: ./parser.sh <email.html> [system_prompt.txt]

HTML_FILE="$1"
SYSTEM_PROMPT_FILE="${2:-system.txt}"

if [ -z "$HTML_FILE" ]; then
  echo "Usage: $0 <email.html> [system_prompt.txt]"
  exit 1
fi

if [ ! -f "$HTML_FILE" ]; then
  echo "Error: $HTML_FILE does not exist"
  exit 1
fi

if [ ! -f "$SYSTEM_PROMPT_FILE" ]; then
  echo "Error: $SYSTEM_PROMPT_FILE does not exist"
  exit 1
fi

# Start timer
START_TIME=$(date +%s%N)

# Convert HTML to plain text
EMAIL_CONTENT="$(lynx -dump "$HTML_FILE")"

# Escape for JSON safely using jq
escape_json() {
  jq -Rs . <<< "$1"
}

ESCAPED_EMAIL_CONTENT=$(escape_json "$EMAIL_CONTENT")
echo "$EMAIL_CONTENT"

# ESCAPED_SYSTEM=$(escape_json "$(cat "$SYSTEM_PROMPT_FILE")")

# # Build the JSON payload using jq (avoids all manual escaping issues)
# JSON_PAYLOAD=$(jq -n \
#   --arg model "qwen3-coder:480b-cloud" \
#   --argjson email "$ESCAPED_EMAIL_CONTENT" \
#   --argjson system "$ESCAPED_SYSTEM" \
#   '
#   {
#     model: $model,
#     stream: false,
#     format: "json",
#     messages: [
#       { role: "system", content: $system },
#       { role: "user", content: $email }
#     ]
#   }
#   '
# )

# # Call Ollama API and stream assistant content
# curl -s -N http://localhost:11434/api/chat \
#   -H "Content-Type: application/json" \
#   -d "$JSON_PAYLOAD" \
# | jq -r 'select(.message.content != null) | .message.content' \
# | tr -d '\n' \
# | jq .
# echo

# # End timer
# END_TIME=$(date +%s%N)

# # Calculate elapsed time in seconds
# ELAPSED_NS=$((END_TIME - START_TIME))
# ELAPSED_SEC=$(echo "scale=3; $ELAPSED_NS/1000000000" | bc)

# # echo "Execution time: ${ELAPSED_SEC}s"
