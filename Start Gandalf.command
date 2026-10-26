#!/bin/sh
cd "$(dirname "$0")" || exit 1
node_command=$(command -v node || true)
if [ -z "$node_command" ] && [ -x "$HOME/.local/bin/node" ]; then node_command="$HOME/.local/bin/node"; fi
if [ -z "$node_command" ] && [ -x /opt/homebrew/bin/node ]; then node_command=/opt/homebrew/bin/node; fi
if [ -z "$node_command" ]; then
  echo 'Install Node.js 22 or later, then open this launcher again.'
  read -r ignored_input
  exit 1
fi
exec "$node_command" src/server.js
