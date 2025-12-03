/**
 * Filter Chip Component
 * 
 * Visual representation and editor for active filters.
 */

import * as React from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BiDataViewColumn, ActiveFilter, TextOperator, SelectOperator, NumberOperator, DateOperator } from "./types";

const TEXT_OPERATORS: { value: TextOperator; label: string }[] = [
  { value: "contains", label: "contains" },
  { value: "equals", label: "equals" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

const SELECT_OPERATORS: { value: SelectOperator; label: string }[] = [
  { value: "is", label: "is" },
  { value: "is_not", label: "is not" },
];

const NUMBER_OPERATORS: { value: NumberOperator; label: string }[] = [
  { value: "equals", label: "=" },
  { value: "greater_than", label: ">" },
  { value: "less_than", label: "<" },
  { value: "greater_or_equal", label: "≥" },
  { value: "less_or_equal", label: "≤" },
];

const DATE_OPERATORS: { value: DateOperator; label: string }[] = [
  { value: "is", label: "is" },
  { value: "before", label: "before" },
  { value: "after", label: "after" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

interface FilterChipProps<TData> {
  filter: ActiveFilter;
  column: BiDataViewColumn<TData>;
  onUpdate: (updates: Partial<ActiveFilter>) => void;
  onRemove: () => void;
}

export function FilterChip<TData>({ filter, column, onUpdate, onRemove }: FilterChipProps<TData>) {
  const [open, setOpen] = React.useState(false);
  
  const getOperators = () => {
    switch (column.type) {
      case "text": return TEXT_OPERATORS;
      case "select": return SELECT_OPERATORS;
      case "number": return NUMBER_OPERATORS;
      case "date": return DATE_OPERATORS;
      default: return [];
    }
  };

  const operators = getOperators();
  const currentOperator = operators.find((op) => op.value === filter.operator);
  const needsValue = !["is_empty", "is_not_empty"].includes(filter.operator);

  const getSummary = () => {
    const operatorLabel = currentOperator?.label || filter.operator.replace(/_/g, " ");
    
    if (!needsValue) {
      return `${column.label}: ${operatorLabel}`;
    }

    if (Array.isArray(filter.value)) {
      if (filter.value.length === 0) {
        return `${column.label}: ${operatorLabel} ...`;
      }
      return `${column.label}: ${operatorLabel} ${filter.value.join(", ")}`;
    }

    if (!filter.value) {
      return `${column.label}: ${operatorLabel} ...`;
    }

    return `${column.label}: ${operatorLabel} ${filter.value}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-sm font-normal"
        >
          <span>{getSummary()}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{column.label}</span>
              <Select
                value={filter.operator}
                onValueChange={(value) => onUpdate({ operator: value })}
              >
                <SelectTrigger className="h-7 w-auto border-0 bg-muted/50 px-2 text-sm shadow-none">
                  <SelectValue>{currentOperator?.label || filter.operator}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {operators.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                onRemove();
                setOpen(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {needsValue && (
            <>
              {column.type === "text" && (
                <Input
                  placeholder="Type a value..."
                  value={filter.value as string}
                  onChange={(e) => onUpdate({ value: e.target.value })}
                  className="h-8"
                />
              )}

              {column.type === "select" && (
                <div className="space-y-1 max-h-40 overflow-y-auto border rounded-md p-2">
                  {!column.options || column.options.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-2">
                      No options available
                    </div>
                  ) : (
                    column.options.map((option: string) => {
                      const values = filter.value as string[];
                      const isChecked = values.includes(option);
                      return (
                        <div
                          key={option}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer"
                          onClick={() => {
                            const newValues = isChecked
                              ? values.filter((v) => v !== option)
                              : [...values, option];
                            onUpdate({ value: newValues });
                          }}
                        >
                          <Checkbox checked={isChecked} />
                          <span className="text-sm">{option}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {column.type === "number" && (
                <Input
                  type="number"
                  placeholder="Enter a number..."
                  value={filter.value as string}
                  onChange={(e) => onUpdate({ value: e.target.value })}
                  className="h-8"
                />
              )}

              {column.type === "date" && (
                <Input
                  type="date"
                  value={filter.value as string}
                  onChange={(e) => onUpdate({ value: e.target.value })}
                  className="h-8"
                />
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

