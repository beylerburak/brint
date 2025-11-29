"use client";

import * as React from "react";

interface SingleFileCodeViewProps {
  code: string;
}

export function SingleFileCodeView({ code }: SingleFileCodeViewProps) {
  // Placeholder component
  return <pre className="p-4">{code}</pre>;
}

