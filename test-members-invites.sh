#!/bin/bash

# Test script for members and invites endpoints
# Usage: ./test-members-invites.sh <access-token> <workspace-id>

ACCESS_TOKEN="${1:-YOUR_ACCESS_TOKEN}"
WORKSPACE_ID="${2:-ws_beyler}"

echo "Testing with:"
echo "  Workspace ID: $WORKSPACE_ID"
echo "  Access Token: ${ACCESS_TOKEN:0:20}..."
echo ""

echo "=== Test 1: GET /workspaces/$WORKSPACE_ID/members ==="
curl -X GET "http://localhost:3001/workspaces/$WORKSPACE_ID/members" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Workspace-Id: $WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || cat

echo ""
echo "=== Test 2: GET /workspaces/$WORKSPACE_ID/invites ==="
curl -X GET "http://localhost:3001/workspaces/$WORKSPACE_ID/invites" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Workspace-Id: $WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || cat

echo ""
echo "=== Test 3: GET /workspaces/$WORKSPACE_ID/members (without X-Workspace-Id header) ==="
curl -X GET "http://localhost:3001/workspaces/$WORKSPACE_ID/members" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || cat

echo ""
echo "=== Test 4: GET /workspaces/$WORKSPACE_ID/invites (without X-Workspace-Id header) ==="
curl -X GET "http://localhost:3001/workspaces/$WORKSPACE_ID/invites" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || cat

