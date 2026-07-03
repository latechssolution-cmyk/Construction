---
name: composio
description: Connects your agent to 1000+ SaaS apps (GitHub, Slack, Jira, Gmail, etc.) with managed authentication and zero integration code.
---
# Composio Integration

Composio allows the agent to securely trigger actions and fetch data from third-party SaaS services.

## Authentication & Setup
1. **API Key**: Retrieve the Composio API key from your Composio Dashboard.
2. **Server config**: Connect using the streamable HTTP URL: `https://connect.composio.dev/mcp`.
3. **Headers**: Provide the API Key via the header `x-consumer-api-key`.

## Usage
- When requested to link to Slack, GitHub, Linear, or Gmail, use Composio actions to execute the requested workflows.
