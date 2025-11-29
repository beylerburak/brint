"use client";

import * as React from "react";

interface CodeBlockEditorProps {
  blockTitle: string;
  fileTree: Array<{ name: string; path: string }>;
}

export function CodeBlockEditor({ blockTitle, fileTree }: CodeBlockEditorProps) {
  // Placeholder component
  return <div>Code Block Editor</div>;
}

